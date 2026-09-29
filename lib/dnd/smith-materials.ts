// ─── MATERIALI DI FUCINA ─────────────────────────────────────
// I lavori di Durna si pagano con materiali che esistono in armeria — la
// stessa dispensa da cui pescano conceria e mercato — e non con nomi
// battuti a mano nella ricetta. Un materiale d'armeria ha scheda,
// descrizione e illustrazione: quando compare in un inventario è un
// oggetto riconoscibile, non una stringa.
//
// L'armeria della Marca è già ricca: dodici voci «altro» e quattordici
// «alchemico». Il catalogo qui sotto NON le duplica — aggiunge soltanto le
// poche che mancavano per far quadrare le ricette esistenti, perché ogni
// materiale nuovo costa al DM un oggetto da comporre, un'immagine da
// generare e una descrizione da scrivere.

export interface SmithMaterialDef {
  name: string;
  type: 'altro' | 'alchemico';
  desc: string;
  effect?: string;
  tier: 'base' | 'avanzato' | 'nanico';
}

export const SMITH_MATERIALS: SmithMaterialDef[] = [
  { name: 'Pelliccia', type: 'altro', tier: 'base',
    effect: 'Materia grezza · si concia in cuoio',
    desc: 'Pelle non lavorata, ancora col pelo. Due bastano a foderare un corsetto, e altrettante a Mezzaluna per ricavarne cuoio. Cruda dura poche settimane prima di irrigidirsi e puzzare.' },
  { name: 'Ferraccio', type: 'altro', tier: 'base',
    effect: 'Materia grezza · ferro comune',
    desc: 'Ferro di recupero: chiodi storti, cerchioni di botte, ferri di cavallo consumati fino alla suola. Ribattuto e ripiegato tre volte diventa acciaio onesto, buono per ogni lavoro che non chieda finezza. Si trova ovunque ci sia stato un villaggio.' },
  { name: 'Carbone di faggio', type: 'altro', tier: 'base',
    effect: 'Combustibile da forgia',
    desc: 'Carbone da carbonaia, cotto lento sotto la terra per sei giorni. Brucia più a lungo del legno e più pulito della torba: senza, la forgia non arriva al rosso ciliegia, e sotto quel colore il metallo non si lascia piegare.' },
  { name: 'Tendine essiccato', type: 'altro', tier: 'base',
    effect: 'Legatura · si stringe asciugando',
    desc: 'Tendine di cervo o di alce, seccato al vento e battuto finché non si sfilaccia in filamenti. Si avvolge bagnato e si stringe asciugandosi: quello che lega, non si slega più senza tagliarlo.' },
  { name: 'Quarzo grezzo', type: 'altro', tier: 'avanzato',
    effect: 'Pietra non magica · regge l\'incisione',
    desc: 'Cristallo di fiume, lattiginoso e pieno di velature. Non vale nulla come gemma e molto come supporto: il quarzo regge l\'incisione senza sbeccarsi, ed è questo che serve a chi deve scrivere sulla pietra invece che sull\'oro.' },
  { name: 'Limatura runica', type: 'altro', tier: 'nanico',
    effect: 'Polvere di pietra incisa · rara',
    desc: 'Polvere raccolta sotto lo scalpello di chi incide pietra già incisa, e conservata in un corno tappato. Non è magia: è pietra che ricorda di essere stata scritta, e in lega tiene la forma che le si dà invece di cercarne una propria. Se ne ottiene un pizzico per giornata di lavoro.' },
];

export const MATERIAL_TYPES = ['altro', 'alchemico'];

const norm = (n?: string) => (n || '').trim().toLowerCase();

/** Materiali del catalogo che mancano ancora dall'armeria. */
export function missingMaterials(s: any): SmithMaterialDef[] {
  const have = new Set(((s?.armory || []) as any[]).map(e => norm(e.name)));
  return SMITH_MATERIALS.filter(m => !have.has(norm(m.name)));
}

/**
 * Voci d'armeria utilizzabili come materiale: quelle delle due categorie di
 * riferimento. È da qui che la redazione delle ricette pesca, invece di
 * lasciare che il nome venga digitato e sbagliato.
 */
export function armoryMaterials(s: any): any[] {
  return ((s?.armory || []) as any[])
    .filter(e => MATERIAL_TYPES.includes(e.type))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
