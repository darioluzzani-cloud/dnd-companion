/**
 * Alloggiamenti dell'equipaggiamento indossato (paper doll).
 *
 * Un oggetto ha due proprietà distinte e indipendenti:
 *   - `subtype`  → che cosa è (elmo, mantello, anello, scudo, arma magica…)
 *   - `slot`     → dove è collocato adesso sulla sagoma
 *
 * L'assegnazione dell'alloggiamento è sempre manuale: la sagoma propone
 * gli oggetti compatibili, ma consente di forzarne uno qualsiasi, così
 * l'inventario preesistente (privo di sottocategoria) non resta bloccato.
 */

export type SlotId =
  | 'elmo' | 'mantello' | 'parabracci' | 'vesti' | 'stivali' | 'armatura'
  | 'mano1' | 'mano2'
  | 'magico1' | 'magico2' | 'magico3'
  | 'consum1' | 'consum2' | 'consum3';

export interface SlotDef {
  id: SlotId;
  label: string;
  shape: 'square' | 'circle';
  size: 'sm' | 'lg' | 'xl';
}

/** Sottocategorie di `equipaggiamento` — governano gli alloggiamenti del corpo. */
export const EQUIP_SUBTYPES = ['elmo', 'mantello', 'parabracci', 'vesti', 'stivali', 'anello'];

/** Sottocategorie di `arma` — l'arma a due mani occupa entrambe le impugnature. */
export const ARMA_SUBTYPES = ['a una mano', 'a due mani'];

/**
 * Foggie dell'armatura. Non compaiono fra le sottocategorie perché l'armatura
 * dispone già del proprio campo `armorType`, collegato al calcolo della CA:
 * lo scudo si dichiara lì, e `armorKind` legge indifferentemente i due campi.
 */
export const ARMOR_SUBTYPES = ['leggera', 'media', 'pesante', 'scudo'];

/** Sottocategorie di `magico` — un'arma magica va nelle mani, non fra i monili. */
export const MAGIC_SUBTYPES = ['arma', 'mantello', 'anello', 'amuleto', 'altro'];

/** Sottocategorie disponibili per una data categoria principale (vuoto = nessuna). */
export function subtypesFor(type: string): string[] {
  if (type === 'equipaggiamento') return EQUIP_SUBTYPES;
  if (type === 'magico') return MAGIC_SUBTYPES;
  if (type === 'arma') return ARMA_SUBTYPES;
  return [];
}

/** Foggia dell'armatura: legge la sottocategoria, con ricaduta sul vecchio campo armorType. */
export function armorKind(item: { subtype?: string; armorType?: string }): string | undefined {
  return item.subtype || item.armorType;
}

/** Uno scudo, comunque sia stato catalogato in passato. */
export function isShield(item: { type: string; subtype?: string; armorType?: string }): boolean {
  if (item.type === 'armatura') return armorKind(item) === 'scudo';
  return item.type === 'equipaggiamento' && item.subtype === 'scudo';  // retrocompatibilità
}

/** Arma che richiede entrambe le mani. */
export function isTwoHanded(item: { type: string; subtype?: string }): boolean {
  return (item.type === 'arma' || item.type === 'unico' || item.type === 'magico') && item.subtype === 'a due mani';
}

export const SLOTS: SlotDef[] = [
  { id: 'parabracci', label: 'Parabracci', shape: 'square', size: 'sm' },
  { id: 'elmo',       label: 'Elmo',       shape: 'square', size: 'sm' },
  { id: 'mantello',   label: 'Mantello',   shape: 'square', size: 'sm' },
  { id: 'vesti',      label: 'Vesti',      shape: 'square', size: 'sm' },
  { id: 'mano1',      label: 'Mano principale', shape: 'square', size: 'lg' },
  { id: 'armatura',   label: 'Armatura',   shape: 'square', size: 'xl' },
  { id: 'mano2',      label: 'Mano secondaria', shape: 'square', size: 'lg' },
  { id: 'stivali',    label: 'Stivali',    shape: 'square', size: 'sm' },
  { id: 'magico1',    label: 'Oggetto magico', shape: 'circle', size: 'sm' },
  { id: 'magico2',    label: 'Oggetto magico', shape: 'circle', size: 'sm' },
  { id: 'magico3',    label: 'Oggetto magico', shape: 'circle', size: 'sm' },
  { id: 'consum1',    label: 'Consumabile', shape: 'square', size: 'sm' },
  { id: 'consum2',    label: 'Consumabile', shape: 'square', size: 'sm' },
  { id: 'consum3',    label: 'Consumabile', shape: 'square', size: 'sm' },
];

export const SLOT_BY_ID: Record<string, SlotDef> = Object.fromEntries(SLOTS.map(s => [s.id, s]));

/** Un'arma impugnabile: arma comune, arma magica, o oggetto unico. */
function isWieldable(type: string, subtype?: string): boolean {
  return type === 'arma' || type === 'unico' || (type === 'magico' && subtype === 'arma');
}

/**
 * L'oggetto è idoneo all'alloggiamento? Regole concordate:
 *   mani     → arma, unico, magico-arma; la secondaria accetta anche lo scudo
 *   magico   → qualunque magico, più equipaggiamento-anello
 *   corpo    → equipaggiamento con la sottocategoria corrispondente
 *   armatura → categoria armatura
 *   consum.  → categoria consumabile
 */
export function slotAccepts(slotId: string, item: { type: string; subtype?: string; armorType?: string }): boolean {
  const { type, subtype } = item;
  switch (slotId) {
    case 'mano1': return isWieldable(type, subtype);
    case 'mano2': return isWieldable(type, subtype) || isShield(item);
    case 'armatura': return type === 'armatura' && armorKind(item) !== 'scudo';
    case 'magico1': case 'magico2': case 'magico3':
      return (type === 'magico' && subtype !== 'arma' && subtype !== 'mantello')
          || (type === 'equipaggiamento' && subtype === 'anello');
    case 'consum1': case 'consum2': case 'consum3':
      return type === 'consumabile';
    case 'elmo': case 'mantello': case 'parabracci': case 'vesti': case 'stivali':
      return (type === 'equipaggiamento' || type === 'magico') && subtype === slotId;
    default: return false;
  }
}

/** Numero massimo di oggetti a cui un personaggio può essere sintonizzato. */
export const ATTUNE_MAX = 3;

/** Quante sintonie il personaggio ha in atto. */
export function attunedCount(inventory?: any[]): number {
  return (inventory || []).filter(it => it.attuned).length;
}

/** L'oggetto esige la sintonia? */
export function needsAttunement(item?: { attunement?: boolean }): boolean {
  return !!item?.attunement;
}
