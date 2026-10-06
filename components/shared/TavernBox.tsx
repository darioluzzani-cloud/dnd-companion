'use client';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { RecipeShopBox, RecipeShopCfg } from '@/components/shared/RecipeShopBox';
import { tavernRecipesOf } from '@/lib/dnd/crafting';

// ─── TAVERNA: LE BEVANDE ─────────────────────────────────────
// Terza bottega a ricette, accanto a fucina e conceria: ingredienti che
// entrano, una bevanda che esce dopo qualche giornata di cantina. Lavora
// soltanto se l'attività «Taverna» è attiva nel riquadro «Gli abitanti» —
// edificio al livello richiesto e qualcuno dietro il banco.
//
// Il catalogo nasce vuoto: le bevande sono voci d'armeria, e le ricette le
// scrive il DM scegliendo da lì ingredienti ed esito. La rendita
// settimanale della taverna resta un meccanismo a parte, nel calendario.

const TAV_COLOR = 'var(--pink)';
export const ACT_TAVERN = 'act-taverna';

const TAVERN: RecipeShopCfg = {
  kind: 'tavern',
  activityId: ACT_TAVERN,
  recipesKey: 'tavernRecipes',
  recipesOf: tavernRecipesOf,
  // In cantina entra di tutto: erbe, bacche, miele, acqua di sorgente.
  inputs: (s: any) => ((s?.armory || []) as any[]).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
  idPrefix: 'tav',
  title: 'Taverna di Olmobianco',
  color: TAV_COLOR,
  bgSlot: 'tavern-bg',
  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TAV_COLOR} strokeWidth="1.5"><path d="M6 4h9v14a2 2 0 01-2 2H8a2 2 0 01-2-2V4z"/><path d="M15 8h2a2 2 0 012 2v3a2 2 0 01-2 2h-2"/><path d="M6 9h9"/></svg>,
  badge: 'in cantina',
  benchLabel: '2 · Banco della cantina',
  working: days => `La bevanda riposa in cantina: ancora ${days} ${days === 1 ? 'giorno' : 'giorni'}.`,
  cancelConfirm: 'Ritirare gli ingredienti e annullare la preparazione? Tornano com\'erano.',
  stoppedBtn: 'Taverna ferma',
  stoppedText: 'La taverna non prepara nulla: l\'attività non è attiva. Servono l\'edificio al livello richiesto e qualcuno che la tenga, nel riquadro «Gli abitanti».',
  busyText: who => `La cantina sta già lavorando per ${who}.`,
  catalogLabel: 'Catalogo delle bevande (DM)',
  addLabel: '+ bevanda',
};

export function TavernBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  return <RecipeShopBox s={s} update={update} campaignId={campaignId} cfg={TAVERN} />;
}
