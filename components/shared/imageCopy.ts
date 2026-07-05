import { supabase } from '@/lib/supabase';
import { registerStorageFile } from '@/components/ImageSlot';

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
    const vName = `item-${itemId}.${Date.now().toString(36)}.${ext}`;
    await supabase.storage.from('campaign-images').upload(`${folder}/${vName}`, blob, { upsert: true, cacheControl: '31536000', contentType: blob.type });
    await registerStorageFile(campaignId, vName);
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
    const vName2 = `item-${targetItemId}.${Date.now().toString(36)}.${ext}`;
    await supabase.storage.from('campaign-images').upload(`${folder}/${vName2}`, blob, { upsert: true, cacheControl: '31536000', contentType: blob.type });
    await registerStorageFile(campaignId, vName2);
  } catch (err) { console.warn('Copia immagine oggetto fallita:', err); }
}
