import { isMarketAbs, DAYS_PER_WEEK } from '@/lib/dnd/calendar';

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
 * ripete né un tiro di crescita né la comparsa di un notabile.
 */
export function villageTick(s: any, fromAbs: number, toAbs: number, rng: () => number = Math.random): TickResult {
  const led = ledgerOf(s);
  const base = Math.max(typeof led.mark === 'number' ? led.mark : fromAbs, fromAbs);
  const mark = Math.max(base, toAbs);
  const grew: string[] = [], came: string[] = [];

  const pop0 = popOf(s);
  let pop = pop0;
  let gate = gateOf(s);
  const gate0 = gate;
  let last = led.last;
  const { cap, mult, found } = currentHousing(s);

  for (let d = base + 1; d <= toAbs; d++) {
    if (!isGrowthDay(d)) continue;
    const dice = [d4(rng), d4(rng), d4(rng)];
    const sum = dice[0] + dice[1] + dice[2];

    // Chi è già oltre la capienza non viene sfoltito: semplicemente non cresce.
    const want = found ? sum * mult : 0;
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
    const why = !found ? ' — nessun edificio delle case' : mult === 0 ? ' — a questo livello non si cresce' : gained < want ? ' — case piene' : '';
    grew.push(`Abitanti: 3d4 = ${sum} (${dice.join(' · ')})${mult > 1 ? ' × ' + mult : ''} → +${gained}, ora ${pop}${why}`);
  }

  const patch: Record<string, unknown> = {};
  if (mark !== led.mark || last !== led.last) patch.villageLedger = { ...led, mark, ...(last ? { last } : {}) };
  if (pop !== pop0) patch.villagePop = pop;
  if (gate !== gate0) patch.villageGate = gate;
  return { patch, notes: [...grew, ...came] };
}
