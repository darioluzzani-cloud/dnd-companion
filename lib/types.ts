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

export interface NPC {
  id: string;
  name: string;
  role: string;
  location: string;
  relation: 'ally' | 'enemy' | 'neutral';
  note: string;
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
}

export interface PlayerResource {
  id: string;
  name: string;
  current: number;
  max: number;
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
}

export interface LoreEntry {
  id: string;
  name: string;
  subtitle: string;
  category: 'oggetti' | 'luoghi' | 'culti';
  text: string;
  revealed: boolean;
  expanded: boolean;
}

export interface AlchemyRecipe {
  id: string;
  tool: string;
  ingredients: string[];
  result: {
    name: string;
    type: string;
    effect: string;
    desc: string;
    qty: number;
  };
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
