'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignState } from '@/lib/types';
import { SEED } from '@/data/seed';

const SAVE_DEBOUNCE = 800;

// Campi che restano LOCALI per ogni dispositivo — NON sincronizzati
const LOCAL_KEYS = new Set([
  'tab', 'activePlayer', 'activeScenario', 'dmMode', 'editMode',
  'loreCatFilter', 'questSubTab',
  'draftQuest', 'draftQuestType', 'draftScen', 'draftChar',
  'draftSpell', 'draftSpellLevel', 'draftItem',
  'draftCombName', 'draftCombInit', 'draftCombHp',
  'draftLoreCat', 'draftLoreName', 'draftLoreSub',
  'combatScenario',
  'lastRoll', 'rollSeq', 'history',
]);

// Rimuove i campi locali prima di salvare su Supabase
function stripLocal(state: CampaignState): Partial<CampaignState> {
  const shared: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (!LOCAL_KEYS.has(k)) shared[k] = v;
  }
  return shared as Partial<CampaignState>;
}

export function useCampaignState(slug: string) {
  const [state, setState] = useState<CampaignState>(SEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(0);
  const skipNextBroadcast = useRef(false);

  // --- Caricamento iniziale ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: camp, error: campErr } = await supabase
          .from('campaigns').select('id').eq('slug', slug).single();
        if (campErr) throw campErr;
        if (!camp) throw new Error('Campagna non trovata');
        if (cancelled) return;
        setCampaignId(camp.id);

        const { data: row, error: stateErr } = await supabase
          .from('campaign_state').select('state, version').eq('campaign_id', camp.id).single();
        if (stateErr) throw stateErr;
        if (cancelled) return;

        const loaded = row?.state as Partial<CampaignState> | null;
        versionRef.current = row?.version ?? 0;

        if (loaded && Object.keys(loaded).length > 0) {
          // Merge: dati condivisi dal DB + campi locali dal SEED (default per questo dispositivo)
          setState(prev => ({ ...SEED, ...loaded, tab: prev.tab, activePlayer: prev.activePlayer, activeScenario: prev.activeScenario || SEED.activeScenario, dmMode: prev.dmMode }));
        } else {
          setState(SEED);
          await supabase.from('campaign_state')
            .update({ state: stripLocal(SEED) as unknown as Record<string, unknown> })
            .eq('campaign_id', camp.id);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // --- Salvataggio debounced (solo dati condivisi) ---
  const saveToSupabase = useCallback(async (newState: CampaignState) => {
    if (!campaignId) return;
    skipNextBroadcast.current = true;
    try {
      await supabase.from('campaign_state')
        .update({ state: stripLocal(newState) as unknown as Record<string, unknown> })
        .eq('campaign_id', campaignId);
    } catch (e) { console.warn('Save failed:', e); }
  }, [campaignId]);

  const update = useCallback((patch: Partial<CampaignState> | ((s: CampaignState) => Partial<CampaignState>)) => {
    setState(prev => {
      const changes = typeof patch === 'function' ? patch(prev) : patch;
      const next = { ...prev, ...changes };

      // Salva solo se sono cambiati dati condivisi (non solo tab/activePlayer/ecc.)
      const hasSharedChanges = Object.keys(changes).some(k => !LOCAL_KEYS.has(k));
      if (hasSharedChanges) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveToSupabase(next), SAVE_DEBOUNCE);
      }
      return next;
    });
  }, [saveToSupabase]);

  // --- Realtime subscription (aggiorna solo dati condivisi, preserva stato locale) ---
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel('campaign-' + campaignId)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'campaign_state', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (skipNextBroadcast.current) { skipNextBroadcast.current = false; return; }
          const incoming = payload.new as { state: Partial<CampaignState>; version: number };
          if (incoming.version > versionRef.current) {
            versionRef.current = incoming.version;
            // Merge: prendo i dati condivisi dal DB, preservo i miei campi locali
            setState(prev => {
              const merged = { ...prev };
              for (const [k, v] of Object.entries(incoming.state)) {
                if (!LOCAL_KEYS.has(k)) (merged as any)[k] = v;
              }
              return merged;
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId]);

  return { state, update, loading, error, campaignId };
}
