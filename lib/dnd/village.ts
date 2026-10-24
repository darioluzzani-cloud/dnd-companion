import type { RevealFragment } from '@/lib/types';
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

// ─── I FORESTIERI ────────────────────────────────────────────
// Le carte del mazzo si preparano in un catalogo proprio, dentro «Gli
// abitanti», e restano fuori dal registro dei PNG finché il gruppo non le
// accoglie. Allora la carta diventa un PNG a tutti gli effetti, con lo
// stesso identificativo: il ritratto, caricato sullo slot `png-<id>`, la
// segue senza bisogno di copiarlo.

export interface DeckCard {
  id: string;
  name: string;
  role?: string;
  trait?: string;            // ciò che al villaggio si dice di lui: visibile alla porta
  lore?: string;             // lore visibile: diventa la nota del PNG
  secrets?: RevealFragment[];   // lore nascosta: frammenti da svelare dopo l'accoglienza
  aptitudes?: Aptitude[];    // bonus e malus per attività
  imgPos?: number;           // inquadratura del ritratto (0–100)
}

export const deckCardsOf = (s: any): DeckCard[] =>
  (Array.isArray(s?.villageDeck) ? s.villageDeck : []) as DeckCard[];

/** Una carta già accolta è diventata un PNG del registro. */
const isNpc = (s: any, id: string) => ((s?.characters || []) as any[]).some(c => c.id === id);

/** Il mazzo: carte del catalogo non ancora arrivate, accolte né respinte;
 *  più i PNG che una versione precedente marcava «nel mazzo». */
export function deckOf(s: any): any[] {
  const out = new Set([...residentIds(s), ...dismissedIds(s), ...gateOf(s).map(g => g.npcId)]);
  const cards = deckCardsOf(s).filter(c => !out.has(c.id) && !isNpc(s, c.id));
  const legacy = ((s?.characters || []) as any[]).filter(c => c.inDeck && !out.has(c.id));
  return [...cards, ...legacy];
}

/** Chi corrisponde a un identificativo: il PNG del registro, se esiste,
 *  altrimenti la carta del catalogo. Serve alla porta, dove può presentarsi
 *  l'uno o l'altra. */
export function personOf(s: any, id: string): any | undefined {
  return npcById(s, id) || deckCardsOf(s).find(c => c.id === id);
}

export type CardStatus = 'mazzo' | 'porta' | 'accolto' | 'respinto';

export function cardStatus(s: any, id: string): CardStatus {
  if (isNpc(s, id) || residentIds(s).includes(id)) return 'accolto';
  if (gateOf(s).some(g => g.npcId === id)) return 'porta';
  if (dismissedIds(s).includes(id)) return 'respinto';
  return 'mazzo';
}

/** Il PNG che nasce da una carta accolta: alleato, di Olmobianco, con la
 *  lore visibile come nota e quella nascosta come frammenti ancora spenti. */
/** Le chiavi da scrivere quando il gruppo accoglie chi è alla porta: la
 *  carta, se è una carta, entra fra i PNG con lo stesso identificativo; un
 *  PNG già registrato vi resta com'è. In ogni caso lascia la porta e
 *  diventa residente. */
export function integratePatch(s: any, id: string): Record<string, unknown> {
  const card = deckCardsOf(s).find(c => c.id === id);
  return {
    villageGate: gateOf(s).filter(g => g.npcId !== id),
    villageResidents: [...residentIds(s).filter(x => x !== id), id],
    ...(card && !isNpc(s, id) ? { characters: [...((s?.characters || []) as any[]), cardToNpc(card)] } : {}),
  };
}

export function cardToNpc(c: DeckCard): any {
  return {
    id: c.id, name: c.name, role: c.role || '', location: 'Olmobianco',
    relation: 'ally', note: c.lore || '', revealed: true,
    reveals: (c.secrets || []).map(f => ({ ...f, revealed: false })),
    ...(c.trait ? { trait: c.trait } : {}),
    ...(c.aptitudes?.length ? { aptitudes: c.aptitudes } : {}),
    ...(typeof c.imgPos === 'number' ? { imgPos: c.imgPos } : {}),
  };
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

  const growthFx = effectSum(s, 'growth');

  for (let d = base + 1; d <= toAbs; d++) {
    if (isMarketAbs(d)) {
      // 1. Produzione della settimana.
      for (const y of weeklyYields(pop === pop0 ? s : { ...s, villagePop: pop }, d)) {
        stock = addTo(stock, y.entry.id, y.qty);
        const k = y.activity.id + '|' + y.entry.id;
        madeTotal[k] = { label: `${y.activity.name}: +{n} ${y.entry.name}`, qty: (madeTotal[k]?.qty || 0) + y.qty };
        stockTouched = true;
      }
      // 2. Consumo: la quota degli abitanti, per i sei giorni trascorsi.
      if (hungerOn) {
        const r = settleWeek(pop, have(ration.id), effectiveRationPct(s), leavePct(s), hunger.streak);
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
    const sum = Math.max(0, dice[0] + dice[1] + dice[2] + growthFx);

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
    grew.push(`Abitanti: 3d4 = ${sum} (${dice.join(' · ')}${growthFx ? (growthFx > 0 ? ' +' : ' −') + Math.abs(growthFx) : ''})${mult > 1 ? ' × ' + mult : ''} → +${gained}, ora ${pop}${why}`);
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
    const shown = effectsOf(st.capo, actId).map(a => describeEffect(s, a)).filter(Boolean);
    seen.push(`${st.capo.name}, ${st.activity!.name}: una settimana di lavoro ha mostrato ${shown.length ? shown.join('; ') : 'che non porta né bonus né malus'}`);
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

/** Una soglia: quanti adulti al lavoro servono, e quanti pezzi in più
 *  rende il prodotto una volta raggiunta. Il bonus è il totale a quella
 *  soglia, non un'aggiunta alla precedente. */
export interface WorkStep { adults: number; bonus: number; }

/** Un prodotto settimanale: voce d'armeria, quantità di base, eventuale
 *  moltiplicazione per il livello dell'edificio, e le soglie di adulti che
 *  il DM fissa una per una. Senza soglie gli adulti non aggiungono nulla:
 *  nessuna corrispondenza automatica fra un adulto e un pezzo. */
export interface Product {
  armoryId: string; qty: number; perLevel?: boolean; steps?: WorkStep[];
  /** Livello dell'edificio da cui il prodotto si sblocca (assente = da subito). */
  minLevel?: number;
}

/** Le soglie di un prodotto, ripulite e in ordine di adulti richiesti. */
export function stepsOf(p?: Product): WorkStep[] {
  return ((p?.steps || []) as WorkStep[])
    .map(x => ({ adults: Math.max(1, Math.floor(x?.adults || 0)), bonus: Math.max(0, Math.floor(x?.bonus || 0)) }))
    .sort((x, y) => x.adults - y.adults);
}

/** Pezzi in più con `workers` adulti al lavoro: vale l'ultima soglia
 *  raggiunta; sotto la prima non si aggiunge nulla. */
export function stepBonus(steps: WorkStep[], workers: number): number {
  let bonus = 0;
  for (const st of steps) if (st.adults <= workers) bonus = st.bonus;
  return bonus;
}

/** La soglia che seguirebbe naturalmente le esistenti: stesso passo di
 *  adulti e stesso scatto di pezzi delle ultime due, così una scala
 *  regolare si costruisce a colpi di «+» e una irregolare si ritocca. */
export function nextStep(steps: WorkStep[]): WorkStep {
  if (steps.length === 0) return { adults: 3, bonus: 1 };
  const last = steps[steps.length - 1], prev = steps[steps.length - 2];
  const dA = prev ? Math.max(1, last.adults - prev.adults) : last.adults;
  const dB = prev ? Math.max(1, last.bonus - prev.bonus) : Math.max(1, last.bonus);
  return { adults: last.adults + dA, bonus: last.bonus + dB };
}

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
/**
 * Un effetto di chi tiene un'attività. Vale soltanto mentre la persona ne
 * è il capo e l'attività è attiva; `activityId` dice dove deve lavorare,
 * `kind` che cosa cambia — anche fuori dalla sua bottega, come i cantieri
 * o il fabbisogno del villaggio.
 *
 * Il segno è sempre quello del villaggio: positivo è un bonus, negativo un
 * malus, qualunque sia la grandezza toccata (+10 sui cantieri li accorcia,
 * +10 sulle razioni ne riduce il consumo, +1 sulle commesse toglie un giorno).
 *
 * Le righe scritte prima che esistessero i tipi non hanno `kind`, e si
 * leggono come allora: pezzi sul primo prodotto della bottega, sconto sui
 * cantieri per i Costruttori, nulla per la Milizia (si veda `kindOf`).
 */
export type EffectKind =
  | 'yield' | 'posts' | 'hands' | 'product'
  | 'build' | 'craft' | 'rations' | 'growth' | 'rent' | 'resale' | 'note';

export interface Aptitude {
  activityId: string;
  text: string;
  mod: number;
  kind?: EffectKind;
  /** yield e product: voce d'armeria; craft: 'forge' | 'tannery' | 'tavern'. */
  target?: string;
  /** product: ogni quanti mercati arriva (assente = a ogni mercato). */
  every?: number;
}

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

// ─── EFFETTI DEI CAPI ────────────────────────────────────────

export const EFFECT_KINDS: { k: EffectKind; label: string; unit: string }[] = [
  { k: 'yield',   label: 'Pezzi in più su un prodotto',      unit: 'pezzi' },
  { k: 'product', label: 'Produce un oggetto proprio',       unit: 'pezzi' },
  { k: 'posts',   label: 'Posti di lavoro',                  unit: 'posti' },
  { k: 'hands',   label: 'Vale come adulti (per le soglie)', unit: 'adulti' },
  { k: 'build',   label: 'Cantieri più rapidi',              unit: '%' },
  { k: 'craft',   label: 'Commesse di bottega più rapide',   unit: 'giorni' },
  { k: 'rations', label: 'Fabbisogno di razioni ridotto',    unit: '%' },
  { k: 'growth',  label: 'Punti al 3d4 della crescita',      unit: 'punti' },
  { k: 'rent',    label: 'Rendita della taverna',            unit: 'mo a testa' },
  { k: 'resale',  label: 'Rivendita al mercato',             unit: 'punti %' },
  { k: 'note',    label: 'Solo descrizione',                 unit: '' },
];

export const SHOP_OF: Record<string, string> = { 'act-fucina': 'forge', 'act-conceria': 'tannery', 'act-taverna': 'tavern' };
export const SHOP_LABEL: Record<string, string> = { forge: 'fucina', tannery: 'conceria', tavern: 'taverna' };

export function kindOf(a: Aptitude): EffectKind {
  if (a.kind) return a.kind;
  if (a.activityId === ACT_BUILDERS) return 'build';
  if (a.activityId === 'act-milizia') return 'note';
  return 'yield';
}

/** Gli effetti di una persona in un'attività: le righe vuote non contano. */
export function effectsOf(npc: any, actId: string): Aptitude[] {
  return ((npc?.aptitudes || []) as Aptitude[])
    .filter(x => x && x.activityId === actId && (x.text?.trim() || x.mod || x.kind));
}

/** Il primo effetto della persona in quell'attività (forma di comodo). */
export const aptitudeOf = (npc: any, actId: string): Aptitude | null => effectsOf(npc, actId)[0] || null;

export interface ActiveEffect extends Aptitude { kind: EffectKind; capo: any; activity: Activity; }

/** Tutti gli effetti che valgono adesso: quelli dei capi di attività attive. */
export function activeEffects(s: any): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  for (const act of activitiesOf(s)) {
    const st = activityStatus(s, act.id);
    if (st.state !== 'active' || !st.capo) continue;
    for (const a of effectsOf(st.capo, act.id)) out.push({ ...a, kind: kindOf(a), capo: st.capo, activity: act });
  }
  return out;
}

/** Somma dei valori di un tipo d'effetto, eventualmente ristretta. */
export function effectSum(s: any, kind: EffectKind, pred?: (e: ActiveEffect) => boolean): number {
  return activeEffects(s).filter(e => e.kind === kind && (!pred || pred(e))).reduce((n, e) => n + (Math.floor(e.mod) || 0), 0);
}

/** Giorni tolti (o, se negativi, aggiunti) alle commesse di una bottega. */
export const craftDelta = (s: any, shop: string): number =>
  effectSum(s, 'craft', e => (e.target || SHOP_OF[e.activity.id]) === shop);

/** Durata effettiva di una commessa: mai sotto un giorno, e un lavoro
 *  immediato resta immediato. */
export function craftDays(s: any, shop: string, days: number): number {
  const d = Math.max(0, Math.floor(days || 0));
  return d <= 0 ? 0 : Math.max(1, d - craftDelta(s, shop));
}

/** Quota giornaliera di razioni, dopo gli effetti: +10 la riduce del 10%. */
export function effectiveRationPct(s: any): number {
  const cut = effectSum(s, 'rations');
  return Math.max(0, rationPct(s) * (100 - cut) / 100);
}

/** Descrizione leggibile di un effetto, per i giocatori e per il DM. */
export function describeEffect(s: any, a: Aptitude): string {
  const v = Math.floor(a.mod) || 0, sg = v > 0 ? '+' : v < 0 ? '−' : '±', n = Math.abs(v);
  const item = (id?: string) => ((s?.armory || []) as any[]).find(e => e.id === id)?.name;
  switch (kindOf(a)) {
    case 'yield':   return `${sg}${n} ${item(a.target) || 'sul primo prodotto della bottega'} a ogni mercato`;
    case 'product': return `produce ${Math.max(0, v)} × ${item(a.target) || 'un oggetto da scegliere'}${(a.every || 1) > 1 ? ` ogni ${a.every} mercati` : ' a ogni mercato'}`;
    case 'posts':   return `${sg}${n} ${n === 1 ? 'posto' : 'posti'} di lavoro`;
    case 'hands':   return `vale come ${v} ${Math.abs(v) === 1 ? 'adulto' : 'adulti'} in più per le soglie`;
    case 'build':   return `cantieri ${v >= 0 ? 'più rapidi' : 'più lenti'} del ${n}%`;
    case 'craft':   return `commesse della ${SHOP_LABEL[a.target || SHOP_OF[a.activityId]] || 'bottega'} ${v >= 0 ? 'più brevi' : 'più lunghe'} di ${n} ${n === 1 ? 'giorno' : 'giorni'}`;
    case 'rations': return `fabbisogno di razioni ${v >= 0 ? 'ridotto' : 'aumentato'} del ${n}%`;
    case 'growth':  return `${sg}${n} al 3d4 della crescita`;
    case 'rent':    return `${sg}${n} mo a testa di rendita della taverna`;
    case 'resale':  return `${sg}${n} punti percentuali di rivendita al mercato`;
    default:        return '';
  }
}

/** L'effetto è un bonus, un malus o una sola descrizione? */
export const effectSign = (a: Aptitude): 1 | -1 | 0 =>
  kindOf(a) === 'note' ? 0 : kindOf(a) === 'product' ? 1 : (a.mod > 0 ? 1 : a.mod < 0 ? -1 : 0);

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

export function buildDiscount(s: any): { pct: number; capo?: any; base: number; fx: number } {
  const st = activityStatus(s, ACT_BUILDERS);
  const base = st.state === 'active' && st.capo ? Math.floor(st.activity?.buildPct ?? 20) : 0;
  // Gli effetti sui cantieri valgono da qualunque attività li porti chi
  // la tiene: il capomastro, ma anche un vecchio sergente alla Milizia.
  const fx = effectSum(s, 'build');
  return { pct: Math.max(-50, Math.min(75, base + fx)), capo: st.state === 'active' ? st.capo : undefined, base, fx };
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
  const extra = effectSum(s, 'posts', e => e.activity.id === act.id);
  return Math.max(0, Math.floor(act.posts?.[level] || 0) + extra);
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
//   · gli adulti al lavoro, che aggiungono pezzi soltanto al raggiungere
//     delle soglie fissate dal DM prodotto per prodotto («3 adulti → +1,
//     6 adulti → +2»): un adulto in più, da solo, non vale nulla;
//   · il modificatore di chi la tiene, sommato in unità al primo prodotto
//     dell'elenco — quello principale — e valido dal primo giorno, anche
//     quando i giocatori non l'hanno ancora visto.
// Per i Costruttori il modificatore è già speso sui cantieri e qui non conta.

export interface WeeklyYield {
  activity: Activity; entry: any; index: number; perLevel: boolean;
  /** Oggetto proprio del capo: esiste finché la persona tiene l'attività. */
  own?: { every: number };
  /** Prodotto non ancora sbloccato: il livello dell'edificio che serve. */
  locked?: number;
  base: number;        // resa senza adulti e senza capo
  workers: number;     // adulti al lavoro
  steps: WorkStep[];   // soglie di adulti fissate dal DM, in ordine
  extra: number;       // pezzi aggiunti dall'ultima soglia raggiunta
  next: WorkStep | null;   // la prossima soglia non ancora raggiunta
  worked: number;      // resa con gli adulti, prima del capo
  mod: number;         // unità aggiunte o tolte da chi tiene l'attività
  qty: number;         // ciò che arriva in magazzino
}

/** Ciò che un'attività renderebbe al prossimo mercato, prodotto per prodotto.
 *  Le voci non più presenti in armeria si saltano. */
export function yieldsOf(s: any, act: Activity): WeeklyYield[] {
  const st = activityStatus(s, act.id);
  const level = Math.max(1, Math.floor(st.building?.level || 1));
  const armory = (s?.armory || []) as any[];
  // Gli effetti del capo contano soltanto se l'attività è attiva; per una
  // bottega ferma la scheda mostra comunque ciò che renderebbe di base.
  const fx = st.state === 'active' && st.capo
    ? effectsOf(st.capo, act.id).map(a => ({ ...a, kind: kindOf(a) }))
    : [];
  const workers = workersOf(s)[act.id] || 0;
  const hands = fx.filter(e => e.kind === 'hands').reduce((n, e) => n + (Math.floor(e.mod) || 0), 0);
  const counted = Math.max(0, workers + hands);
  const prods = productsOf(act).filter(p => armory.some(e => e.id === p.armoryId));
  // Un prodotto può sbloccarsi soltanto da un certo livello dell'edificio.
  // Le attività senza edificio non hanno livelli: per loro vale tutto.
  const realLevel = act.building === 'none' ? Infinity : Math.max(0, Math.floor(st.building?.level || 0));
  const lockOf = (p: Product) => { const m = Math.floor(p.minLevel || 0); return m > 1 && m > realLevel ? m : 0; };
  // «Il primo prodotto», per gli effetti che non ne indicano uno, è il primo già
  // sbloccato. Un effetto mirato su un prodotto ancora bloccato aspetta il suo livello.
  const open = prods.filter(p => !lockOf(p));
  const firstId = open[0]?.armoryId;
  const out: WeeklyYield[] = [];
  prods.forEach((p, index) => {
    const entry = armory.find(e => e.id === p.armoryId);
    const lock = lockOf(p);
    if (lock) {
      out.push({ activity: act, entry, index, perLevel: !!p.perLevel, locked: lock,
        base: Math.max(0, Math.floor(p.qty || 0)), workers: counted, steps: stepsOf(p), extra: 0, next: null, worked: 0, mod: 0, qty: 0 });
      return;
    }
    const base = Math.max(0, Math.floor(p.qty || 0)) * (p.perLevel ? level : 1);
    const steps = stepsOf(p);
    const extra = stepBonus(steps, counted);
    const next = steps.find(x => x.adults > counted) || null;
    const worked = base + extra;
    // Pezzi in più o in meno: sull'oggetto indicato, oppure sul primo
    // dell'elenco quando l'effetto non ne indica uno della bottega.
    const isFirst = p.armoryId === firstId;
    const mod = fx.filter(e => e.kind === 'yield' && (e.target ? e.target === p.armoryId || (isFirst && !prods.some(x => x.armoryId === e.target)) : isFirst))
      .reduce((n, e) => n + (Math.floor(e.mod) || 0), 0);
    out.push({ activity: act, entry, index, perLevel: !!p.perLevel, base, workers: counted, steps, extra, next, worked, mod, qty: Math.max(0, worked + mod) });
  });
  // Oggetti che soltanto quella persona sa fare.
  fx.filter(e => e.kind === 'product').forEach((e, k) => {
    const entry = armory.find(x => x.id === e.target);
    const q = Math.max(0, Math.floor(e.mod) || 0);
    if (!entry || q <= 0) return;
    out.push({ activity: act, entry, index: prods.length + k, perLevel: false, own: { every: Math.max(1, Math.floor(e.every || 1)) },
      base: q, workers: counted, steps: [], extra: 0, next: null, worked: q, mod: 0, qty: q });
  });
  return out;
}

/** Le rese di tutte le attività attive. Con `abs`, il giorno di mercato in
 *  cui si consegna: gli oggetti a cadenza arrivano soltanto nei mercati il
 *  cui numero d'ordine è multiplo della loro cadenza, così andare avanti e
 *  indietro col calendario non ne anticipa né ne ripete la consegna. */
export function weeklyYields(s: any, abs?: number): WeeklyYield[] {
  return activitiesOf(s)
    .filter(a => activityStatus(s, a.id).state === 'active')
    .flatMap(a => yieldsOf(s, a))
    .filter(y => y.qty > 0 && (!y.own || abs === undefined || marketIndex(abs) % y.own.every === 0));
}
