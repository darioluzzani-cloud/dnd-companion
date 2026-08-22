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
  kind: 'forge' | 'tannery';
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
 * `mode` 'shop' = una commessa alla volta per l'intera bottega (predefinito:
 * un artigiano, un banco); 'player' = una commessa per personaggio.
 */
export function shopBusy(s: any, kind: CraftJob['kind'], playerId: string): CraftJob | null {
  const mode = (s?.craftMode as 'shop' | 'player') || 'shop';
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

export interface TanneryRecipe {
  id: string;
  fromName: string;
  fromQty: number;
  toName: string;
  toQty: number;
  days: number;
  note?: string;
}

export const DEFAULT_TANNERY: TanneryRecipe[] = [
  { id: 'tan-cuoio', fromName: 'Pelliccia', fromQty: 2, toName: 'Cuoio', toQty: 1, days: 3,
    note: 'La pelle va scarnita, messa in bagno e tirata: tre giorni senza scorciatoie.' },
];

export const tanneryRecipesOf = (s: any): TanneryRecipe[] => {
  const list = s?.tanneryRecipes;
  return Array.isArray(list) && list.length ? list : DEFAULT_TANNERY;
};
