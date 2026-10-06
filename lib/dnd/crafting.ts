import { absDay } from '@/lib/dnd/calendar';

// ─── LAVORAZIONI A TEMPO ─────────────────────────────────────
// Modello condiviso da fucina e conceria, costruito sullo stesso schema del
// cantiere degli edifici: si registra il giorno d'avvio e la durata, e il
// tempo scorre col calendario invece che con un contatore proprio. Nessun
// orologio nell'app, nessuna sincronizzazione da mantenere: la data è già
// un dato condiviso, e basta sottrarre.
//
// La commessa resta in coda finché qualcuno non la ritira: il completamento
// non è automatico. È deliberato — l'oggetto esce dalla bottega quando un
// personaggio va a riprenderlo, e questo dà al DM un momento di scena.

export interface CraftJob {
  id: string;
  kind: 'forge' | 'tannery' | 'tavern';
  playerId: string;
  startAbs: number;      // giorno assoluto d'avvio
  days: number;          // giornate di lavorazione
  /** Fucina: oggetto da potenziare e lavoro scelto. */
  itemId?: string;
  itemName?: string;
  upgradeId?: string;
  upgradeName?: string;
  /** Conceria: ricetta di conversione. */
  recipeId?: string;
  fromName?: string;
  fromQty?: number;
  toName?: string;
  toQty?: number;
}

export const jobsOf = (s: any, kind: CraftJob['kind']): CraftJob[] =>
  ((s?.craftJobs || []) as CraftJob[]).filter(j => j.kind === kind);

export function jobProgress(job: CraftJob, today: any) {
  if (!today) return { elapsed: 0, pct: 0, done: false, remaining: job.days };
  const elapsed = Math.max(0, absDay(today) - job.startAbs);
  const done = elapsed >= job.days;
  return {
    elapsed,
    pct: job.days > 0 ? Math.min(100, Math.round((elapsed / job.days) * 100)) : 100,
    done,
    remaining: Math.max(0, job.days - elapsed),
  };
}

/**
 * La bottega accetta un nuovo lavoro?
 * `mode` 'player' (predefinito) = una commessa per personaggio, che è la
 * regola del tavolo: ciascuno affida a Durna un lavoro alla volta, e non
 * si fa la fila. 'shop' = una sola commessa per l'intera bottega, più
 * verosimile ma più scomodo, resta disponibile dall'interruttore del DM.
 */
export function shopBusy(s: any, kind: CraftJob['kind'], playerId: string): CraftJob | null {
  const mode = (s?.craftMode as 'shop' | 'player') || 'player';
  const list = jobsOf(s, kind);
  if (mode === 'player') return list.find(j => j.playerId === playerId) || null;
  return list[0] || null;
}

/** Aggiunge o rimuove una commessa dallo stato, senza toccare le altre. */
export const withJob = (s: any, job: CraftJob) => ({ craftJobs: [...((s?.craftJobs || []) as CraftJob[]), job] });
export const withoutJob = (s: any, jobId: string) => ({ craftJobs: ((s?.craftJobs || []) as CraftJob[]).filter(j => j.id !== jobId) });

// ─── Conceria ────────────────────────────────────────────────
// Una ricetta converte un materiale in un altro: pelliccia in cuoio, e
// qualunque altra trasformazione il DM voglia aggiungere.

export interface TanIngredient { name: string; qty: number; }

export interface TanneryRecipe {
  id: string;
  /** Ingredienti: fino a tre, come in fucina. */
  inputs?: TanIngredient[];
  /** Forma antica a ingrediente singolo: conservata e letta. */
  fromName?: string;
  fromQty?: number;
  toName: string;
  toQty: number;
  days: number;
  note?: string;
}

/** Ingredienti in forma normalizzata, qualunque sia la stesura della voce. */
export function tanInputs(r?: TanneryRecipe): TanIngredient[] {
  if (!r) return [];
  if (r.inputs && r.inputs.length) return r.inputs.filter(i => i.name && i.name.trim());
  if (r.fromName) return [{ name: r.fromName, qty: r.fromQty || 1 }];
  return [];
}

export const DEFAULT_TANNERY: TanneryRecipe[] = [
  { id: 'tan-cuoio', inputs: [{ name: 'Pelliccia', qty: 2 }, { name: 'Corteccia di Larice', qty: 1 }],
    toName: 'Cuoio', toQty: 1, days: 3,
    note: 'La pelle va scarnita, messa a bagno nel tannino di larice e tirata sul telaio: tre giorni senza scorciatoie.' },
];

export const tanneryRecipesOf = (s: any): TanneryRecipe[] => {
  const list = s?.tanneryRecipes;
  return Array.isArray(list) && list.length ? list : DEFAULT_TANNERY;
};

// ─── Taverna: bevande ────────────────────────────────────────
// La taverna lavora come la conceria — ingredienti che entrano, una bevanda
// che esce dopo qualche giornata — e ne condivide la forma delle ricette.
// Non ha lavorazioni di partenza: le bevande sono voci d'armeria, e il
// catalogo lo scrive il DM scegliendole da lì.

export const tavernRecipesOf = (s: any): TanneryRecipe[] => {
  const list = s?.tavernRecipes;
  return Array.isArray(list) ? list : [];
};

// ─── RENDITA DELLA TAVERNA ───────────────────────────────────
// La taverna di Olmobianco frutta, e la quota spetta ai quattro che il
// villaggio l'hanno liberato. Il pagamento è legato al giorno di mercato —
// il sesto della settimana velmorana — perché è quando i conti si fanno.
//
// Il punto delicato è l'idempotenza: avanzando e tornando indietro col
// calendario la rendita non deve pagarsi due volte. Per questo si registra
// l'ultimo giorno pagato e si contano i giorni di mercato scavalcati.

export const TAVERN_WEEKLY_DEFAULT = 7;

export function tavernBuilding(s: any): any | undefined {
  return ((s?.buildings || []) as any[]).find(b => /tavern|osteri|locand/i.test(b.name || ''));
}
