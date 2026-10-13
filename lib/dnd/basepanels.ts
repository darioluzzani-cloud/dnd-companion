// ─── DISPOSIZIONE DELLA TAB BASE ─────────────────────────────
// Nome e ordine dei riquadri della tab Base sono dati della campagna, non
// del dispositivo: il DM li decide una volta e valgono per tutti. Si
// conservano soltanto le scelte fatte — un nome cambiato, un ordine diverso
// da quello di partenza —, così un riquadro aggiunto in una versione futura
// compare da sé, in coda, senza che nessuno debba metterlo in elenco.

export const BASE_PANELS = ['store', 'people', 'forge', 'tannery', 'tavern', 'market', 'library', 'village'] as const;
export type BasePanelId = typeof BASE_PANELS[number];

export interface BasePanels {
  order?: string[];                  // ordine scelto dal DM (identificativi)
  titles?: Record<string, string>;   // nomi cambiati dal DM; assente = nome di partenza
}

const panelsOf = (s: any): BasePanels => (s?.basePanels || {}) as BasePanels;

/** L'ordine in cui disporre i riquadri: quello scelto, più i riquadri che
 *  la scelta non conosce ancora, nell'ordine di partenza. */
export function panelOrder(s: any): string[] {
  const known = new Set<string>(BASE_PANELS);
  const chosen = (panelsOf(s).order || []).filter(id => known.has(id));
  return [...chosen, ...BASE_PANELS.filter(id => !chosen.includes(id))];
}

/** Il riquadro compare? Oggi l'unico che può mancare è la Biblioteca, che
 *  esiste soltanto se il villaggio ne ha l'edificio. */
export function panelShown(s: any, id: string): boolean {
  if (id === 'library') return ((s?.buildings || []) as any[]).some(b => /bibliotec/i.test(b.name || ''));
  return true;
}

export function panelTitle(s: any, id: string, fallback: string): string {
  const t = panelsOf(s).titles?.[id];
  return t && t.trim() ? t : fallback;
}

/** Nuovi nomi: una stringa vuota restituisce al riquadro il nome di partenza. */
export function withTitle(s: any, id: string, title: string): BasePanels {
  const cur = panelsOf(s);
  const titles = { ...(cur.titles || {}) };
  if (title.trim()) titles[id] = title.trim(); else delete titles[id];
  return { ...cur, titles };
}

/** Sposta un riquadro di un posto, scavalcando quelli che non compaiono:
 *  spostare la Fucina sopra una Biblioteca che non c'è non deve sembrare
 *  un comando a vuoto. */
export function withMove(s: any, id: string, dir: -1 | 1): BasePanels {
  const order = panelOrder(s);
  const i = order.indexOf(id);
  if (i < 0) return panelsOf(s);
  let j = i + dir;
  while (j >= 0 && j < order.length && !panelShown(s, order[j])) j += dir;
  if (j < 0 || j >= order.length) return panelsOf(s);
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return { ...panelsOf(s), order: next };
}

/** Il riquadro è il primo o l'ultimo fra quelli che compaiono? */
export function panelEdge(s: any, id: string): { first: boolean; last: boolean } {
  const shown = panelOrder(s).filter(x => panelShown(s, x));
  return { first: shown[0] === id, last: shown[shown.length - 1] === id };
}
