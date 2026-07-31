'use client';
import { useState } from 'react';
import { ITEM_TYPES, computeAC } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { ItemDetailBody } from '@/components/shared/ItemDetail';
import { ATTUNE_MAX, attunedCount, subtypesFor, itemGradient } from '@/lib/dnd/equipment';
import { NumberInput } from '@/components/shared/textUtils';

// ─── GRIGLIA DELL'INVENTARIO ─────────────────────────────────
// Una fascia per categoria, disposte in verticale; dentro ogni fascia le
// tessere degli oggetti mandano a capo, così nulla resta nascosto oltre il
// bordo. L'etichetta della categoria è ruotata di novanta gradi in senso
// antiorario sul fianco sinistro. Sfondo e larghezza sono quelli della
// sagoma dell'equipaggiamento, per continuità visiva fra le due viste.

// I nomi lunghi vanno abbreviati: ruotati occuperebbero più altezza di
// quanta ne abbia una fascia con poche tessere.
const CAT_SHORT: Record<string, string> = {
  equipaggiamento: 'equipagg.',
  consumabile: 'consumab.',
  alchemico: 'alchemico',
};
const shortCat = (c: string) => CAT_SHORT[c] || c;

const TILE = 74;
const ROW_MIN = 104;

export function InventoryGrid({ s, p, updPlayer, campaignId, items, gradientFor, onEnlarge, setItemField }: {
  s: any; p: any; updPlayer: (fn: (pl: any) => any) => void; campaignId: string | null;
  items: any[]; gradientFor: (it: any) => string | undefined;
  onEnlarge: (src: string) => void;
  setItemField: (id: string, field: string, value: any) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const accent = p?.color || 'var(--gold)';
  const detail = detailId ? (p.inventory || []).find((it: any) => it.id === detailId) : null;

  const toggleEquip = (it: any) => {
    const willEquip = !it.equipped;
    updPlayer((pl: any) => {
      const inventory = (pl.inventory || []).map((x: any) => x.id === it.id
        ? { ...x, equipped: willEquip, slot: willEquip ? x.slot : undefined }
        : x);
      const newPl = { ...pl, inventory };
      return it.type === 'armatura' ? { ...newPl, ac: computeAC(newPl) } : newPl;
    });
  };

  const toggleAttune = (it: any) => {
    if (!it.attuned && attunedCount(p.inventory) >= ATTUNE_MAX) return;
    updPlayer((pl: any) => ({
      ...pl,
      inventory: (pl.inventory || []).map((x: any) => x.id === it.id ? { ...x, attuned: !x.attuned || undefined } : x),
    }));
  };

  const Tile = ({ it }: { it: any }) => {
    const qty = it.qty ?? 1;
    const spent = qty <= 0;   // esaurito: la tessera resta, l'immagine si spegne
    return (
      <div onClick={() => setDetailId(it.id)} title={it.name}
        style={{ width: TILE, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ position: 'relative', width: TILE, height: TILE, borderRadius: 8, overflow: 'hidden',
          border: it.equipped && !spent ? `2px solid ${accent}` : '1px solid var(--border)',
          background: 'var(--bg-input)',
          boxShadow: it.equipped && !spent ? `0 0 8px ${accent}44` : 'none' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: spent ? .28 : 1,
            filter: spent ? 'grayscale(1) brightness(.55)' : 'none', transition: 'all .2s' }}>
            <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width="100%" height="100%"
              dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
          </div>
          {it.attunement && (
            <span title={it.attuned ? 'Sintonizzato' : 'Richiede sintonia'}
              style={{ position: 'absolute', top: 1, left: 3, fontSize: 10, fontWeight: 700,
                color: it.attuned ? 'var(--blue)' : 'var(--gray-purple)', textShadow: '0 1px 3px #000' }}>◈</span>
          )}
          {(it.upgrades || []).length > 0 && (
            <span style={{ position: 'absolute', top: 1, right: 3, fontSize: 9, color: 'var(--ember)', textShadow: '0 1px 3px #000' }}>⚒</span>
          )}
          {(qty > 1 || spent) && (
            <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 9, fontWeight: 700,
              color: spent ? 'var(--red)' : '#fff', textShadow: '0 1px 3px #000' }}>×{qty}</span>
          )}
          {s.dmMode && it.revealed === false && (
            <span style={{ position: 'absolute', bottom: 1, left: 3, fontSize: 8, color: 'var(--gold)', textShadow: '0 1px 3px #000' }}>◯</span>
          )}
        </div>
        <span style={{ fontSize: 8, lineHeight: 1.2, textAlign: 'center',
          color: spent ? 'var(--gray-purple-deep)' : (it.equipped ? accent : 'var(--text)') }}>{it.name}</span>
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
      {/* Sfondo: il medesimo della sagoma, per continuità */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <ImageSlot slotId={'doll-' + (p?.id || 'x')} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="" />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(11,8,20,.35) 0%, rgba(11,8,20,.45) 35%, rgba(11,8,20,.75) 65%, rgba(11,8,20,.93) 88%, rgba(11,8,20,.97) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, padding: '10px 8px' }}>
        {ITEM_TYPES.map(cat => {
          const inCat = items.filter(it => (it.type || 'altro') === cat);
          return (
            <div key={cat} id={'shelf-' + cat}
              style={{ display: 'flex', gap: 8, alignItems: 'stretch', minHeight: ROW_MIN,
                borderBottom: '1px solid var(--border)', padding: '8px 0', scrollMarginTop: 70 }}>
              <div style={{ flexShrink: 0, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="label" style={{ fontSize: 9, letterSpacing: 1.5, whiteSpace: 'nowrap',
                  writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                  color: inCat.length ? 'var(--gray-purple)' : 'var(--gray-purple-deep)' }}>
                  {shortCat(cat)}
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}>
                {inCat.length === 0
                  ? <span className="small muted" style={{ fontStyle: 'italic', alignSelf: 'center', fontSize: 10 }}>—</span>
                  : inCat.map(it => <Tile key={it.id} it={it} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scheda dell'oggetto */}
      {detail && (
        <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) setDetailId(null); }}>
          <div className="alchemy-popup sheet-popup" style={{ maxWidth: 520, background: itemGradient(detail, accent, 135) || undefined }}>
            <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
              <button className="btn btn-ghost" style={{ fontSize: 16, padding: '2px 8px' }} onClick={() => setDetailId(null)}>✕</button>
            </div>

            <ItemDetailBody item={detail} inventory={p.inventory} campaignId={campaignId} accent={accent}
              onAttune={() => toggleAttune(detail)} onEnlarge={onEnlarge} slotPrefix="invgrid"
              onImgPos={s.dmMode ? (v: number) => setItemField(detail.id, 'imgPos', v) : undefined} />

            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn grow"
                style={{ fontSize: 11,
                  color: detail.equipped ? accent : undefined,
                  borderColor: detail.equipped ? accent : undefined,
                  background: detail.equipped ? 'var(--bg-active)' : undefined }}
                onClick={() => toggleEquip(detail)}>
                {detail.equipped ? 'Riponi nello zaino' : 'Indossa'}
              </button>
            </div>

            {s.dmMode && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                <div className="label" style={{ fontSize: 8, marginBottom: 6 }}>Redazione (DM)</div>
                <input value={detail.name} onChange={e => setItemField(detail.id, 'name', e.target.value)}
                  style={{ fontSize: 13, padding: '4px 8px', width: '100%', marginBottom: 4 }} />
                <div className="row" style={{ gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <select value={detail.type || 'altro'} onChange={e => { setItemField(detail.id, 'type', e.target.value); setItemField(detail.id, 'subtype', undefined); }} style={{ fontSize: 12, padding: '3px 6px' }}>
                    {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {subtypesFor(detail.type || '').length > 0 && (
                    <select value={detail.subtype || ''} onChange={e => setItemField(detail.id, 'subtype', e.target.value || undefined)} style={{ fontSize: 12, padding: '3px 6px' }}>
                      <option value="">— sottocategoria —</option>
                      {subtypesFor(detail.type || '').map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  )}
                  <div className="row" style={{ gap: 3, alignItems: 'center' }}>
                    <span className="label" style={{ fontSize: 8 }}>Qt</span>
                    <NumberInput value={detail.qty ?? 1} min={0} onChange={n => setItemField(detail.id, 'qty', n)}
                      style={{ width: 46, textAlign: 'center', fontSize: 12, padding: '2px 4px' }} />
                  </div>
                </div>

                {detail.type === 'armatura' && (
                  <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                    <select value={detail.armorType || ''} onChange={e => setItemField(detail.id, 'armorType', e.target.value)} style={{ fontSize: 11, padding: '2px 4px', flex: 1 }}>
                      <option value="">— foggia —</option>
                      <option value="leggera">Leggera</option>
                      <option value="media">Media</option>
                      <option value="pesante">Pesante</option>
                      <option value="scudo">Scudo</option>
                    </select>
                    <div className="row" style={{ gap: 3, alignItems: 'center' }}>
                      <span className="label" style={{ fontSize: 8 }}>CA</span>
                      <NumberInput value={detail.armorCA || 0} onChange={n => setItemField(detail.id, 'armorCA', n)}
                        style={{ width: 46, textAlign: 'center', fontSize: 12, padding: '2px 4px' }} />
                    </div>
                  </div>
                )}

                {(detail.type === 'magico' || detail.type === 'unico') && (
                  <label className="row" style={{ gap: 5, alignItems: 'center', marginBottom: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!detail.attunement} onChange={e => setItemField(detail.id, 'attunement', e.target.checked || undefined)} />
                    <span className="small" style={{ color: detail.attunement ? 'var(--blue)' : 'var(--gray-purple)' }}>◈ Richiede sintonia</span>
                  </label>
                )}

                {['arma', 'armatura', 'magico', 'unico'].includes(detail.type) && (
                  <div className="row" style={{ gap: 3, marginBottom: 4, alignItems: 'center' }}>
                    <span className="label" style={{ fontSize: 8 }}>Slot potenziamento</span>
                    <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 10 }}
                      onClick={() => setItemField(detail.id, 'enhSlots', Math.max(0, (detail.enhSlots ?? 0) - 1))}>−</button>
                    <span className="small muted">{detail.enhSlots ?? 0}</span>
                    <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 10 }}
                      onClick={() => setItemField(detail.id, 'enhSlots', Math.min(3, (detail.enhSlots ?? 0) + 1))}>+</button>
                  </div>
                )}

                <input value={detail.effect || ''} placeholder="Effetto…" onChange={e => setItemField(detail.id, 'effect', e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', width: '100%', marginBottom: 4, borderColor: 'var(--gold-dim)' }} />
                <textarea value={detail.desc || ''} placeholder="Descrizione…" onChange={e => setItemField(detail.id, 'desc', e.target.value)}
                  style={{ fontSize: 12, padding: '6px 8px', minHeight: 50, width: '100%' }} />
                <select value={detail.setId || ''} onChange={e => setItemField(detail.id, 'setId', e.target.value || undefined)} style={{ fontSize: 11, padding: '3px 6px', width: '100%', marginTop: 4 }}>
                  <option value="">— nessun set —</option>
                  {(s.itemSets || []).map((st: any) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>

                <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 9 }}
                    title={detail.revealed === false ? 'Mostra al giocatore' : 'Nascondi al giocatore'}
                    onClick={() => setItemField(detail.id, 'revealed', detail.revealed === false ? undefined : false)}>
                    {detail.revealed === false ? '◯ nascosto' : '◉ visibile'}
                  </button>
                  <div className="grow" />
                  <button className="btn btn-danger btn-ghost" style={{ padding: '2px 8px', fontSize: 9 }}
                    onClick={() => { if (confirm('Eliminare "' + detail.name + '"?')) { updPlayer((pl: any) => ({ ...pl, inventory: (pl.inventory || []).filter((i: any) => i.id !== detail.id) })); setDetailId(null); } }}>Elimina</button>
                </div>
              </div>
            )}
            {detail.equipped && detail.slot && (
              <div className="small muted" style={{ textAlign: 'center', marginTop: 5, fontStyle: 'italic' }}>
                Collocato sulla sagoma; riponendolo libererai la casella.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
