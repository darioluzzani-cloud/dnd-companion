'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignState, Player } from '@/lib/types';
import { SEED } from '@/data/seed';

const SAVE_DEBOUNCE = 800;
const PLAYER_SAVE_DEBOUNCE = 400;

// Identificatore del dispositivo per questa sessione: serve a ignorare l'eco
// delle proprie scritture sul canale realtime della tabella giocatori.
const CLIENT_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

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

// Rimuove i campi locali prima di salvare su Supabase.
// Se la tabella per-giocatore è attiva, anche 'players' esce dal blocco unico:
// ogni personaggio viaggia sulla propria riga.
function stripLocal(state: CampaignState, excludePlayers: boolean): Partial<CampaignState> {
  const shared: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (LOCAL_KEYS.has(k)) continue;
    if (excludePlayers && k === 'players') continue;
    shared[k] = v;
  }
  return shared as Partial<CampaignState>;
}

export function useCampaignState(slug: string) {
  const [state, setState] = useState<CampaignState>(SEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const versionRef = useRef(0);
  const skipNextBroadcast = useRef(false);
  // true finché la tabella player_state non è disponibile: comportamento legacy (blocco unico)
  const legacyPlayers = useRef(true);
  // Chiavi condivise modificate da questo dispositivo dall'ultimo salvataggio
  const dirtyKeys = useRef<Set<string>>(new Set());
  // true se la RPC patch_campaign_state non esiste: si ricade sul salvataggio integrale
  const rpcMissing = useRef(false);

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

        // --- Righe per-giocatore: se la tabella esiste, è la fonte di verità dei PG ---
        let playersFromRows: Player[] | null = null;
        const { data: prRows, error: prErr } = await supabase
          .from('player_state').select('player_id, data').eq('campaign_id', camp.id);
        if (!prErr) {
          legacyPlayers.current = false;
          const blobPlayers = (loaded?.players as Player[] | undefined) || SEED.players;
          if (!prRows || prRows.length === 0) {
            // Prima attivazione: migro i PG dal blocco unico alle righe dedicate
            await supabase.from('player_state').insert(
              blobPlayers.map(p => ({ campaign_id: camp.id, player_id: p.id, data: p, client_id: CLIENT_ID }))
            );
            playersFromRows = blobPlayers;
          } else {
            // Ricompongo rispettando l'ordine storico del blocco; i nuovi in coda
            const order = blobPlayers.map(p => p.id);
            const byId = new Map(prRows.map(r => [r.player_id as string, r.data as Player]));
            playersFromRows = [
              ...order.filter(id => byId.has(id)).map(id => byId.get(id)!),
              ...prRows.filter(r => !order.includes(r.player_id as string)).map(r => r.data as Player),
            ];
          }
        } // prErr → tabella assente: legacyPlayers resta true, tutto come prima

        if (loaded && Object.keys(loaded).length > 0) {
          setState(prev => ({
            ...SEED, ...loaded,
            ...(playersFromRows ? { players: playersFromRows } : {}),
            tab: prev.tab, activePlayer: prev.activePlayer,
            activeScenario: prev.activeScenario || SEED.activeScenario, dmMode: prev.dmMode,
          }));
        } else {
          setState(playersFromRows ? { ...SEED, players: playersFromRows } : SEED);
          await supabase.from('campaign_state')
            .update({ state: stripLocal(SEED, !legacyPlayers.current) as unknown as Record<string, unknown> })
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

  // --- Salvataggio debounced del blocco condiviso (senza i PG, se separati) ---
  const saveToSupabase = useCallback(async (newState: CampaignState) => {
    if (!campaignId) return;
    skipNextBroadcast.current = true;
    // Salvataggio per chiave: spedisco solo ciò che questo dispositivo ha toccato,
    // così una fotografia stantia non può sovrascrivere il lavoro altrui.
    if (!rpcMissing.current) {
      const full = stripLocal(newState, !legacyPlayers.current) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const k of dirtyKeys.current) {
        if (k in full) patch[k] = full[k];
      }
      if (Object.keys(patch).length === 0) return;
      const { error: rpcErr } = await supabase.rpc('patch_campaign_state', { cid: campaignId, patch });
      if (!rpcErr) { dirtyKeys.current.clear(); return; }
      rpcMissing.current = true; // funzione assente: da qui in poi, salvataggio integrale
    }
    try {
      await supabase.from('campaign_state')
        .update({ state: stripLocal(newState, !legacyPlayers.current) as unknown as Record<string, unknown> })
        .eq('campaign_id', campaignId);
      dirtyKeys.current.clear();
    } catch (e) { console.warn('Save failed:', e); }
  }, [campaignId]);

  // --- Salvataggio per-giocatore: ogni PG sulla propria riga, debounce individuale ---
  const savePlayerRow = useCallback(async (campId: string, player: Player) => {
    try {
      await supabase.from('player_state').upsert(
        { campaign_id: campId, player_id: player.id, data: player, client_id: CLIENT_ID, updated_at: new Date().toISOString() },
        { onConflict: 'campaign_id,player_id' }
      );
    } catch (e) { console.warn('Player save failed:', e); }
  }, []);

  const queuePlayerSave = useCallback((campId: string, player: Player) => {
    const timers = playerTimers.current;
    const prev = timers.get(player.id);
    if (prev) clearTimeout(prev);
    timers.set(player.id, setTimeout(() => {
      timers.delete(player.id);
      savePlayerRow(campId, player);
    }, PLAYER_SAVE_DEBOUNCE));
  }, [savePlayerRow]);

  const deletePlayerRow = useCallback(async (campId: string, playerId: string) => {
    try {
      await supabase.from('player_state').delete()
        .eq('campaign_id', campId).eq('player_id', playerId);
    } catch (e) { console.warn('Player delete failed:', e); }
  }, []);

  const update = useCallback((patch: Partial<CampaignState> | ((s: CampaignState) => Partial<CampaignState>)) => {
    setState(prev => {
      const changes = typeof patch === 'function' ? patch(prev) : patch;
      const next = { ...prev, ...changes };

      // Instradamento dei PG sulle righe dedicate: salvo solo chi è cambiato davvero
      if (!legacyPlayers.current && campaignId && 'players' in changes && changes.players) {
        const prevById = new Map(prev.players.map(p => [p.id, p]));
        for (const p of next.players) {
          const old = prevById.get(p.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(p)) queuePlayerSave(campaignId, p);
          prevById.delete(p.id);
        }
        for (const removedId of prevById.keys()) deletePlayerRow(campaignId, removedId);
      }

      // Il blocco condiviso si salva solo se è cambiato qualcosa che gli appartiene
      const sharedKeys = Object.keys(changes).filter(k =>
        !LOCAL_KEYS.has(k) && (legacyPlayers.current || k !== 'players')
      );
      sharedKeys.forEach(k => dirtyKeys.current.add(k));
      if (sharedKeys.length > 0) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveToSupabase(next), SAVE_DEBOUNCE);
      }
      return next;
    });
  }, [saveToSupabase, queuePlayerSave, deletePlayerRow, campaignId]);

  // --- Realtime: blocco condiviso (i PG, se separati, arrivano dall'altro canale) ---
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
            setState(prev => {
              const merged = { ...prev };
              for (const [k, v] of Object.entries(incoming.state)) {
                if (LOCAL_KEYS.has(k)) continue;
                if (!legacyPlayers.current && k === 'players') continue; // i PG viaggiano per riga
                (merged as any)[k] = v;
              }
              return merged;
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId]);

  // --- Realtime: righe per-giocatore ---
  useEffect(() => {
    if (!campaignId || legacyPlayers.current) return;
    const channel = supabase
      .channel('players-' + campaignId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'player_state', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { player_id?: string };
            if (old?.player_id) setState(prev => ({ ...prev, players: prev.players.filter(p => p.id !== old.player_id) }));
            return;
          }
          const row = payload.new as { player_id: string; data: Player; client_id?: string };
          if (!row || row.client_id === CLIENT_ID) return; // eco delle mie scritture
          setState(prev => {
            const exists = prev.players.some(p => p.id === row.player_id);
            const players = exists
              ? prev.players.map(p => p.id === row.player_id ? row.data : p)
              : [...prev.players, row.data];
            return { ...prev, players };
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId, loading]);

  return { state, update, loading, error, campaignId };
}
