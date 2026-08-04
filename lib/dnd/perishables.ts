import { VelmoraDate, absDay, addDays, formatDateShort } from '@/lib/dnd/calendar';

// ─── PREPARATI DEPERIBILI — IL MODELLO A LOTTI ───────────────
// Regola unica del tavolo: decotti e impacchi durano due giorni. Preparato
// l'8 del Gelo, un infuso è ancora buono il 9 e sparisce il 10.
//
// La prima stesura creava una voce d'inventario per ogni giornata di
// preparazione. Corretta sul piano della scadenza, ingolfava però lo zaino
// di omonimi. Qui la voce resta UNA per preparato, e dentro di sé porta i
// propri lotti: ciascuno con la sua data e la sua scorta. Poiché la vita
// utile è di due giorni, i lotti compresenti non possono essere più di due,
// e i due riquadri della scheda bastano a rappresentarli tutti.
//
// `qty` continua a esistere sull'oggetto come somma dei lotti, perché
// tessere, sagoma, mercato e ricettario la leggono: è un valore derivato,
// mai la fonte. Ogni scrittura passa da `withBatches`, che lo ricalcola.

export const PERISH_DAYS = 2;

/** Numero di lotti compresenti che la scheda rappresenta con un riquadro. */
export const BATCH_SLOTS = 2;

export interface Batch {
  madeOn: number;   // giorno assoluto di preparazione
  qty: number;      // dosi residue del lotto
}

export function isPerishable(it: any): boolean {
  return !!it?.perishable;
}

/**
 * Lotti dell'oggetto, dal più vecchio al più recente — l'ordine in cui
 * vanno consumati. Regge anche i dati della stesura precedente, dove la
 * data stava sull'oggetto e non su un lotto.
 */
export function batchesOf(it: any): Batch[] {
  if (Array.isArray(it?.batches)) {
    return [...it.batches].filter((b: Batch) => b && typeof b.madeOn === 'number').sort((a, b) => a.madeOn - b.madeOn);
  }
  if (isPerishable(it) && typeof it?.madeOn === 'number') {
    return [{ madeOn: it.madeOn, qty: it.qty ?? 0 }];
  }
  return [];
}

/** Riscrive i lotti sull'oggetto scartando i vuoti e riallineando `qty`. */
export function withBatches(it: any, batches: Batch[]): any {
  const clean = batches.filter(b => b.qty > 0).sort((a, b) => a.madeOn - b.madeOn);
  const next = { ...it, batches: clean, qty: clean.reduce((n, b) => n + b.qty, 0) };
  delete next.madeOn;   // il campo della vecchia stesura non serve più
  return next;
}

/** Aggiunge dosi al lotto del giorno indicato, creandolo se non esiste. */
export function addDose(it: any, madeOn: number, n = 1): any {
  const batches = batchesOf(it);
  const found = batches.find(b => b.madeOn === madeOn);
  return withBatches(it, found
    ? batches.map(b => b.madeOn === madeOn ? { ...b, qty: b.qty + n } : b)
    : [...batches, { madeOn, qty: n }]);
}

/** Consuma dosi da un lotto preciso. */
export function consumeDose(it: any, madeOn: number, n = 1): any {
  return withBatches(it, batchesOf(it).map(b => b.madeOn === madeOn ? { ...b, qty: Math.max(0, b.qty - n) } : b));
}

/** Primo giorno in cui il lotto non è più utilizzabile. */
export const batchExpiry = (b: Batch) => b.madeOn + PERISH_DAYS;

/** Giorni residui: 1 = scade domani, <=0 = già guasto. */
export const batchDaysLeft = (b: Batch, today: VelmoraDate) => batchExpiry(b) - absDay(today);

export function batchLabel(b: Batch, today: VelmoraDate): { made: string; left: number; text: string } {
  const left = batchDaysLeft(b, today);
  const made = formatDateShort(addDays({ year: 0, month: 1, day: 1 }, b.madeOn)).replace(/ · .*$/, '');
  const text = left <= 0 ? 'guasto' : left === 1 ? 'scade domani' : `ancora ${left} giorni`;
  return { made, left, text };
}

/** Giorni residui del lotto più prossimo alla scadenza (per le tessere). */
export function soonestLeft(it: any, today: VelmoraDate): number | null {
  const bs = batchesOf(it);
  if (!bs.length) return null;
  return Math.min(...bs.map(b => batchDaysLeft(b, today)));
}

/**
 * Scarta i lotti guasti dagli inventari di tutti i personaggi. La voce
 * resta, svuotata: conserva immagine, descrizione e ricetta, e tornerà a
 * riempirsi alla prossima preparazione senza che nulla si accumuli.
 */
export function sweepExpired(players: any[], today: VelmoraDate): { players: any[]; removed: { player: string; name: string; doses: number }[] } {
  const removed: { player: string; name: string; doses: number }[] = [];
  const nextPlayers = players.map(pl => {
    let touched = false;
    const inv = (pl.inventory || []).map((it: any) => {
      if (!isPerishable(it)) return it;
      const batches = batchesOf(it);
      const dead = batches.filter(b => batchDaysLeft(b, today) <= 0);
      if (!dead.length) return it;
      touched = true;
      removed.push({ player: pl.short || pl.name, name: it.name, doses: dead.reduce((n, b) => n + b.qty, 0) });
      return withBatches(it, batches.filter(b => batchDaysLeft(b, today) > 0));
    });
    return touched ? { ...pl, inventory: inv } : pl;
  });
  return { players: nextPlayers, removed };
}
