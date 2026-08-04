import { VelmoraDate, absDay, addDays, formatDate } from '@/lib/dnd/calendar';

// ─── PREPARATI DEPERIBILI ────────────────────────────────────
// Regola unica del tavolo: decotti e impacchi durano due giorni. Preparato
// l'8 del Gelo, un infuso è ancora buono il 9 e sparisce il 10.
//
// La scadenza è impressa sull'oggetto (`madeOn`), non tenuta da un registro
// del calendario. È la scelta che risolve da sola il caso che temevi: due
// decotti omonimi preparati in giorni diversi sono due voci distinte
// dell'inventario, ciascuna con la propria data, e non possono svanire
// insieme. Al calendario resta solo il compito di innescare la spazzata
// quando la data avanza.

export const PERISH_DAYS = 2;

export function isPerishable(it: any): boolean {
  return !!it?.perishable && typeof it?.madeOn === 'number';
}

/** Primo giorno assoluto in cui il preparato non è più utilizzabile. */
export function expiryDay(it: any): number | null {
  return isPerishable(it) ? it.madeOn + PERISH_DAYS : null;
}

/** Giorni residui: 0 = scade stanotte, ≤0 = già guasto. */
export function daysLeft(it: any, today: VelmoraDate): number | null {
  const exp = expiryDay(it);
  return exp === null ? null : exp - absDay(today);
}

/** Dicitura per la scheda dell'oggetto. */
export function perishLabel(it: any, today: VelmoraDate): string | null {
  const left = daysLeft(it, today);
  if (left === null) return null;
  const when = formatDate(addDays({ year: 0, month: 1, day: 1 }, expiryDay(it)!));
  if (left <= 0) return 'Guasto — verrà scartato al prossimo giorno';
  if (left === 1) return 'Scade domani';
  return `Ancora buono per ${left} giorni (fino al ${when.replace(/, \d+ d\.V\.$/, '')})`;
}

/**
 * Scarta i preparati guasti dagli inventari di tutti i personaggi.
 * Restituisce la nuova lista e quante voci sono state tolte, così che
 * l'interfaccia possa dirlo invece di far sparire le cose in silenzio.
 */
export function sweepExpired(players: any[], today: VelmoraDate): { players: any[]; removed: { player: string; name: string }[] } {
  const removed: { player: string; name: string }[] = [];
  const nextPlayers = players.map(pl => {
    const inv = (pl.inventory || []).filter((it: any) => {
      const left = daysLeft(it, today);
      if (left !== null && left <= 0) { removed.push({ player: pl.short || pl.name, name: it.name }); return false; }
      return true;
    });
    return inv.length === (pl.inventory || []).length ? pl : { ...pl, inventory: inv };
  });
  return { players: nextPlayers, removed };
}
