import { uid } from '@/lib/types';
import { copyItemImage } from '@/components/shared/imageCopy';

// ─── L'ARMERIA COME DISPENSA ─────────────────────────────────
// L'armeria è il catalogo canonico degli oggetti del mondo: là un oggetto
// ha immagine, effetto, descrizione, slot di potenziamento, corredo,
// sintonia e padronanza. Ogni volta che l'app deve far comparire un oggetto
// in un inventario — la conceria che consegna il cuoio, un domani la fucina
// o il mercato — deve pescare da lì invece di fabbricare una voce nuda col
// solo nome, altrimenti nascono doppioni: due «Cuoio» che si chiamano
// uguale e non si somigliano.
//
// Il confronto è per nome, tollerante a maiuscole e spazi: è il criterio
// che il DM usa già scrivendo le ricette e le merci del mercato.

export const normName = (n?: string) => (n || '').trim().toLowerCase();

/** Voce d'armeria che corrisponde a questo nome, se esiste. */
export function armoryByName(s: any, name?: string): any | undefined {
  if (!name) return undefined;
  const k = normName(name);
  return ((s?.armory || []) as any[]).find(e => normName(e.name) === k);
}

/**
 * Oggetto già presente in un inventario qualsiasi con quel nome. Serve solo
 * come ripiego per l'illustrazione quando l'armeria tace: un oggetto che
 * qualcuno possiede ha comunque un'immagine da mostrare.
 */
export function anyItemByName(s: any, name?: string): any | undefined {
  if (!name) return undefined;
  const k = normName(name);
  for (const pl of ((s?.players || []) as any[])) {
    const f = (pl.inventory || []).find((it: any) => normName(it.name) === k);
    if (f) return f;
  }
  return undefined;
}

/**
 * Il riferimento migliore per un nome: prima l'armeria, poi un esemplare
 * posseduto. `source` dice da dove viene, perché l'interfaccia possa
 * distinguere una scheda piena da una semplice illustrazione.
 */
export function lookupByName(s: any, name?: string): { entry: any; source: 'armory' | 'inventory' } | null {
  const a = armoryByName(s, name);
  if (a) return { entry: a, source: 'armory' };
  const i = anyItemByName(s, name);
  if (i) return { entry: i, source: 'inventory' };
  return null;
}

/**
 * Costruisce la voce d'inventario per `name`, ricalcando la scheda
 * d'armeria quando c'è. Restituisce anche l'identificativo d'origine, così
 * il chiamante possa copiare l'illustrazione con `cloneImage`.
 */
export function itemFromArmory(s: any, name: string, qty: number, fallbackType = 'altro'): { item: any; sourceId?: string } {
  const id = uid('i');
  const e = armoryByName(s, name);
  if (!e) {
    const owned = anyItemByName(s, name);
    if (owned) {
      // Nessuna scheda d'armeria, ma qualcuno lo possiede: ne ricalco la
      // forma invece di inventarne una terza.
      const { id: _i, qty: _q, equipped: _e, slot: _s, attuned: _a, batches: _b, madeOn: _m, pu: _p, upgrades: _u, ...shape } = owned as any;
      return { item: { ...shape, id, qty, equipped: false, expanded: false, revealed: true }, sourceId: owned.id };
    }
    return { item: { id, name, qty, type: fallbackType, revealed: true, equipped: false, expanded: false }, sourceId: undefined };
  }
  return {
    item: {
      id, name: e.name, qty,
      type: e.type || fallbackType,
      desc: e.desc || '', effect: e.effect || '',
      subtype: e.subtype, armorType: e.armorType, armorCA: e.armorCA,
      enhSlots: e.enhSlots, setId: e.setId, attunement: e.attunement,
      mastery: e.mastery, ammo: e.ammo,
      equipped: false, expanded: false, revealed: true,
    },
    sourceId: e.id,
  };
}

/** Copia l'illustrazione dall'origine al nuovo oggetto, se c'è. */
export function cloneImage(campaignId: string | null, sourceId?: string, targetId?: string) {
  if (campaignId && sourceId && targetId) copyItemImage(campaignId, sourceId, targetId);
}
