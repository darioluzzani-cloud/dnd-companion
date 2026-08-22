import { supabase } from '@/lib/supabase';

// ─── PUNTI DI RIPRISTINO ─────────────────────────────────────
// Lo stato della campagna vive in due luoghi: il blocco condiviso in
// `campaign_state.state` e una riga per personaggio in `player_state`.
// Una fotografia che ne prendesse solo uno sarebbe peggio che inutile,
// perché ripristinandola si otterrebbe un mondo incoerente — inventari di
// ieri accanto a scenari di oggi. Perciò lo snapshot cattura entrambi e li
// riscrive insieme.
//
// I campi di sola navigazione (tab aperta, personaggio attivo, modalità DM)
// non entrano nella fotografia: sono locali a ciascun dispositivo, e
// ripristinarli significherebbe spostare la vista sotto le mani altrui.

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

/** Quante fotografie conservare: le più vecchie vengono potate da sole. */
export const SNAPSHOT_KEEP = 20;

export interface SnapshotRow {
  id: string;
  campaign_id: string;
  label: string | null;
  created_at: string;
  auto: boolean | null;
  payload: { shared: Record<string, unknown>; players: any[] };
}

/** Meta di una fotografia, senza il carico utile: per l'elenco. */
export interface SnapshotMeta {
  id: string;
  label: string | null;
  created_at: string;
  auto: boolean | null;
  players: number;
}

function shared(state: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state || {})) {
    if (LOCAL_KEYS.has(k)) continue;
    if (k === 'players') continue;      // i PG viaggiano a parte
    out[k] = v;
  }
  return out;
}

/** La tabella esiste? Serve a dare un messaggio utile invece di un errore crudo. */
export async function snapshotsAvailable(campaignId: string): Promise<boolean> {
  const { error } = await supabase.from('campaign_snapshots').select('id').eq('campaign_id', campaignId).limit(1);
  return !error;
}

export async function listSnapshots(campaignId: string): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase
    .from('campaign_snapshots')
    .select('id, label, created_at, auto, payload')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id, label: r.label, created_at: r.created_at, auto: r.auto,
    players: Array.isArray(r.payload?.players) ? r.payload.players.length : 0,
  }));
}

/**
 * Scatta una fotografia dello stato corrente. Legge dal server invece che
 * dalla memoria del dispositivo: ciò che conta è ciò che è stato salvato
 * davvero, non ciò che questa scheda crede di sapere.
 */
export async function createSnapshot(campaignId: string, label: string, auto = false): Promise<void> {
  const { data: st, error: stErr } = await supabase
    .from('campaign_state').select('state').eq('campaign_id', campaignId).single();
  if (stErr) throw stErr;

  let players: any[] = [];
  const { data: prRows, error: prErr } = await supabase
    .from('player_state').select('player_id, data').eq('campaign_id', campaignId);
  if (!prErr && prRows) players = prRows.map((r: any) => r.data);
  else players = ((st?.state as any)?.players) || [];   // impianto legacy a blocco unico

  const { error } = await supabase.from('campaign_snapshots').insert({
    campaign_id: campaignId,
    label: label?.trim() || null,
    auto,
    payload: { shared: shared(st?.state || {}), players },
  });
  if (error) throw error;
  await pruneSnapshots(campaignId);
}

/** Tiene solo le SNAPSHOT_KEEP più recenti. */
export async function pruneSnapshots(campaignId: string): Promise<void> {
  const { data } = await supabase
    .from('campaign_snapshots').select('id').eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  const excess = (data || []).slice(SNAPSHOT_KEEP).map((r: any) => r.id);
  if (excess.length) await supabase.from('campaign_snapshots').delete().in('id', excess);
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { error } = await supabase.from('campaign_snapshots').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Ripristina una fotografia. Prima di sovrascrivere ne scatta una di
 * sicurezza dello stato corrente: un ripristino sbagliato deve essere
 * annullabile quanto l'errore che lo ha reso necessario.
 *
 * Le righe dei personaggi assenti dalla fotografia vengono rimosse, perché
 * altrimenti un PG creato dopo lo scatto sopravvivrebbe al ripristino e il
 * mondo tornerebbe indietro solo a metà.
 */
export async function restoreSnapshot(campaignId: string, id: string): Promise<void> {
  const { data: snap, error: sErr } = await supabase
    .from('campaign_snapshots').select('payload, label, created_at').eq('id', id).single();
  if (sErr) throw sErr;
  const payload = (snap as any)?.payload;
  if (!payload?.shared) throw new Error('Fotografia illeggibile o incompleta.');

  await createSnapshot(campaignId, 'Prima del ripristino', true);

  const players: any[] = Array.isArray(payload.players) ? payload.players : [];

  // Il blocco condiviso, integralmente: un ripristino non è una modifica
  // parziale e non deve passare dal salvataggio per chiave.
  const state = { ...payload.shared, ...(players.length ? { players } : {}) };
  const { error: upErr } = await supabase.from('campaign_state')
    .update({ state }).eq('campaign_id', campaignId);
  if (upErr) throw upErr;

  // Le righe dei personaggi, se l'impianto le usa
  const { data: prRows, error: prErr } = await supabase
    .from('player_state').select('player_id').eq('campaign_id', campaignId);
  if (!prErr) {
    if (players.length) {
      await supabase.from('player_state').upsert(
        players.map(p => ({ campaign_id: campaignId, player_id: p.id, data: p, updated_at: new Date().toISOString() })),
        { onConflict: 'campaign_id,player_id' }
      );
    }
    const keep = new Set(players.map(p => p.id));
    const surplus = (prRows || []).map((r: any) => r.player_id).filter((pid: string) => !keep.has(pid));
    if (surplus.length) {
      await supabase.from('player_state').delete().eq('campaign_id', campaignId).in('player_id', surplus);
    }
  }
}

/** SQL da eseguire una sola volta su Supabase perché la tabella esista. */
export const SNAPSHOT_SQL = `create table if not exists campaign_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  label text,
  auto boolean default false,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists campaign_snapshots_campaign_idx
  on campaign_snapshots (campaign_id, created_at desc);
alter table campaign_snapshots enable row level security;
create policy "snapshots_all" on campaign_snapshots for all using (true) with check (true);`;
