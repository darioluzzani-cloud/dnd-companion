import { CalendarState } from '@/lib/dnd/calendar';

export interface Quest {
  id: string;
  type: 'main' | 'side';
  title: string;
  desc: string;
  done: boolean;
  revealed: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  status: 'corso' | 'concluso' | 'futuro';
  quests: Quest[];
}

/** Frammento di lore rivelabile: preparato in anticipo, scoperto a piacere. */
export interface RevealFragment {
  id: string;
  title?: string;
  text: string;
  revealed?: boolean;
}

export interface NPC {
  id: string;
  name: string;
  role: string;
  location: string;
  relation: 'ally' | 'enemy' | 'neutral';
  note: string;
  revealed?: boolean;   // assente = visibile (retrocompatibilità); false = preparato ma nascosto ai giocatori
  expanded?: boolean;
  reveals?: RevealFragment[];   // frammenti da svelare progressivamente
  imgPos?: number;              // inquadratura verticale dell'immagine nel riquadro (0–100)
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  desc: string;
  prepared: boolean;
  expanded: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  type: string;
  icon?: string;
  setId?: string;   // set di appartenenza (bonus quando tutti i pezzi sono equipaggiati dallo stesso PG)
  subtype?: string; // sottocategoria (elmo, mantello, anello, scudo, arma magica…)
  attunement?: boolean;  // l'oggetto richiede sintonia
  attuned?: boolean;     // il personaggio è attualmente sintonizzato
  slot?: string;    // alloggiamento occupato sulla sagoma dell'equipaggiamento
  upgrades?: { name: string; desc: string }[];  // lavori di fucina applicati
}

export interface ItemSet {
  id: string;
  name: string;
  pieces: number;   // numero di pezzi equipaggiati necessari a completarlo
  effect: string;   // bonus conferito a set completo
  color: string;    // colore del gradiente (hex), sul modello di magici/unici
}

export interface PlayerResource {
  id: string;
  name: string;
  current: number;
  max: number;
  recovery?: 'long' | 'short' | 'none';  // ricarica: riposo lungo (default), breve, o solo manuale
  icon?: string;  // forma dell'indicatore: quadrato | d20 | goccia | fiamma | stella | scudo
}

export interface Player {
  id: string;
  name: string;
  short: string;
  cls: string;
  color: string;
  xp: number;
  caster: 'full' | 'half' | 'third' | 'none';
  species?: string;
  init?: number;
  hp?: number;
  maxHp?: number;
  slotsUsed: Record<string, number>;
  hitDie?: number;
  hitDiceUsed?: number;
  exhaustion?: number;
  inspiration?: boolean;
  speed?: number;
  initBonus?: number;
  feats?: { id: string; name: string; kind: string; desc: string }[];
  pactSlots?: boolean;  // Warlock: gli slot tornano disponibili con il riposo breve
  spellAbility?: string; // caratteristica da incantatore ('int' | 'wis' | 'cha'); se assente, dedotta dalla classe
  saveProf?: Record<string, boolean>;
  skillProf?: Record<string, number>;
  profNotes?: string;
  spells: Spell[];
  inventory: InventoryItem[];
  resources?: PlayerResource[];
}

export interface Combatant {
  id: string;
  name: string;
  init: number;
  hp: number;
  maxHp: number;
  side: 'ally' | 'enemy';
  revealed?: boolean;
  conditions?: string[];
  icon?: string;
  ds?: { s: number; f: number };
  imgSlot?: string;  // slot immagine esplicito (es. ritratto del bestiario)
}

export interface LoreEntry {
  id: string;
  name: string;
  subtitle: string;
  category: 'oggetti' | 'luoghi' | 'culti';
  text: string;
  revealed: boolean;
  expanded: boolean;
  reveals?: RevealFragment[];   // frammenti da svelare progressivamente
  imgPos?: number;              // inquadratura verticale dell'immagine nel riquadro (0–100)
}

/** Categorie della Cronaca: governano colore e raggruppamento visivo. */
export type TimelineCat = 'campagna' | 'storia' | 'sigilli' | 'personale' | 'presagio';

/**
 * Evento della Cronaca. La data è volutamente a precisione variabile: molti
 * fatti antichi si collocano solo per anno, e imporre giorno e mese
 * costringerebbe a inventare precisione che il mondo non possiede.
 * `revealed` governa l'esistenza della voce per i giocatori; `reveals`
 * ne scopre il contenuto un frammento alla volta, come per PNG e Lore.
 */
export interface TimelineEvent {
  id: string;
  title: string;
  year: number;              // anno d.V. — unico campo obbligatorio della data
  month?: number;            // 1-12, facoltativo
  day?: number;              // 1-30, facoltativo
  approx?: boolean;          // datazione incerta: si legge "attorno al…"
  era?: string;              // etichetta libera ("epoca Teodora", "prima del Vespro")
  cat?: TimelineCat;
  text?: string;             // testo di base, visibile quando la voce è svelata
  dmNote?: string;
  revealed?: boolean;
  reveals?: RevealFragment[];
  imgPos?: number;           // inquadratura verticale dell'immagine (0–100)
}

export interface AlchemyRecipe {
  id: string;
  tool: string;
  ingredients: string[];
  unlocked?: boolean;  // ricetta scoperta dai giocatori: visibile nel ricettario
  result: {
    name: string;
    type: string;
    effect: string;
    desc: string;
    qty: number;
  };
}

export interface JournalEntry {
  id: string;
  author: string;      // nome del PG o 'DM'
  date: string;        // data velmorana al momento della nota
  ts: number;          // timestamp reale, per l'ordinamento
  text: string;
}

export interface BestiaryEntry {
  id: string;
  name: string;
  maxHp: number;
  initMod: number;
  variants?: number;   // quanti ritratti distinti sono stati preparati (assente = 1)
}

export interface DiceRoll {
  die: number;
  value: number;
  t: number;
}

export interface CampaignState {
  tab: string;
  campaign: string;
  dmMode: boolean;
  editMode: boolean;
  activeScenario: string;
  scenarios: Scenario[];
  characters: NPC[];
  activePlayer: string;
  players: Player[];
  combatants: Combatant[];
  round: number;
  turnIndex: number;
  lore: LoreEntry[];
  loreCatFilter: string;
  alchemyRecipes?: AlchemyRecipe[];
  bestiary?: BestiaryEntry[];
  journal?: JournalEntry[];
  timeline?: TimelineEvent[];   // Le Cronache della Marca
  baseRations?: number;  // razioni giornaliere nel magazzino del villaggio
  smithUpgrades?: { id: string; name: string; desc: string; material?: string; cat?: 'base'|'avanzato'|'nanico'; materials?: { name: string; qty: number }[] }[];  // catalogo della fucina
  marketBuildingId?: string;      // edificio (di norma la Piazza) che governa il livello del mercato
  marketStalls?: import('./dnd/market').MarketStall[];   // catalogo bancarelle (copy-on-write dai default)
  marketRumors?: import('./dnd/market').MarketRumor[];   // tabella dicerie d100 (copy-on-write dai default)
  market?: import('./dnd/market').MarketDay | null;      // il mercato tirato per il giorno corrente
  armory?: { id: string; name: string; type: string; desc?: string; effect?: string; armorType?: string; armorCA?: number; enhSlots?: number; attunement?: boolean }[];
  itemSets?: ItemSet[];  // catalogo oggetti preparati dal DM (Armeria)
  calendar?: CalendarState;
  lastRoll: DiceRoll | null;
  rollSeq: number;
  history: DiceRoll[];
  // draft fields (UI only, not persisted)
  draftQuest?: string;
  draftQuestType?: string;
  draftScen?: string;
  draftChar?: string;
  draftSpell?: string;
  draftSpellLevel?: string;
  draftItem?: string;
  draftCombName?: string;
  draftCombInit?: string;
  draftCombHp?: string;
  draftLoreCat?: string;
  draftLoreName?: string;
  draftLoreSub?: string;
  questSubTab?: string;
}

export const uid = (prefix: string) =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
