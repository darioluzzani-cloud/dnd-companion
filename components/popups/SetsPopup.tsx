'use client';
import { useState } from 'react';
import { CampaignState, uid, ItemSet } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';

// ─── POPUP: SET D'OGGETTI ────────────────────────────────────
// Consultabile da tutti, editabile dal DM. Il conteggio è per singolo
// personaggio: un set è completo quando il PG selezionato in scheda ha
// `pieces` istanze equipaggiate con quel setId. Le caselle mostrano le
// immagini dei pezzi posseduti (accese se equipaggiati); il box effetto
// resta oscurato finché il set non è completo.

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function SetsPopup({ s, update, p, campaignId, onClose }: { s: CampaignState; update: U; p: any; campaignId: string | null; onClose: () => void }) {
  const sets: ItemSet[] = s.itemSets || [];
  const setSets = (list: ItemSet[]) => update({ itemSets: list } as any);
  const [editing, setEditing] = useState(false);

  const inv: any[] = p?.inventory || [];
  // Visibilità: il DM vede tutti i set; il giocatore vede solo i set di cui
  // il PG corrente possiede almeno un pezzo nel proprio inventario, così un
  // set ancora non "toccato" da quel personaggio non ne rivela l'esistenza.
  const visibleSets = s.dmMode ? sets : sets.filter(set => inv.some(it => it.setId === set.id));

  const addSet = () => setSets([...sets, { id: uid('set'), name: 'Nuovo set', pieces: 2, effect: '', color: '#c0783c' }]);
  const patchSet = (id: string, patch: Partial<ItemSet>) => setSets(sets.map(x => x.id === id ? { ...x, ...patch } : x));

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup">
        {/* Header */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8L12 2z"/></svg>
            <div className="h2" style={{ color: 'var(--gold)' }}>Set d'oggetti</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {s.dmMode && <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => setEditing(v => !v)}>{editing ? 'Fine' : 'Modifica'}</button>}
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
          </div>
        </div>

        <div className="small muted" style={{ marginBottom: 10 }}>Pezzi equipaggiati da <b style={{ color: p?.color || 'var(--gold)' }}>{p?.short || p?.name || '—'}</b></div>

        {visibleSets.length === 0 && <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>{s.dmMode ? 'Nessun set definito. Creane uno qui sotto e assegna il set agli oggetti dall’Armeria o dall’inventario.' : 'Nessun set noto: se ne scoprirai i pezzi, compariranno qui.'}</div>}

        {visibleSets.map(set => {
          const owned = inv.filter(it => it.setId === set.id);
          const equipped = owned.filter(it => it.equipped);
          const complete = equipped.length >= set.pieces;
          const grad = `linear-gradient(135deg, ${hexToRgba(set.color, complete ? .5 : .16)} 0%, var(--bg-input) 65%)`;

          return (
            <div key={set.id} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10, border: `1px solid ${complete ? set.color : 'var(--border)'}` }}>
              <div style={{ background: grad, padding: '12px 14px' }}>
                {/* Titolo + contatore */}
                <div className="row" style={{ alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  {editing ? (
                    <input value={set.name} onChange={e => patchSet(set.id, { name: e.target.value })} style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, background: 'transparent', border: '1px solid var(--border)', padding: '3px 8px', flex: 1 }} />
                  ) : (
                    <div className="h2 grow" style={{ fontSize: 16, color: complete ? set.color : 'var(--text)' }}>{set.name}</div>
                  )}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: complete ? set.color : 'var(--gray-purple)' }}>
                    {equipped.length}/{set.pieces}
                  </div>
                </div>

                {/* Caselle-pezzo: possedute (con immagine), accese se equipaggiate;
                    i posti mancanti al numero pieces sono placeholder tratteggiati */}
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {owned.map(it => (
                    <div key={it.id} title={it.name + (it.equipped ? ' (equipaggiato)' : ' (nello zaino)')}
                      style={{ width: 46, height: 46, borderRadius: 8, overflow: 'hidden', position: 'relative',
                        border: `2px solid ${it.equipped ? set.color : 'var(--border)'}`,
                        opacity: it.equipped ? 1 : .4, filter: it.equipped ? 'none' : 'grayscale(.7)',
                        boxShadow: it.equipped ? `0 0 8px ${hexToRgba(set.color, .6)}` : 'none' }}>
                      <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, set.pieces - owned.length) }).map((_, i) => (
                    <div key={'ph' + i} style={{ width: 46, height: 46, borderRadius: 8, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-purple-deep)', fontSize: 18 }}>?</div>
                  ))}
                </div>

                {/* Editing DM dei parametri */}
                {editing && (
                  <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="row" style={{ gap: 3, alignItems: 'center' }}>
                      <span className="label" style={{ fontSize: 8 }}>Pezzi</span>
                      <input type="number" min={1} value={set.pieces} onChange={e => patchSet(set.id, { pieces: Math.max(1, parseInt(e.target.value) || 1) })} style={{ width: 44, textAlign: 'center', fontSize: 12, padding: '2px 4px' }} />
                    </div>
                    <div className="row" style={{ gap: 3, alignItems: 'center' }}>
                      <span className="label" style={{ fontSize: 8 }}>Colore</span>
                      <input type="color" value={set.color} onChange={e => patchSet(set.id, { color: e.target.value })} style={{ width: 32, height: 26, padding: 0, border: '1px solid var(--border)', background: 'transparent' }} />
                    </div>
                    <div className="grow" />
                    <button className="btn btn-danger btn-ghost" style={{ fontSize: 9, padding: '2px 7px' }} onClick={() => { if (confirm('Eliminare il set?')) setSets(sets.filter(x => x.id !== set.id)); }}>Elimina set</button>
                  </div>
                )}
              </div>

              {/* Box effetto: oscurato se incompleto, acceso a set completo */}
              <div style={{ padding: '10px 14px', borderTop: `1px solid ${complete ? hexToRgba(set.color, .4) : 'var(--border)'}` }}>
                {editing ? (
                  <textarea value={set.effect} placeholder="Effetto del set completo…" onChange={e => patchSet(set.id, { effect: e.target.value })} style={{ fontSize: 12, padding: '6px 8px', minHeight: 44, width: '100%' }} />
                ) : complete ? (
                  <div>
                    <div className="label" style={{ fontSize: 8, color: set.color, marginBottom: 3 }}>◆ Bonus di set attivo</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{set.effect || '(nessun effetto descritto)'}</div>
                  </div>
                ) : (
                  <div className="row" style={{ gap: 8, alignItems: 'center', color: 'var(--gray-purple-deep)' }}>
                    <span style={{ fontSize: 15 }}>🔒</span>
                    <span className="small" style={{ fontStyle: 'italic' }}>Set incompleto — equipaggia tutti i pezzi per rivelarne il bonus ({equipped.length}/{set.pieces}).</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {s.dmMode && editing && (
          <button className="btn btn-gold" style={{ width: '100%', marginTop: 4 }} onClick={addSet}>+ Nuovo set</button>
        )}
      </div>
    </div>
  );
}
