'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignState } from '@/lib/types';
import { SEED } from '@/data/seed';

const SAVE_DEBOUNCE = 800; // ms

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
        // Trova la campagna per slug
        const { data: camp, error: campErr } = await supabase
          .from('campaigns')
          .select('id')
          .eq('slug', slug)
          .single();
        if (campErr) throw campErr;
        if (!camp) throw new Error('Campagna non trovata');
        if (cancelled) return;
        setCampaignId(camp.id);

        // Carica lo stato
        const { data: row, error: stateErr } = await supabase
          .from('campaign_state')
          .select('state, version')
          .eq('campaign_id', camp.id)
          .single();
        if (stateErr) throw stateErr;
        if (cancelled) return;

        const loaded = row?.state as CampaignState | null;
        versionRef.current = row?.version ?? 0;

        // Se lo stato è vuoto ({} o null), usiamo il SEED
        if (loaded && Object.keys(loaded).length > 0) {
          setState({ ...SEED, ...loaded });
        } else {
          // Prima volta: salva il SEED nel DB
          setState(SEED);
          await supabase
            .from('campaign_state')
            .update({ state: SEED as unknown as Record<string, unknown> })
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

  // --- Salvataggio debounced ---
  const saveToSupabase = useCallback(async (newState: CampaignState) => {
    if (!campaignId) return;
    skipNextBroadcast.current = true;
    try {
      await supabase
        .from('campaign_state')
        .update({ state: newState as unknown as Record<string, unknown> })
        .eq('campaign_id', campaignId);
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }, [campaignId]);

  const update = useCallback((patch: Partial<CampaignState> | ((s: CampaignState) => Partial<CampaignState>)) => {
    setState(prev => {
      const changes = typeof patch === 'function' ? patch(prev) : patch;
      const next = { ...prev, ...changes };
      // Debounce save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveToSupabase(next), SAVE_DEBOUNCE);
      return next;
    });
  }, [saveToSupabase]);

  // --- Realtime subscription ---
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel('campaign-' + campaignId)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'campaign_state', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (skipNextBroadcast.current) {
            skipNextBroadcast.current = false;
            return;
          }
          const incoming = payload.new as { state: CampaignState; version: number };
          if (incoming.version > versionRef.current) {
            versionRef.current = incoming.version;
            setState(prev => ({ ...prev, ...incoming.state }));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [campaignId]);

  return { state, update, loading, error, campaignId };
}
