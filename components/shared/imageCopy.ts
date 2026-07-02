import { supabase } from '@/lib/supabase';

export async function copyRecipeImage(campaignId: string, recipeId: string, itemId: string) {
  try {
    const folder = campaignId;
    const slotId = 'recipe-' + recipeId;
    const { data } = await supabase.storage.from('campaign-images').list(folder, { search: slotId });
    const match = (data || []).find(f => f.name.startsWith(slotId + '.'));
    if (!match) return;
    const { data: blob } = await supabase.storage.from('campaign-images').download(`${folder}/${match.name}`);
    if (!blob) return;
    const ext = match.name.split('.').pop() || 'png';
    await supabase.storage.from('campaign-images').upload(`${folder}/item-${itemId}.${ext}`, blob, { upsert: true, contentType: blob.type });
  } catch (err) { console.warn('Copia immagine fallita:', err); }
}

export async function copyItemImage(campaignId: string, sourceItemId: string, targetItemId: string) {
  try {
    const folder = campaignId;
    const slotId = 'item-' + sourceItemId;
    const { data } = await supabase.storage.from('campaign-images').list(folder, { search: slotId });
    const match = (data || []).find(f => f.name.startsWith(slotId + '.'));
    if (!match) return;
    const { data: blob } = await supabase.storage.from('campaign-images').download(`${folder}/${match.name}`);
    if (!blob) return;
    const ext = match.name.split('.').pop() || 'png';
    await supabase.storage.from('campaign-images').upload(`${folder}/item-${targetItemId}.${ext}`, blob, { upsert: true, contentType: blob.type });
  } catch (err) { console.warn('Copia immagine oggetto fallita:', err); }
}
