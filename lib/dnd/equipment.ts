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
export const EQUIP_SUBTYPES = ['elmo', 'mantello', 'parabracci', 'vesti', 'stivali', 'scudo', 'anello'];

/** Sottocategorie di `magico` — un'arma magica va nelle mani, non fra i monili. */
export const MAGIC_SUBTYPES = ['arma', 'anello', 'amuleto', 'altro'];

/** Sottocategorie disponibili per una data categoria principale (vuoto = nessuna). */
export function subtypesFor(type: string): string[] {
  if (type === 'equipaggiamento') return EQUIP_SUBTYPES;
  if (type === 'magico') return MAGIC_SUBTYPES;
  return [];
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
export function slotAccepts(slotId: string, item: { type: string; subtype?: string }): boolean {
  const { type, subtype } = item;
  switch (slotId) {
    case 'mano1': return isWieldable(type, subtype);
    case 'mano2': return isWieldable(type, subtype) || (type === 'equipaggiamento' && subtype === 'scudo');
    case 'armatura': return type === 'armatura';
    case 'magico1': case 'magico2': case 'magico3':
      return type === 'magico' || (type === 'equipaggiamento' && subtype === 'anello');
    case 'consum1': case 'consum2': case 'consum3':
      return type === 'consumabile';
    case 'elmo': case 'mantello': case 'parabracci': case 'vesti': case 'stivali':
      return type === 'equipaggiamento' && subtype === slotId;
    default: return false;
  }
}
