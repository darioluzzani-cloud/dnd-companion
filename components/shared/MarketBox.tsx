'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { ImageSlot, registerStorageFile } from '@/components/ImageSlot';
import { U } from '@/components/shared/common';
import { isMarketDay, formatDateShort } from '@/lib/dnd/calendar';
import { DEFAULT_STALLS, DEFAULT_RUMORS, MARKET_LEVELS, MarketStall, MarketRumor, marketLevelFromBuilding, rollMarket, drawItems } from '@/lib/dnd/market';

// ─── MERCATO DI OLMOBIANCO ───────────────────────────────────
// Box ripiegabile sul modello della Fucina. Sempre visibile al DM;
// ai giocatori compare solo nel giorno di mercato (6º giorno della
// settimana velmorana) e solo se la Piazza ha raggiunto il Livello 2.
// Il mercato tirato è condiviso via Supabase (chiave 'market') e resta
// valido finché il dateKey coincide con la data del calendario.

const NATURE_COLORS: Record<string, string> = {
  'Vera': 'var(--green)', 'Colore': 'var(--gray-purple)', 'Inquietante': 'var(--blue)',
};
const natureColor = (n: string) => NATURE_COLORS[n] || (n.startsWith('Vera') ? 'var(--green)' : 'var(--gray-purple)');

export function MarketBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  const [open, setOpen] = useState(false);
  const [bgTick, setBgTick] = useState(0);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showRumors, setShowRumors] = useState(false);

  const cal = s.calendar;
  const d = cal?.date;
  const dateKey = d ? `${d.day}/${d.month}/${d.year}` : '';
  const marketToday = !!d && isMarketDay(d);

  const buildings: any[] = (s as any).buildings || [];
  const plaza = buildings.find((b: any) => b.id === s.marketBuildingId);
  const mktLevel = plaza ? marketLevelFromBuilding(plaza.level || 0) : 0;

  const stalls: MarketStall[] = (s.marketStalls && s.marketStalls.length) ? s.marketStalls : DEFAULT_STALLS;
  const rumors: MarketRumor[] = (s.marketRumors && s.marketRumors.length) ? s.marketRumors : DEFAULT_RUMORS;
  const market = s.market && s.market.dateKey === dateKey ? s.market : null;

  // Visibilità giocatori: solo giorno di mercato, con mercato attivo (Piazza ≥ L2)
  if (!s.dmMode && (!marketToday || mktLevel === 0)) return null;

  // Copy-on-write: la prima modifica al catalogo materializza i default nello stato
  const setStalls = (next: MarketStall[]) => update({ marketStalls: next } as any);
  const setRumors = (next: MarketRumor[]) => update({ marketRumors: next } as any);

  const doRoll = () => {
    if (mktLevel === 0 || !dateKey) return;
    update({ market: rollMarket(mktLevel as 1 | 2 | 3, stalls, dateKey) } as any);
  };
  const rerollStallItems = (stallId: string) => {
    const st = stalls.find(x => x.id === stallId); if (!st || !market) return;
    update({ market: { ...market, stalls: market.stalls.map(ms => ms.stallId === stallId ? { ...ms, items: drawItems(st) } : ms) } } as any);
  };
  const rollRumor = () => {
    if (!market) return;
    update({ market: { ...market, rumorRoll: Math.floor(Math.random() * 100) + 1 } } as any);
  };

  // Upload immagine su uno slot arbitrario, con il pattern collaudato (reload)
  const uploadTo = async (slotId: string, file: File) => {
    if (!campaignId) return;
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    try {
      const { data: ex } = await supabase.storage.from('campaign-images').list(campaignId, { search: slotId });
      const rm = (ex || []).filter((f: any) => f.name.startsWith(slotId + '.')).map((f: any) => `${campaignId}/${f.name}`);
      if (rm.length) await supabase.storage.from('campaign-images').remove(rm);
      const vName = `${slotId}.${Date.now().toString(36)}.${ext}`;
      await supabase.storage.from('campaign-images').upload(`${campaignId}/${vName}`, file, { upsert: true, cacheControl: '31536000', contentType: file.type });
      await registerStorageFile(campaignId, vName);
      window.location.reload();
    } catch (err: any) { alert('Errore: ' + (err.message || err)); }
  };

  const cfg = mktLevel > 0 ? MARKET_LEVELS[mktLevel] : null;

  return (
    <div className="frame" style={{ position: 'relative', overflow: 'hidden', borderColor: 'var(--gold)', padding: 0, minHeight: open ? undefined : 76 }}>
      {/* Sfondo del box */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <ImageSlot key={(open ? 'o' : 'c') + bgTick} slotId="market-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="Mercato di Olmobianco" />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: open
        ? 'linear-gradient(180deg, rgba(24,20,10,0) 0%, rgba(24,20,10,.55) 20%, rgba(24,20,10,.93) 40%, rgba(24,20,10,.98) 58%, rgba(24,20,10,.99) 100%)'
        : 'linear-gradient(90deg, rgba(24,20,10,.92) 0%, rgba(24,20,10,.45) 50%, rgba(24,20,10,0) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, padding: 16 }}>
        {/* Testata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
          <div className="grow">
            <div className="label" style={{ color: 'var(--gold)' }}>Mercato di Olmobianco</div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {mktLevel > 0 ? cfg!.label : 'Piazza non ancora costruita — nessun mercato'}
              {d && <> · {formatDateShort(d)}{marketToday ? ' · giorno di mercato' : ''}</>}
            </div>
          </div>
          {s.dmMode && !marketToday && <span className="dm-badge">NON È GIORNO DI MERCATO</span>}
          <span style={{ fontSize: 14, color: 'var(--gold)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : '' }}>▾</span>
        </div>

        {open && (
          <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>

            {/* Controlli DM: edificio di riferimento, immagine box, tiro */}
            {s.dmMode && (
              <div className="card" style={{ marginBottom: 10 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="small muted">Edificio che governa il mercato:</span>
                  <select value={s.marketBuildingId || ''} onChange={e => update({ marketBuildingId: e.target.value } as any)} style={{ fontSize: 12 }}>
                    <option value="">— scegli —</option>
                    {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name} (L{b.level})</option>)}
                  </select>
                  <label className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 9, cursor: 'pointer' }} title="Immagine del box">
                    📷 box
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadTo('market-bg', f); e.target.value = ''; }} />
                  </label>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <button className="btn btn-primary" disabled={mktLevel === 0} onClick={doRoll}>
                    {market ? 'Ritira il mercato' : 'Tira le bancarelle'} ({cfg ? `${cfg.fixed}+1d4` : '—'})
                  </button>
                  {market && <span className="small muted">{market.count} bancarelle uscite</span>}
                  <div className="grow" />
                  <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => setShowCatalog(v => !v)}>{showCatalog ? 'Chiudi catalogo' : 'Catalogo bancarelle'}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => setShowRumors(v => !v)}>{showRumors ? 'Chiudi dicerie' : 'Tabella dicerie'}</button>
                </div>
              </div>
            )}

            {/* Bancarelle del giorno — card verticali stile alchimia */}
            {market ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {market.stalls.map(ms => {
                  const st = stalls.find(x => x.id === ms.stallId); if (!st) return null;
                  const shownItems = (ms.items ?? st.items).slice(0, 5);
                  const isTales = st.kind === 'tales';
                  return (
                    <div key={ms.stallId} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ position: 'relative', height: 90 }}>
                        <ImageSlot slotId={'stall-' + st.id} campaignId={campaignId} shape="rect" width="100%" height={90} dmMode={false} placeholder="🏪" alt={st.name} />
                        {s.dmMode && (
                          <label className="btn btn-ghost" style={{ position: 'absolute', top: 4, right: 4, padding: '1px 5px', fontSize: 9, cursor: 'pointer', background: 'rgba(11,8,20,.7)' }} title="Immagine bancarella">
                            📷
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadTo('stall-' + st.id, f); e.target.value = ''; }} />
                          </label>
                        )}
                      </div>
                      <div style={{ padding: '8px 10px', flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--gold-light)' }}>{st.name}</div>
                        <div className="small muted" style={{ marginTop: 3, fontStyle: 'italic' }}>{st.desc}</div>
                        {shownItems.length > 0 && (
                          <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
                            {shownItems.map((it, i) => <li key={i}>{it}</li>)}
                          </ul>
                        )}
                        {s.dmMode && st.randomize && (
                          <button className="btn btn-ghost" style={{ fontSize: 9, marginTop: 6 }} onClick={() => rerollStallItems(st.id)}>⟳ ripesca oggetti</button>
                        )}
                        {isTales && (
                          <div style={{ marginTop: 8 }}>
                            <button className="btn" style={{ fontSize: 10, color: 'var(--blue)', borderColor: 'var(--blue)' }} onClick={rollRumor}>Tira d100 dicerie</button>
                            {market.rumorRoll != null && (() => {
                              const r = rumors.find(x => market.rumorRoll! >= x.from && market.rumorRoll! <= x.to);
                              return r ? (
                                <div className="card" style={{ marginTop: 6, padding: '6px 8px', borderLeft: '3px solid var(--blue)' }}>
                                  <div className="small muted">d100: {market.rumorRoll}</div>
                                  <div style={{ fontSize: 11, marginTop: 2 }}>{r.text}</div>
                                  {s.dmMode && <div className="small" style={{ marginTop: 3, color: natureColor(r.nature) }}>{r.nature} — {r.dmNote}</div>}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card muted small" style={{ textAlign: 'center' }}>
                {mktLevel === 0 ? 'La Piazza non ha ancora un mercato.' : s.dmMode ? 'Nessun mercato tirato per oggi.' : 'Le bancarelle non sono ancora state disposte.'}
              </div>
            )}

            {/* Catalogo bancarelle — editing DM */}
            {s.dmMode && showCatalog && (
              <div style={{ marginTop: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>Catalogo bancarelle</div>
                {stalls.map(st => (
                  <div key={st.id} className="card" style={{ marginBottom: 6 }}>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <input value={st.name} style={{ fontWeight: 600, fontSize: 12, flex: 1 }}
                        onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, name: e.target.value } : x))} />
                      <span className="small muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {[1, 2, 3].map(l => st.ranges[l] ? `L${l}:${st.ranges[l]![0]}–${st.ranges[l]![1]}` : null).filter(Boolean).join(' · ')}
                      </span>
                      <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!st.randomize}
                          onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, randomize: e.target.checked } : x))} /> random
                      </label>
                    </div>
                    <textarea value={st.desc} style={{ fontSize: 11, marginTop: 4, minHeight: 26, width: '100%' }}
                      onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, desc: e.target.value } : x))} />
                    <textarea value={st.items.join('\n')} placeholder="Un oggetto per riga (a schermo max 5)…" style={{ fontSize: 11, marginTop: 3, minHeight: 34, width: '100%' }}
                      onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, items: e.target.value.split('\n').filter(v => v.trim() !== '') } : x))} />
                  </div>
                ))}
              </div>
            )}

            {/* Tabella dicerie completa — stile meteo, riservata al DM */}
            {s.dmMode && showRumors && (
              <div style={{ marginTop: 12, fontSize: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>Dicerie della Marca (d100)</div>
                {rumors.map((r, i) => {
                  const isHit = market?.rumorRoll != null && market.rumorRoll >= r.from && market.rumorRoll <= r.to;
                  return (
                    <div key={i} className="card" style={{ padding: '8px 10px', marginBottom: 3,
                      borderLeft: isHit ? '3px solid var(--blue)' : '1px solid var(--border)',
                      background: isHit ? 'var(--bg-active)' : 'var(--bg-input)' }}>
                      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--gray-purple)', minWidth: 44 }}>
                          {r.from === r.to ? String(r.from).padStart(2, '0') : `${String(r.from).padStart(2, '0')}–${String(r.to).padStart(2, '0')}`}
                        </span>
                        <div className="grow">
                          <input value={r.text} style={{ fontSize: 11, width: '100%', background: 'transparent', border: 'none', padding: 0 }}
                            onChange={e => setRumors(rumors.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                          <div className="row" style={{ gap: 6, marginTop: 3 }}>
                            <input value={r.nature} style={{ fontSize: 10, width: 100, color: natureColor(r.nature) }}
                              onChange={e => setRumors(rumors.map((x, j) => j === i ? { ...x, nature: e.target.value } : x))} />
                            <input value={r.dmNote} style={{ fontSize: 10, flex: 1, fontStyle: 'italic' }}
                              onChange={e => setRumors(rumors.map((x, j) => j === i ? { ...x, dmNote: e.target.value } : x))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
