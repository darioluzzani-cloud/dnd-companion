import { DAYS_PER_WEEK } from '@/lib/dnd/calendar';

// ─── IL MAGAZZINO DI OLMOBIANCO ──────────────────────────────
// Il magazzino tiene oggetti d'armeria, contati per voce. Ciò che vi entra
// e ciò che ne esce ha due autori diversi, e il salvataggio procede per
// chiave: perciò la giacenza non è un numero solo, ma la differenza fra due
// registri che nessuno dei due autori condivide con l'altro.
//
//   villageStock — il calendario e il DM: ciò che le attività hanno reso,
//                  meno ciò che il villaggio ha mangiato
//   villageDrawn — i giocatori: ciò che hanno prelevato, meno ciò che
//                  hanno riposto
//
//   giacenza = villageStock − villageDrawn
//
// Un giocatore che preleva tre razioni mentre il DM avanza la data non può
// così cancellare la produzione della settimana, né esserne cancellato.

export type Tally = Record<string, number>;   // id d'armeria → quantità

export const tallyOf = (s: any, key: 'villageStock' | 'villageDrawn'): Tally => ({ ...((s?.[key] || {}) as Tally) });

/** Giacenza di una voce d'armeria. Mai negativa: uno scarto nato da due
 *  scritture contemporanee si legge come magazzino vuoto, non come debito. */
export function qtyOf(s: any, armoryId: string): number {
  return Math.max(0, Math.floor((s?.villageStock?.[armoryId] || 0) - (s?.villageDrawn?.[armoryId] || 0)));
}

/** Tutto ciò che il magazzino contiene, con la scheda d'armeria, per nome. */
export function stockList(s: any): { entry: any; qty: number }[] {
  const ids = new Set([...Object.keys(s?.villageStock || {}), ...Object.keys(s?.villageDrawn || {})]);
  const armory = (s?.armory || []) as any[];
  return [...ids]
    .map(id => ({ entry: armory.find(e => e.id === id), qty: qtyOf(s, id) }))
    .filter(x => x.entry && x.qty > 0)
    .sort((a, b) => (a.entry.name || '').localeCompare(b.entry.name || ''));
}

export const addTo = (t: Tally, id: string, n: number): Tally => ({ ...t, [id]: (t[id] || 0) + n });

// ─── Razioni e fabbisogno ────────────────────────────────────

export const RATION_PCT_DEFAULT = 15;   // quota degli abitanti che mangia dal magazzino, al giorno
export const LEAVE_PCT_DEFAULT = 10;    // abitanti che partono a ogni mercato di carestia

/**
 * La voce d'armeria che vale come razione: quella scelta dal DM; altrimenti
 * quella che si chiama proprio «Razioni giornaliere»; altrimenti la prima
 * il cui nome contenga una parola che comincia per «razion».
 *
 * La parola deve cominciare così: cercando la sequenza ovunque nel nome,
 * «Pergamena di Lavorazione Nanica» veniva scambiata per una razione —
 * lavo-razion-e — e riceveva le scorte al posto del pane.
 */
export function rationEntry(s: any): any | undefined {
  const armory = (s?.armory || []) as any[];
  const norm = (n?: string) => (n || '').trim().toLowerCase();
  return armory.find(e => e.id === s?.villageRationId)
    || armory.find(e => /^razion[ei] giornalier[ae]$/.test(norm(e.name)))
    || armory.find(e => /(^|[^a-zà-ú])razion/i.test(e.name || ''));
}

export const rationPct = (s: any): number => {
  const p = s?.villageRationPct;
  return typeof p === 'number' && p >= 0 ? p : RATION_PCT_DEFAULT;
};
export const leavePct = (s: any): number => {
  const p = s?.villageLeavePct;
  return typeof p === 'number' && p >= 0 ? p : LEAVE_PCT_DEFAULT;
};

/** Razioni che il villaggio consuma in una settimana: la quota giornaliera
 *  degli abitanti, per i sei giorni che separano due mercati. */
export function weeklyNeed(pop: number, pct: number): number {
  return Math.round(Math.max(0, pop) * Math.max(0, pct) / 100 * DAYS_PER_WEEK);
}

/** Lo stato della dispensa dopo l'ultimo mercato. */
export interface HungerState {
  streak: number;      // mercati consecutivi non coperti: 1 = penuria, 2+ = carestia
  abs?: number;        // giorno dell'ultimo conto
  need?: number;       // razioni richieste all'ultimo conto
  eaten?: number;      // razioni effettivamente consumate
}

export const hungerLabel = (streak: number): string | null =>
  streak <= 0 ? null : streak === 1 ? 'Penuria' : 'Carestia';

/** Esito del conto di un mercato: quanto si mangia, e chi parte. */
export function settleWeek(pop: number, have: number, pct: number, leave: number, streak: number):
  { need: number; eaten: number; streak: number; left: number } {
  const need = weeklyNeed(pop, pct);
  if (need <= 0 || have >= need) return { need, eaten: need, streak: 0, left: 0 };
  const next = streak + 1;
  // La prima settimana scoperta è penuria: si stringe la cinghia e nessuno
  // parte. Dalla seconda consecutiva è carestia, e la gente se ne va.
  const left = next >= 2 ? Math.min(pop, Math.max(1, Math.round(pop * leave / 100))) : 0;
  return { need, eaten: Math.max(0, have), streak: next, left };
}
