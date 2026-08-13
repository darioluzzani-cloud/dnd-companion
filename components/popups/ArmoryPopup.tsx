'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U, ITEM_TYPES } from '@/components/shared/common';
import { subtypesFor } from '@/lib/dnd/equipment';
import { ImageSlot } from '@/components/ImageSlot';
import { copyItemImage } from '@/components/shared/imageCopy';
import { MasteryEntry, DEFAULT_MASTERIES, masteriesOf } from '@/lib/dnd/mastery';

// ─── POPUP: ARMERIA — catalogo oggetti preparati dal DM ─────
// Speculare al Bestiario: il DM prepara gli oggetti prima della sessione
// e all'occorrenza li "consegna" nell'inventario di un personaggio.
// Le voci usano lo slot immagine item-<id>, lo stesso schema degli oggetti
// d'inventario: la consegna copia l'immagine sul nuovo oggetto (copyItemImage).

export interface ArmoryEntry { id: string; name: string; type: string; desc?: string; effect?: string; armorType?: string; armorCA?: number; enhSlots?: number; setId?: string; subtype?: string; attunement?: boolean; mastery?: string; }

export function ArmoryPopup({ s, update, campaignId, onClose }: { s: CampaignState; update: U; campaignId: string | null; onClose: () => void }) {
  const [filter, setFilter] = useState<string>(ITEM_TYPES[0]);
  const [draftName, setDraftName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [given, setGiven] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showMast, setShowMast] = useState(false);          // catalogo padronanze aperto
  const [editMastId, setEditMastId] = useState<string | null>(null);
  const toggleExp = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Catalogo delle padronanze ──
  // Vive nello stato della campagna; se non è mai stato toccato si parte
  // dalle otto canoniche, che vengono materializzate alla prima modifica.
  const masteries: MasteryEntry[] = masteriesOf(s);
  const setMasteries = (list: MasteryEntry[]) => update({ masteries: list } as any);
  const patchMastery = (id: string, patch: Partial<MasteryEntry>) =>
    setMasteries(masteries.map(m => m.id === id ? { ...m, ...patch } : m));
  const addMastery = () => setMasteries([...masteries, { id: uid('mst'), name: 'Nuova padronanza', desc: '', custom: true }]);
  const resetMasteries = () => { if (confirm('Ripristinare le otto padronanze canoniche? Le voci aggiunte a mano andranno perdute.')) setMasteries(DEFAULT_MASTERIES); };

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
        ? { ...pl, inventory: [...(pl.inventory || []), { id: newId, name: e.name, qty: 1, type: e.type, desc: e.desc || '', effect: e.effect || '', armorType: e.armorType, armorCA: e.armorCA, enhSlots: e.enhSlots, setId: e.setId, subtype: e.subtype, attunement: e.attunement, mastery: e.mastery, equipped: false, expanded: false } as any] }
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

        {/* ── Catalogo delle padronanze ──────────────────────
            Redatto qui una volta sola: le armi vi fanno riferimento, quindi
            correggere un testo lo corregge in ogni inventario. */}
        <div className="card" style={{ padding: '9px 11px', marginBottom: 10, borderColor: showMast ? 'var(--ember)' : 'var(--border)' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowMast(v => !v)}>
            <span style={{ color: 'var(--ember)', fontSize: 13 }}>⚔</span>
            <div className="label" style={{ color: 'var(--ember)' }}>Padronanze d'arma</div>
            <div className="grow" />
            <span className="small muted" style={{ fontSize: 10 }}>{masteries.length}</span>
            <span style={{ fontSize: 13, color: 'var(--ember)', transition: 'transform .2s', display: 'inline-block', transform: showMast ? 'rotate(180deg)' : '' }}>▾</span>
          </div>
          {showMast && (
            <div style={{ marginTop: 8 }}>
              {masteries.map(m => (
                <div key={m.id} className="card" style={{ padding: '7px 9px', marginBottom: 4,
                  borderLeft: '2px solid ' + (m.custom ? 'var(--gold)' : 'var(--ember)') }}>
                  {editMastId === m.id ? (
                    <>
                      <input value={m.name} onChange={ev => patchMastery(m.id, { name: ev.target.value })}
                        style={{ width: '100%', fontSize: 12, fontWeight: 600, padding: '3px 7px', marginBottom: 4 }} />
                      <textarea value={m.desc} placeholder="Effetto della padronanza…" onChange={ev => patchMastery(m.id, { desc: ev.target.value })}
                        style={{ width: '100%', fontSize: 11.5, padding: '5px 7px', minHeight: 62 }} />
                      <div className="row" style={{ gap: 5, marginTop: 5 }}>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 9 }} onClick={() => setEditMastId(null)}>Fine</button>
                        <div className="grow" />
                        <button className="btn btn-danger btn-ghost" style={{ padding: '2px 8px', fontSize: 9 }}
                          onClick={() => { if (confirm('Eliminare «' + m.name + '» dal catalogo? Le armi che vi fanno riferimento resteranno senza padronanza.')) { setMasteries(masteries.filter(x => x.id !== m.id)); setEditMastId(null); } }}>Elimina</button>
                      </div>
                    </>
                  ) : (
                    <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: m.custom ? 'var(--gold)' : 'var(--ember)' }}>{m.name}</div>
                        <div className="small muted" style={{ fontSize: 10.5, lineHeight: 1.5, marginTop: 2 }}>{m.desc || '(nessuna descrizione)'}</div>
                      </div>
                      <button className="btn btn-ghost" style={{ padding: '1px 7px', fontSize: 9, flexShrink: 0 }} onClick={() => setEditMastId(m.id)}>✎</button>
                    </div>
                  )}
                </div>
              ))}
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 9px' }} onClick={addMastery}>+ padronanza</button>
                <div className="grow" />
                <button className="btn btn-ghost" style={{ fontSize: 9, padding: '3px 9px' }} onClick={resetMasteries}>Ripristina le canoniche</button>
              </div>
            </div>
          )}
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
                    <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                      <select value={e.type} onChange={ev => patchEntry(e.id, { type: ev.target.value, subtype: undefined })} style={{ fontSize: 12 }}>
                        {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {subtypesFor(e.type).length > 0 && (
                        <select value={e.subtype || ''} onChange={ev => patchEntry(e.id, { subtype: ev.target.value || undefined })} style={{ fontSize: 12 }}>
                          <option value="">— sottocategoria —</option>
                          {subtypesFor(e.type).map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      )}
                    </div>
                    <input value={e.effect || ''} placeholder="Effetto (es. Recupera 2d4+2 PF)…" onChange={ev => patchEntry(e.id, { effect: ev.target.value })} style={{ fontSize: 12, padding: '4px 8px', width: '100%', marginBottom: 3, borderColor: 'var(--gold-dim)' }} />
                    {e.type === 'armatura' && (
                      <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                        <select value={e.armorType || ''} onChange={ev => patchEntry(e.id, { armorType: ev.target.value })} style={{ fontSize: 11, padding: '2px 4px', flex: 1 }}>
                          <option value="">— tipo armatura —</option>
                          <option value="leggera">Leggera</option>
                          <option value="media">Media</option>
                          <option value="pesante">Pesante</option>
                          <option value="scudo">Scudo</option>
                        </select>
                        <div className="row" style={{ gap: 3, alignItems: 'center' }}>
                          <span className="label" style={{ fontSize: 8 }}>CA</span>
                          <input type="number" value={e.armorCA || 0} onChange={ev => patchEntry(e.id, { armorCA: parseInt(ev.target.value) || 0 })} style={{ width: 44, textAlign: 'center', fontSize: 12, padding: '2px 4px' }} />
                        </div>
                      </div>
                    )}
                    {(e.type === 'arma' || e.type === 'armatura' || e.type === 'magico' || e.type === 'unico') && (
                      <div className="row" style={{ gap: 3, marginBottom: 3, alignItems: 'center' }}>
                        <span className="label" style={{ fontSize: 8 }}>Slot potenziamento</span>
                        <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 10 }} onClick={() => patchEntry(e.id, { enhSlots: Math.max(0, (e.enhSlots ?? 0) - 1) })}>−</button>
                        <span className="small muted">{e.enhSlots ?? 0}/3</span>
                        <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 10 }} onClick={() => patchEntry(e.id, { enhSlots: Math.min(3, (e.enhSlots ?? 0) + 1) })}>+</button>
                      </div>
                    )}
                    {(e.type === 'arma' || e.type === 'magico' || e.type === 'unico') && (
                      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 3 }}>
                        <span className="label" style={{ fontSize: 8, flexShrink: 0 }}>Padronanza</span>
                        <select className="grow" value={e.mastery || ''} style={{ fontSize: 11, padding: '3px 6px' }}
                          onChange={ev => patchEntry(e.id, { mastery: ev.target.value || undefined })}>
                          <option value="">— nessuna —</option>
                          {masteries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    )}
                    <label className="row" style={{ gap: 5, alignItems: 'center', marginBottom: 4, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!e.attunement} onChange={ev => patchEntry(e.id, { attunement: ev.target.checked })} />
                      <span className="small" style={{ color: e.attunement ? 'var(--blue)' : 'var(--gray-purple)' }}>◈ Richiede sintonia</span>
                    </label>
                    <select value={e.setId || ''} onChange={ev => patchEntry(e.id, { setId: ev.target.value || undefined })} style={{ fontSize: 11, padding: '3px 6px', width: '100%', marginBottom: 3 }}>
                      <option value="">— nessun set —</option>
                      {(s.itemSets || []).map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                    </select>
                    <textarea value={e.desc || ''} placeholder="Descrizione…" onChange={ev => patchEntry(e.id, { desc: ev.target.value })} style={{ fontSize: 12, padding: '5px 8px', minHeight: 40, width: '100%' }} />
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    {e.mastery && (
                      <div className="small" style={{ color: 'var(--ember)' }}>⚔ {masteries.find(m => m.id === e.mastery)?.name || '—'}</div>
                    )}
                    {e.attunement && <div className="small" style={{ color: 'var(--blue)' }}>◈ Richiede sintonia</div>}
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
