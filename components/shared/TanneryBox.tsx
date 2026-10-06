'use client';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { RecipeShopBox, RecipeShopCfg } from '@/components/shared/RecipeShopBox';
import { tanneryRecipesOf } from '@/lib/dnd/crafting';
import { ACT_TANNERY } from '@/lib/dnd/village';
import { armoryMaterials } from '@/lib/dnd/smith-materials';

// ─── CONCERIA DI MEZZALUNA ───────────────────────────────────
// Trasforma un materiale in un altro: la pelliccia in cuoio, e qualunque
// altra conversione il DM registri nel catalogo. La logica vive nella
// bottega a ricette; qui resta soltanto ciò che fa della bottega una conceria.

const TAN_COLOR = 'var(--gold-light)';

const TANNERY: RecipeShopCfg = {
  kind: 'tannery',
  activityId: ACT_TANNERY,
  recipesKey: 'tanneryRecipes',
  recipesOf: tanneryRecipesOf,
  // Ingredienti ammessi: le due categorie di materia dell'armeria.
  inputs: armoryMaterials,
  idPrefix: 'tan',
  title: 'Conceria di Mezzaluna',
  color: TAN_COLOR,
  bgSlot: 'tannery-bg',
  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TAN_COLOR} strokeWidth="1.5"><path d="M4 7l4-3 4 2 4-2 4 3-3 3v9a1 1 0 01-1 1H8a1 1 0 01-1-1v-9L4 7z"/></svg>,
  badge: 'in lavorazione',
  benchLabel: '2 · Banco di concia',
  working: days => `Le pelli sono a bagno: ancora ${days} ${days === 1 ? 'giorno' : 'giorni'}.`,
  cancelConfirm: 'Ritirare le pelli e annullare la lavorazione? Il materiale torna com\'era.',
  stoppedBtn: 'Conceria ferma',
  stoppedText: 'La conceria è ferma: nessuno la tiene, e nuove lavorazioni non si possono affidare. La casella si riempie nel riquadro «Gli abitanti».',
  busyText: who => `Mezzaluna sta già lavorando per ${who}.`,
  catalogLabel: 'Catalogo della conceria (DM)',
  addLabel: '+ lavorazione',
};

export function TanneryBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  return <RecipeShopBox s={s} update={update} campaignId={campaignId} cfg={TANNERY} />;
}
