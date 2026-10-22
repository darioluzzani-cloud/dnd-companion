import { uid } from '@/lib/types';
import { normName } from '@/lib/dnd/catalog';
import { ITEM_TYPES } from '@/components/shared/common';

// ─── IMPORTAZIONE IN ARMERIA ─────────────────────────────────
// Il pulsante «Importa» del Backup sostituisce lo stato chiave per chiave,
// e su `armory` cancellerebbe l'intero catalogo. Questa importazione invece
// AGGIUNGE: le voci del file entrano in coda, quelle che l'armeria conosce
// già per nome si saltano senza toccarle — testo, prezzo e immagine
// restano come il DM li aveva lasciati.
//
// Accetta sia un file nella forma { "armory": [ … ] } sia un elenco nudo.

export interface ArmoryImport {
  next: any[];          // l'armeria dopo l'importazione
  added: string[];      // nomi delle voci aggiunte
  skipped: string[];    // nomi già presenti, saltati
  invalid: number;      // voci senza nome, scartate
  renamedIds: number;   // voci aggiunte con un identificativo nuovo (il loro era già in uso)
}

export function parseArmoryFile(data: any): any[] | null {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.armory)) return data.armory;
  return null;
}

export function mergeArmory(current: any[], incoming: any[]): ArmoryImport {
  const next = [...(current || [])];
  const names = new Set(next.map(e => normName(e?.name)));
  const ids = new Set(next.map(e => e?.id));
  const added: string[] = [], skipped: string[] = [];
  let invalid = 0, renamedIds = 0;

  for (const raw of incoming || []) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name) { invalid++; continue; }
    if (names.has(normName(name))) { skipped.push(name); continue; }
    // Un identificativo già in uso apparterrebbe a un'altra voce — e alla
    // sua immagine: la nuova ne riceve uno proprio.
    let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
    if (!id || ids.has(id)) { if (id) renamedIds++; id = uid('arm'); }
    const type = ITEM_TYPES.includes(raw.type) ? raw.type : 'altro';
    next.push({ ...raw, id, name, type });
    names.add(normName(name)); ids.add(id); added.push(name);
  }
  return { next, added, skipped, invalid, renamedIds };
}
