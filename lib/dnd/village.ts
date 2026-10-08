import { isMarketAbs, DAYS_PER_WEEK } from '@/lib/dnd/calendar';
import { Tally, HungerState, tallyOf, addTo, rationEntry, rationPct, leavePct, settleWeek } from '@/lib/dnd/storehouse';

// ─── GLI ABITANTI DI OLMOBIANCO ──────────────────────────────
// Primo passo del gestionale: quanta gente vive nel villaggio e come
// cresce. La popolazione è un numero solo; i volti che contano sono voci
// del registro dei PNG, marcate come residenti, e non un'anagrafe a parte.
//
// Ogni due mercati il calendario tira 3d4 di nascosto. Il risultato,
// moltiplicato per il fattore del livello corrente delle case, è la gente
// che si aggiunge, fino alla capienza di quel livello. Se il tiro nudo dà
// fra 10 e 12, dal mazzo dei forestieri si presenta un notabile, che i
// giocatori possono integrare o respingere.
//
// Chi scrive che cosa — il salvataggio procede per chiave:
//   villagePop, villageLedger — il calendario e gli strumenti del DM
//   villageGate               — il calendario aggiunge, i giocatori tolgono
//   villageResidents, villageDismissed — l'esito della scelta dei giocatori

/** Capienza e fattore di crescita di un livello delle case. */
export interface HousingRow { cap: number; mult: number; }

/** Progressione proposta verso i 1500–1600 abitanti. Il DM la riscrive
 *  dagli strumenti del riquadro; qui stanno soltanto i valori di partenza. */
export const DEFAULT_HOUSING: HousingRow[] = [
  { cap: 12,   mult: 0 },
  { cap: 30,   mult: 1 },
  { cap: 60,   mult: 1 },
  { cap: 150,  mult: 2 },
  { cap: 350,  mult: 4 },
  { cap: 750,  mult: 8 },
  { cap: 1600, mult: 16 },
];

export interface VillageGateEntry { npcId: string; sinceAbs: number; }

export interface GrowthRoll {
  abs: number;          // giorno assoluto del tiro
  dice: number[];       // i tre d4
  mult: number;
  gained: number;       // abitanti effettivamente aggiunti, dopo la capienza
  notable?: string;     // id del PNG presentatosi, se il tiro lo ha chiamato
}

export interface VillageLedger {
  /** Tacca d'alta marea: il giorno più avanzato già elaborato. */
  mark?: number;
  /** L'ultimo tiro di crescita, per il riepilogo del DM. */
  last?: GrowthRoll;
  /** Bonus e malus già visti all'opera: PNG → attività in cui ha lavorato
   *  una settimana intera. Una volta noti, restano noti. */
  known?: Record<string, string[]>;
  /** Stato della dispensa dopo l'ultimo mercato: penuria e carestia. */
  hunger?: HungerState;
}

/** Soglia del tiro nudo oltre la quale si presenta un notabile. */
export const NOTABLE_MIN = 10;

// ─── Letture ─────────────────────────────────────────────────

export const popOf = (s: any): number => Math.max(0, Math.floor(s?.villagePop || 0));
export const ledgerOf = (s: any): VillageLedger => (s?.villageLedger || {}) as VillageLedger;
export const gateOf = (s: any): VillageGateEntry[] =>
  (Array.isArray(s?.villageGate) ? s.villageGate : []) as VillageGateEntry[];
export const residentIds = (s: any): string[] =>
  (Array.isArray(s?.villageResidents) ? s.villageResidents : []) as string[];
export const dismissedIds = (s: any): string[] =>
  (Array.isArray(s?.villageDismissed) ? s.villageDismissed : []) as string[];

const npcById = (s: any, id: string): any | undefined =>
  ((s?.characters || []) as any[]).find(c => c.id === id);

/** I residenti con un nome, nell'ordine in cui sono stati stabiliti. */
export const residentsOf = (s: any): any[] => residentIds(s).map(id => npcById(s, id)).filter(Boolean);

/** Il mazzo: PNG preparati dal DM, non ancora arrivati né respinti. */
export function deckOf(s: any): any[] {
  const out = new Set([...residentIds(s), ...dismissedIds(s), ...gateOf(s).map(g => g.npcId)]);
  return ((s?.characters || []) as any[]).filter(c => c.inDeck && !out.has(c.id));
}

/** L'edificio delle case: quello scelto dal DM, altrimenti il primo il cui
 *  nome parli di abitazioni o di case. */
export function housingBuilding(s: any): any | undefined {
  const list = (s?.buildings || []) as any[];
  return list.find(b => b.id === s?.villageHousingId) || list.find(b => /abitazion|\bcase\b/i.test(b.name || ''));
}

/** Riga di capienza e fattore per un livello: dichiarata, o di partenza. */
export function housingRow(s: any, level: number): HousingRow {
  const own = ((s?.villageHousing || []) as HousingRow[])[level];
  const def = DEFAULT_HOUSING[Math.min(level, DEFAULT_HOUSING.length - 1)];
  return {
    cap: Math.max(0, Math.floor(own?.cap ?? def.cap)),
    mult: Math.max(0, Math.floor(own?.mult ?? def.mult)),
  };
}

/** Capienza e fattore al livello corrente; senza case non si cresce. */
export function currentHousing(s: any): HousingRow & { level: number; found: boolean } {
  const b = housingBuilding(s);
  if (!b) return { cap: 0, mult: 0, level: 0, found: false };
  const level = Math.max(0, Math.floor(b.level || 0));
  return { ...housingRow(s, level), level, found: true };
}

// ─── Il passo del calendario ─────────────────────────────────

/** Numero d'ordine del mercato che cade nel giorno assoluto dato. */
export const marketIndex = (abs: number): number => Math.floor((abs + 1) / DAYS_PER_WEEK);

/** Il tiro di crescita cade un mercato sì e uno no: quelli d'ordine pari.
 *  Ancorarlo al calendario, e non a un contatore, lo rende indifferente al
 *  giorno in cui il sistema viene acceso e a ogni andirivieni con la data. */
export const isGrowthDay = (abs: number): boolean => isMarketAbs(abs) && marketIndex(abs) % 2 === 0;

/** Giorni che mancano al prossimo tiro di crescita, da oggi escluso. */
export function daysToGrowth(todayAbs: number): number {
  for (let d = todayAbs + 1; d <= todayAbs + 2 * DAYS_PER_WEEK; d++) if (isGrowthDay(d)) return d - todayAbs;
  return 2 * DAYS_PER_WEEK;
}

const d4 = (rng: () => number) => 1 + Math.min(3, Math.floor(rng() * 4));

export interface TickResult {
  patch: Record<string, unknown>;   // chiavi di stato da scrivere
  notes: string[];                  // righe per «Durante la notte»
}

/**
 * Elabora i giorni compresi fra la tacca e la nuova data. La tacca si
 * salva sempre, anche arretrando: ripercorrere giorni già vissuti non
 * ripete né una produzione, né un consumo, né un tiro di crescita.
 *
 * A ogni mercato, nell'ordine: le attività attive depositano ciò che
 * rendono; il villaggio mangia la sua quota di razioni; un mercato sì e
 * uno no, infine, si tira per i nuovi arrivi — che in tempo di penuria
 * non si fermano.
 */
export function villageTick(s: any, fromAbs: number, toAbs: number, rng: () => number = Math.random): TickResult {
  const led = ledgerOf(s);
  const base = Math.max(typeof led.mark === 'number' ? led.mark : fromAbs, fromAbs);
  const mark = Math.max(base, toAbs);
  const grew: string[] = [], came: string[] = [], fed: string[] = [];

  const pop0 = popOf(s);
  let pop = pop0;
  let gate = gateOf(s);
  const gate0 = gate;
  let last = led.last;
  const { cap, mult, found } = currentHousing(s);

  // Magazzino: il calendario scrive soltanto il proprio registro.
  let stock = tallyOf(s, 'villageStock');
  let stockTouched = false;
  const drawn = (s?.villageDrawn || {}) as Tally;
  const have = (id: string) => Math.max(0, (stock[id] || 0) - (drawn[id] || 0));
  // La resa si ricalcola a ogni mercato sugli abitanti di quel momento: una
  // carestia che sfoltisce il villaggio sfoltisce anche gli adulti al lavoro.
  const madeTotal: Record<string, { label: string; qty: number }> = {};
  const ration = rationEntry(s);
  const hungerOn = !!s?.villageHunger && !!ration;
  let hunger: HungerState = led.hunger || { streak: 0 };
  const hunger0 = led.hunger;

  for (let d = base + 1; d <= toAbs; d++) {
    if (isMarketAbs(d)) {
      // 1. Produzione della settimana.
      for (const y of weeklyYields(pop === pop0 ? s : { ...s, villagePop: pop })) {
        stock = addTo(stock, y.entry.id, y.qty);
        const k = y.activity.id + '|' + y.entry.id;
        madeTotal[k] = { label: `${y.activity.name}: +{n} ${y.entry.name}`, qty: (madeTotal[k]?.qty || 0) + y.qty };
        stockTouched = true;
      }
      // 2. Consumo: la quota degli abitanti, per i sei giorni trascorsi.
      if (hungerOn) {
        const r = settleWeek(pop, have(ration.id), rationPct(s), leavePct(s), hunger.streak);
        if (r.eaten > 0) { stock = addTo(stock, ration.id, -r.eaten); stockTouched = true; }
        if (r.streak === 0 && hunger.streak > 0) fed.push('La dispensa torna a bastare: la penuria è finita');
        if (r.streak === 1) fed.push(`Penuria: il magazzino copre ${r.eaten} razioni su ${r.need}`);
        if (r.streak >= 2) {
          pop -= r.left;
          fed.push(`Carestia: ${r.eaten} razioni su ${r.need}; ${r.left === 1 ? 'un abitante lascia' : r.left + ' abitanti lasciano'} il villaggio, ne restano ${pop}`);
        }
        hunger = { streak: r.streak, abs: d, need: r.need, eaten: r.eaten };
      }
    }

    if (!isGrowthDay(d)) continue;
    const dice = [d4(rng), d4(rng), d4(rng)];
    const sum = dice[0] + dice[1] + dice[2];

    // Chi è già oltre la capienza non viene sfoltito: semplicemente non cresce.
    const starving = hunger.streak > 0;
    const want = found && !starving ? sum * mult : 0;
    const next = pop >= cap ? pop : Math.min(cap, pop + want);
    const gained = next - pop;
    pop = next;

    let notable: string | undefined;
    if (sum >= NOTABLE_MIN) {
      const deck = deckOf({ ...s, villageGate: gate });
      if (deck.length) {
        const pick = deck[Math.min(deck.length - 1, Math.floor(rng() * deck.length))];
        gate = [...gate, { npcId: pick.id, sinceAbs: d }];
        notable = pick.id;
        came.push(`Alla porta del villaggio: ${pick.name}`);
      }
    }

    last = { abs: d, dice, mult, gained, ...(notable ? { notable } : {}) };
    const why = !found ? ' — nessun edificio delle case' : starving ? ' — penuria: nessuno si ferma' : mult === 0 ? ' — a questo livello non si cresce' : gained < want ? ' — case piene' : '';
    grew.push(`Abitanti: 3d4 = ${sum} (${dice.join(' · ')})${mult > 1 ? ' × ' + mult : ''} → +${gained}, ora ${pop}${why}`);
  }
  const made = Object.values(madeTotal).map(m => m.label.replace('{n}', String(m.qty)));

  // ── Capi al lavoro da una settimana: si vede ciò che valgono ──
  // Il controllo guarda lo stato, non il passaggio: chi ha già maturato la
  // settimana viene riconosciuto al primo cambio di data utile, e chi è già
  // noto non viene annunciato di nuovo.
  let known = led.known;
  const seen: string[] = [];
  for (const [actId, a] of Object.entries(assignOf(s))) {
    if (toAbs - a.sinceAbs < DAYS_PER_WEEK) continue;
    if ((known?.[a.npcId] || []).includes(actId)) continue;
    const st = activityStatus(s, actId);
    if (st.state !== 'active' || !st.capo) continue;
    known = { ...(known || {}), [a.npcId]: [...(known?.[a.npcId] || []), actId] };
    const apt = aptitudeOf(st.capo, actId);
    seen.push(`${st.capo.name}, ${st.activity!.name}: una settimana di lavoro ha mostrato ${apt ? (apt.mod < 0 ? 'un malus' : 'un bonus') : 'che non porta né bonus né malus'}`);
  }

  const patch: Record<string, unknown> = {};
  const hungerChanged = hunger.abs !== undefined && hunger !== hunger0;
  if (mark !== led.mark || last !== led.last || known !== led.known || hungerChanged)
    patch.villageLedger = { ...led, mark, ...(last ? { last } : {}), ...(known ? { known } : {}), ...(hunger.abs !== undefined ? { hunger } : {}) };
  if (stockTouched) patch.villageStock = stock;
  if (pop !== pop0) patch.villagePop = pop;
  if (gate !== gate0) patch.villageGate = gate;
  return { patch, notes: [...made, ...fed, ...grew, ...came, ...seen] };
}

// ─── LE ATTIVITÀ E I LORO CAPI ───────────────────────────────
// Secondo passo: ogni attività del villaggio ha una casella, e i giocatori
// decidono chi la occupa scegliendo fra i residenti con un nome. Un'attività
// è attiva quando il suo edificio esiste al livello richiesto e qualcuno la
// tiene; fucina e conceria, che lavorano già, partono senza requisito
// d'edificio e chiedono soltanto il capo.
//
// Del capo si legge subito il tratto. Il bonus o il malus — un testo e un
// modificatore numerico, scritti dal DM per ciascuna attività in cui la
// persona si distingue — compare dopo una settimana di lavoro, e da allora
// resta noto. L'effetto, invece, vale dal primo giorno.

export interface Activity {
  id: string;
  name: string;
  /** Edificio richiesto: l'id di un edificio, 'none' per nessun requisito;
   *  assente = cercato per nome fra gli edifici del villaggio. */
  building?: string;
  minLevel?: number;          // livello minimo dell'edificio; assente = 1
  /** Solo Costruttori: punti percentuali tolti alla durata dei cantieri. */
  buildPct?: number;
  /** Ciò che l'attività deposita in magazzino a ogni mercato: voci
   *  d'armeria con la loro quantità. La forma a oggetto singolo è quella
   *  della prima stesura e resta leggibile: si passa sempre da `productsOf`. */
  produces?: Product[] | Product;
  /** Posti di lavoro per livello dell'edificio (indice = livello), fissati
   *  dal DM. Per le attività senza edificio vale la voce d'indice 1. */
  posts?: number[];
}

/** Un prodotto settimanale: voce d'armeria, quantità di base, eventuale
 *  moltiplicazione per il livello dell'edificio, e i pezzi che ogni adulto
 *  al lavoro vi aggiunge (assente = PER_WORKER_DEFAULT). */
export interface Product { armoryId: string; qty: number; perLevel?: boolean; perWorker?: number; }

export const PER_WORKER_DEFAULT = 1;
export const perWorkerOf = (p?: Product): number =>
  typeof p?.perWorker === 'number' && p.perWorker >= 0 ? Math.floor(p.perWorker) : PER_WORKER_DEFAULT;

/** I prodotti dichiarati di un'attività, qualunque forma abbiano a stato. */
export function productsOf(act?: Activity): Product[] {
  const p = act?.produces;
  const list = Array.isArray(p) ? p : (p ? [p] : []);
  return list.filter(x => x && x.armoryId);
}

export const ACT_FORGE = 'act-fucina';
export const ACT_TANNERY = 'act-conceria';
export const ACT_BUILDERS = 'act-costruttori';

export const DEFAULT_ACTIVITIES: Activity[] = [
  { id: ACT_FORGE,          name: 'Fucina',   building: 'none' },
  { id: ACT_TANNERY,        name: 'Conceria', building: 'none' },
  { id: 'act-taverna',      name: 'Taverna' },
  { id: 'act-erboristeria', name: 'Erboristeria' },
  { id: 'act-cappella',     name: 'Cappella di S. Mira' },
  { id: 'act-biblioteca',   name: 'Biblioteca' },
  { id: 'act-campi',        name: 'Campi' },
  { id: 'act-milizia',      name: 'Milizia' },
  { id: ACT_BUILDERS,       name: 'Costruttori', buildPct: 20 },
];

/** Come riconoscere per nome l'edificio di un'attività predefinita. */
const AUTO_MATCH: Record<string, RegExp> = {
  [ACT_FORGE]: /fucin|forgia/i,
  [ACT_TANNERY]: /conceri/i,
  'act-taverna': /tavern|locand|osteri/i,
  'act-erboristeria': /erbor/i,
  'act-cappella': /cappella/i,
  'act-biblioteca': /bibliotec/i,
  'act-campi': /\bcamp[io]\b/i,
  'act-milizia': /mura|milizi|caserma/i,
  [ACT_BUILDERS]: /capomastro|costrutt/i,
};

/** Bonus o malus di un PNG in una data attività. */
export interface Aptitude { activityId: string; text: string; mod: number; }

export interface CapoSeat { npcId: string; sinceAbs: number; }
export type VillageAssign = Record<string, CapoSeat>;

export const activitiesOf = (s: any): Activity[] => {
  const list = s?.villageActivities;
  return Array.isArray(list) && list.length ? list : DEFAULT_ACTIVITIES;
};

export const assignOf = (s: any): VillageAssign => ({ ...((s?.villageAssign || {}) as VillageAssign) });

/** L'edificio da cui l'attività dipende, se ne chiede uno e se esiste. */
export function activityBuilding(s: any, act: Activity): any | undefined {
  if (act.building === 'none') return undefined;
  const list = (s?.buildings || []) as any[];
  if (act.building) return list.find(b => b.id === act.building);
  const rx = AUTO_MATCH[act.id];
  const name = (act.name || '').trim().toLowerCase();
  return list.find(b => rx ? rx.test(b.name || '') : (!!name && (b.name || '').toLowerCase().includes(name)));
}

export type ActivityState = 'active' | 'idle' | 'unbuilt' | 'low';

export interface ActivityStatus {
  state: ActivityState;
  activity?: Activity;
  building?: any;
  need: number;            // livello richiesto
  capo?: any;              // il PNG che tiene la casella
  seat?: CapoSeat;
}

/** Stato di un'attività: prima l'edificio, poi chi la tiene. */
export function activityStatus(s: any, actId: string): ActivityStatus {
  const activity = activitiesOf(s).find(a => a.id === actId);
  if (!activity) return { state: 'unbuilt', need: 1 };
  const need = Math.max(1, Math.floor(activity.minLevel || 1));
  const seat = assignOf(s)[actId];
  const capo = seat && residentIds(s).includes(seat.npcId) ? npcById(s, seat.npcId) : undefined;
  const base = { activity, need, capo, seat: capo ? seat : undefined };
  if (activity.building !== 'none') {
    const building = activityBuilding(s, activity);
    if (!building) return { ...base, state: 'unbuilt' };
    if ((building.level || 0) < need) return { ...base, state: 'low', building };
    return { ...base, building, state: capo ? 'active' : 'idle' };
  }
  return { ...base, state: capo ? 'active' : 'idle' };
}

export const isActive = (s: any, actId: string): boolean => activityStatus(s, actId).state === 'active';

/** La bottega accetta lavoro? Un'attività tolta dal catalogo non vincola
 *  più nulla: la bottega torna a lavorare come prima che le caselle esistessero. */
export const shopOpen = (s: any, actId: string): boolean =>
  !activitiesOf(s).some(a => a.id === actId) || isActive(s, actId);

/** Attività tenuta dal PNG, se ne tiene una. */
export const roleOf = (a: VillageAssign, npcId: string): string | undefined =>
  Object.keys(a).find(k => a[k].npcId === npcId);

/** Affida una casella. Una persona ne tiene una sola: chi viene spostato
 *  lascia quella che aveva, e la sua settimana ricomincia. */
export function withCapo(a: VillageAssign, actId: string, npcId: string | null, todayAbs: number): VillageAssign {
  const next: VillageAssign = {};
  for (const [k, v] of Object.entries(a)) {
    if (k === actId) continue;
    if (npcId && v.npcId === npcId) continue;
    next[k] = v;
  }
  if (npcId) next[actId] = a[actId]?.npcId === npcId ? a[actId] : { npcId, sinceAbs: todayAbs };
  return next;
}

/** Toglie una persona da ogni casella: serve quando lascia il villaggio. */
export function withoutNpc(a: VillageAssign, npcId: string): VillageAssign {
  const next: VillageAssign = {};
  for (const [k, v] of Object.entries(a)) if (v.npcId !== npcId) next[k] = v;
  return next;
}

export function aptitudeOf(npc: any, actId: string): Aptitude | null {
  return (((npc?.aptitudes || []) as Aptitude[]).find(x => x.activityId === actId && (x.text?.trim() || x.mod))) || null;
}

export const isKnown = (s: any, npcId: string, actId: string): boolean =>
  (ledgerOf(s).known?.[npcId] || []).includes(actId);

/** Giorni di lavoro che mancano perché bonus e malus si vedano. */
export const daysToKnow = (seat: CapoSeat, todayAbs: number): number =>
  Math.max(0, DAYS_PER_WEEK - Math.max(0, todayAbs - seat.sinceAbs));

// ─── Costruttori: cantieri più rapidi ────────────────────────
// Con i Costruttori attivi un cantiere dura una percentuale in meno. Il
// modificatore del capomastro si somma in punti percentuali: un bonus lo
// accorcia ancora, un malus lo allunga. Lo sconto si calcola all'avvio e
// resta scritto nel cantiere: come ogni altra cosa a tempo, da lì in poi
// dipende soltanto dalla data.

export function buildDiscount(s: any): { pct: number; capo?: any } {
  const st = activityStatus(s, ACT_BUILDERS);
  if (st.state !== 'active' || !st.capo) return { pct: 0 };
  const base = Math.floor(st.activity?.buildPct ?? 20);
  const mod = aptitudeOf(st.capo, ACT_BUILDERS)?.mod || 0;
  return { pct: Math.max(-50, Math.min(75, base + mod)), capo: st.capo };
}

export function buildDays(s: any, days: number): number {
  const { pct } = buildDiscount(s);
  return Math.max(1, Math.round(Math.max(1, days) * (100 - pct) / 100));
}

// ─── FASCE D'ETÀ E ADULTI AL LAVORO ──────────────────────────
// Gli abitanti si dividono in adulti, bambini e anziani secondo due quote
// percentuali fissate dal DM; gli anziani sono ciò che resta. Le fasce non
// si contano una per una: discendono dal numero degli abitanti, e crescono
// o calano con lui.
//
// Gli adulti sono il bacino che i giocatori distribuiscono fra le attività,
// entro i posti di lavoro che il DM ha fissato per il livello dell'edificio.
// L'assegnazione vive in una chiave propria, scritta dai soli giocatori; ciò
// che conta davvero è però la lettura «effettiva», che la ricorta su adulti
// e posti disponibili in quel momento: se una carestia toglie gente, o un
// edificio viene abbassato, nessuno resta al lavoro in un posto che non c'è.

export interface AgeSplit { adults: number; kids: number; }   // quote percentuali; gli anziani sono il resto
export const DEFAULT_AGES: AgeSplit = { adults: 60, kids: 25 };

export function agePctOf(s: any): { adults: number; kids: number; elders: number } {
  const a = s?.villageAges as AgeSplit | undefined;
  const clamp = (n: any, d: number) => (typeof n === 'number' && n >= 0 ? Math.min(100, Math.floor(n)) : d);
  const adults = clamp(a?.adults, DEFAULT_AGES.adults);
  const kids = Math.min(100 - adults, clamp(a?.kids, DEFAULT_AGES.kids));
  return { adults, kids, elders: 100 - adults - kids };
}

/** Gli abitanti per fascia. La somma coincide sempre col totale: gli
 *  arrotondamenti ricadono sugli anziani, e in subordine sui bambini. */
export function agesOf(s: any): { adults: number; kids: number; elders: number } {
  const pop = popOf(s), pct = agePctOf(s);
  const adults = Math.min(pop, Math.round(pop * pct.adults / 100));
  const kids = Math.min(pop - adults, Math.round(pop * pct.kids / 100));
  return { adults, kids, elders: pop - adults - kids };
}

export type VillageWorkers = Record<string, number>;   // attività → adulti assegnati

/** Posti di lavoro di un'attività al livello corrente del suo edificio. */
export function postsOf(s: any, act: Activity): number {
  const st = activityStatus(s, act.id);
  if (st.state === 'unbuilt' || st.state === 'low') return 0;
  const level = act.building === 'none' ? 1 : Math.max(0, Math.floor(st.building?.level || 0));
  return Math.max(0, Math.floor(act.posts?.[level] || 0));
}

/** Gli adulti davvero al lavoro: l'assegnazione dei giocatori, ricortata
 *  sui posti di ciascuna attività e, nell'ordine del catalogo, sul numero
 *  degli adulti del villaggio. */
export function workersOf(s: any): VillageWorkers {
  const raw = (s?.villageWorkers || {}) as VillageWorkers;
  let left = agesOf(s).adults;
  const out: VillageWorkers = {};
  for (const act of activitiesOf(s)) {
    const n = Math.max(0, Math.min(Math.floor(raw[act.id] || 0), postsOf(s, act), left));
    if (n > 0) out[act.id] = n;
    left -= n;
  }
  return out;
}

export const freeAdults = (s: any): number =>
  agesOf(s).adults - Object.values(workersOf(s)).reduce((a, b) => a + b, 0);

/** Porta a `n` gli adulti di un'attività, entro posti e adulti liberi. */
export function withWorkers(s: any, actId: string, n: number): VillageWorkers {
  const cur = workersOf(s);
  const act = activitiesOf(s).find(a => a.id === actId);
  if (!act) return cur;
  const room = freeAdults(s) + (cur[actId] || 0);
  const next = Math.max(0, Math.min(Math.floor(n), postsOf(s, act), room));
  const out = { ...cur };
  if (next > 0) out[actId] = next; else delete out[actId];
  return out;
}

// ─── Produzione settimanale ──────────────────────────────────
// Un'attività attiva rende, a ogni mercato, i prodotti dichiarati dal DM
// nella scheda della bottega. Tre cose concorrono alla quantità:
//   · la resa di base, eventualmente moltiplicata per il livello dell'edificio;
//   · gli adulti al lavoro, ciascuno dei quali vi aggiunge un numero fisso
//     di pezzi, dichiarato prodotto per prodotto: un conto che si fa a
//     mente, senza percentuali né arrotondamenti;
//   · il modificatore di chi la tiene, sommato in unità al primo prodotto
//     dell'elenco — quello principale — e valido dal primo giorno, anche
//     quando i giocatori non l'hanno ancora visto.
// Per i Costruttori il modificatore è già speso sui cantieri e qui non conta.

export interface WeeklyYield {
  activity: Activity; entry: any; index: number; perLevel: boolean;
  base: number;        // resa senza adulti e senza capo
  workers: number;     // adulti al lavoro
  perWorker: number;   // pezzi che ogni adulto aggiunge a questo prodotto
  extra: number;       // pezzi aggiunti dagli adulti: workers × perWorker
  worked: number;      // resa con gli adulti, prima del capo
  mod: number;         // unità aggiunte o tolte da chi tiene l'attività
  qty: number;         // ciò che arriva in magazzino
}

/** Ciò che un'attività renderebbe al prossimo mercato, prodotto per prodotto.
 *  Le voci non più presenti in armeria si saltano. */
export function yieldsOf(s: any, act: Activity): WeeklyYield[] {
  const st = activityStatus(s, act.id);
  const level = Math.max(1, Math.floor(st.building?.level || 1));
  const capoMod = st.capo && act.id !== ACT_BUILDERS ? (aptitudeOf(st.capo, act.id)?.mod || 0) : 0;
  const workers = workersOf(s)[act.id] || 0;
  const out: WeeklyYield[] = [];
  productsOf(act).forEach((p, index) => {
    const entry = ((s?.armory || []) as any[]).find(e => e.id === p.armoryId);
    if (!entry) return;
    const base = Math.max(0, Math.floor(p.qty || 0)) * (p.perLevel ? level : 1);
    const perWorker = perWorkerOf(p);
    const extra = workers * perWorker;
    const worked = base + extra;
    const mod = out.length === 0 ? capoMod : 0;
    out.push({ activity: act, entry, index, perLevel: !!p.perLevel, base, workers, perWorker, extra, worked, mod, qty: Math.max(0, worked + mod) });
  });
  return out;
}

/** Le rese di tutte le attività attive, come stanno le cose adesso. */
export function weeklyYields(s: any): WeeklyYield[] {
  return activitiesOf(s)
    .filter(a => activityStatus(s, a.id).state === 'active')
    .flatMap(a => yieldsOf(s, a))
    .filter(y => y.qty > 0);
}
