import { hasWear } from '@/lib/dnd/equipment';
import { paysGold } from '@/lib/dnd/catalog';

// ─── RIPARAZIONE IMMEDIATA ALLA FUCINA ───────────────────────
// Il lavoro di Durna sui Punti Usura non passa dall'incudine a giornate:
// l'avventuriero porta l'oggetto, sceglie quanti punti togliere e paga sul
// banco con le Monete d'oro del proprio inventario. La tariffa è quella
// della tabella dei servizi: 2 mo per punto, il doppio sugli oggetti magici
// e sugli unici. Il DM può ritoccare le due tariffe dagli strumenti della
// fucina; restano in una chiave propria, che soltanto lui scrive.

export interface RepairRates { base: number; magic: number; }

export const DEFAULT_REPAIR_RATES: RepairRates = { base: 2, magic: 4 };

/** Categorie che pagano la tariffa maggiorata. */
const MAGIC_TYPES = ['magico', 'unico'];

export function repairRates(s: any): RepairRates {
  const r = (s?.repairRates || {}) as Partial<RepairRates>;
  const ok = (n: unknown, d: number) => (typeof n === 'number' && n >= 0 ? Math.floor(n) : d);
  return { base: ok(r.base, DEFAULT_REPAIR_RATES.base), magic: ok(r.magic, DEFAULT_REPAIR_RATES.magic) };
}

/** Monete d'oro per un Punto Usura di questo oggetto. */
export function repairRate(s: any, item: { type?: string }): number {
  const r = repairRates(s);
  return MAGIC_TYPES.includes(item?.type || '') ? r.magic : r.base;
}

export const wearOf = (item: any): number => Math.max(0, Math.floor(item?.pu || 0));

/** Gli oggetti del personaggio che hanno usura da togliere. */
export function wornItems(player: any, dmMode: boolean): any[] {
  return (player?.inventory || []).filter((it: any) =>
    hasWear(it) && wearOf(it) > 0 && (dmMode || it.revealed !== false));
}

/** Costo di `n` punti tolti, entro l'usura che l'oggetto porta davvero. */
export function repairCost(s: any, item: any, n: number): number {
  const k = Math.max(0, Math.min(Math.floor(n), wearOf(item)));
  return k * repairRate(s, item);
}

/** Quanti punti il personaggio può permettersi su questo oggetto. */
export function affordablePoints(s: any, item: any, gold: number): number {
  const rate = repairRate(s, item);
  if (rate <= 0) return wearOf(item);
  return Math.max(0, Math.min(wearOf(item), Math.floor(gold / rate)));
}

/**
 * Toglie `n` Punti Usura dall'oggetto e scala le monete. Restituisce il
 * nuovo inventario con quanto speso, oppure null se l'oggetto non c'è più,
 * non ha usura o le monete non bastano: si lavora sempre sullo stato più
 * recente, e un secondo tocco sullo stesso pulsante non fa pagare due volte
 * un'usura già tolta.
 */
export function applyRepair(s: any, player: any, itemId: string, n: number):
  { inventory: any[]; points: number; cost: number } | null {
  const item = (player?.inventory || []).find((it: any) => it.id === itemId);
  if (!item || !hasWear(item)) return null;
  const points = Math.max(0, Math.min(Math.floor(n), wearOf(item)));
  if (points <= 0) return null;
  const cost = points * repairRate(s, item);
  const paid = cost > 0 ? paysGold(player, cost) : (player.inventory || []);
  if (!paid) return null;
  const inventory = paid.map((it: any) => it.id === itemId ? { ...it, pu: wearOf(it) - points } : it);
  return { inventory, points, cost };
}
