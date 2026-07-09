'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U, ITEM_TYPES } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { copyItemImage } from '@/components/shared/imageCopy';

// ─── POPUP: ARMERIA — catalogo oggetti preparati dal DM ─────
// Speculare al Bestiario: il DM prepara gli oggetti prima della sessione
// e all'occorrenza li "consegna" nell'inventario di un personaggio.
// Le voci usano lo slot immagine item-<id>, lo stesso schema degli oggetti
// d'inventario: la consegna copia l'immagine sul nuovo oggetto (copyItemImage).

export interface ArmoryEntry { id: string; name: string; type: string; desc?: string; effect?: string; }

export function ArmoryPopup({ s, update, campaignId, onClose }: { s: CampaignState; update: U; campaignId: string | null; onClose: () => void }) {
  const [filter, setFilter] = useState<string>(ITEM_TYPES[0]);
  const [draftName, setDraftName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [given, setGiven] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExp = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const armory: ArmoryEntry[] = (s as any).armory || [];
  const setArmory = (list: ArmoryEntry[]) => update({ armory: list } as any);
  const filtered = armory.filter(e => e.type === filter);

  const addEntry = () => {
    if (!draftName.trim()) return;
    setArmory([...armory, { id: uid('arm'), name: draftName.trim(), type: filter, desc: '' }]);
    setDraftName('');
  };
  const patchEntry = (id: string, patch: Partial<ArmoryEntry>) =>
    setArmory(armory.map(e => e.id === id ? { ...e, ...patch } : e));

  // Consegna: crea l'oggetto nell'inventario del PG scelto e copia l'immagine
  const give = (e: ArmoryEntry, playerId: string) => {
    if (!playerId) return;
    const newId = uid('it');
    update(prev => ({
      players: prev.players.map(pl => pl.id === playerId
        ? { ...pl, inventory: [...(pl.inventory || []), { id: newId, name: e.name, qty: 1, type: e.type, desc: e.desc || '', effect: e.effect || '', equipped: false, expanded: false } as any] }
        : pl),
    }));
    if (campaignId) copyItemImage(campaignId, e.id, newId);
    setGiven(e.id); setTimeout(() => setGiven(g => g === e.id ? null : g), 1600);
  };

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ borderColor: 'var(--gold-dim)', boxShadow: '0 0 40px rgba(216,180,92,.10)' }}>
        {/* Header */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5"><path d="M20 6l-8 8M6.5 20L4 17.5l3-3M14 4l6 6M4 20l3.5-.5L20 7l-3-3L4.5 16.5 4 20z"/></svg>
            <div className="h2" style={{ color: 'var(--gold)' }}>Armeria</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
        </div>

        {/* Filtro per categoria */}
        <div className="row" style={{ gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {ITEM_TYPES.map(t => (
            <button key={t} className="pill" style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 9,
              background: filter === t ? 'var(--bg-active)' : 'transparent',
              borderColor: filter === t ? 'var(--gold)' : 'var(--border)',
              color: filter === t ? 'var(--gold)' : 'var(--gray-purple-deep)' }}
              onClick={() => setFilter(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Nessun oggetto in questa categoria. Prepara qui gli oggetti e consegnali quando servono.</div>
        )}

        {/* Voci */}
        {filtered.map(e => (
          <div key={e.id} className="card" style={{ padding: '10px 12px' }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: expanded.has(e.id) ? 48 : 32, height: expanded.has(e.id) ? 48 : 32, flexShrink: 0, overflow: 'hidden', borderRadius: 6, transition: 'all .15s' }}>
                <ImageSlot slotId={'item-' + e.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={s.dmMode} placeholder={e.name.slice(0, 2).toUpperCase()} alt={e.name} />
              </div>
              <div className="grow">
                <div className="row" style={{ gap: 6, alignItems: 'baseline', cursor: 'pointer' }} onClick={() => toggleExp(e.id)}>
                  <div className="grow" style={{ fontWeight: 500, fontSize: 14 }}>{e.name} <span className="small muted">· {e.type}</span></div>
                  <span className="small muted" style={{ fontSize: 13 }}>{expanded.has(e.id) ? '▾' : '▸'}</span>
                </div>
                {expanded.has(e.id) && (editingId === e.id ? (
                  <div style={{ marginTop: 6 }}>
                    <input value={e.name} onChange={ev => patchEntry(e.id, { name: ev.target.value })} style={{ fontSize: 13, padding: '3px 8px', width: '100%', marginBottom: 3 }} />
                    <select value={e.type} onChange={ev => patchEntry(e.id, { type: ev.target.value })} style={{ fontSize: 12, marginBottom: 3 }}>
                      {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={e.effect || ''} placeholder="Effetto (es. Recupera 2d4+2 PF)…" onChange={ev => patchEntry(e.id, { effect: ev.target.value })} style={{ fontSize: 12, padding: '4px 8px', width: '100%', marginBottom: 3, borderColor: 'var(--gold-dim)' }} />
                    <textarea value={e.desc || ''} placeholder="Descrizione…" onChange={ev => patchEntry(e.id, { desc: ev.target.value })} style={{ fontSize: 12, padding: '5px 8px', minHeight: 40, width: '100%' }} />
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    {e.effect && <div className="small" style={{ color: 'var(--gold-light)' }}>✦ {e.effect}</div>}
                    {e.desc && <div className="small muted" style={{ marginTop: 3, fontStyle: 'italic' }}>{e.desc}</div>}
                    {!e.effect && !e.desc && <div className="small muted">(nessun dettaglio)</div>}
                  </div>
                ))}
                {/* Consegna */}
                {expanded.has(e.id) && (
                <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select id={'give-' + e.id} defaultValue="" style={{ fontSize: 11 }}>
                    <option value="">— a chi? —</option>
                    {s.players.map(p => <option key={p.id} value={p.id}>{(p as any).short || p.name}</option>)}
                  </select>
                  <button className="btn btn-gold" style={{ fontSize: 10, padding: '3px 10px' }}
                    onClick={() => { const sel = document.getElementById('give-' + e.id) as HTMLSelectElement; give(e, sel?.value || ''); }}>
                    Consegna
                  </button>
                  {given === e.id && <span className="small" style={{ color: 'var(--green)' }}>✓ consegnato</span>}
                  <div className="grow" />
                  <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 9 }} onClick={() => setEditingId(editingId === e.id ? null : e.id)}>{editingId === e.id ? 'Fine' : 'Modifica'}</button>
                  <button className="btn btn-danger btn-ghost" style={{ padding: '2px 7px', fontSize: 9 }} onClick={() => { if (confirm('Eliminare dal catalogo?')) setArmory(armory.filter(x => x.id !== e.id)); }}>&times;</button>
                </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Aggiunta */}
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <input className="grow" placeholder={'Nuovo oggetto (' + filter + ')…'} value={draftName} onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addEntry(); }} />
          <button className="btn btn-gold" onClick={addEntry}>+</button>
        </div>
      </div>
    </div>
  );
}
