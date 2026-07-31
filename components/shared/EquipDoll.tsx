'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ImageSlot, registerStorageFile } from '@/components/ImageSlot';
import { ItemDetailBody } from '@/components/shared/ItemDetail';
import { computeAC } from '@/components/shared/common';
import { SLOT_BY_ID, SlotId, slotAccepts, isTwoHanded, ATTUNE_MAX, attunedCount } from '@/lib/dnd/equipment';

// ─── SAGOMA DELL'EQUIPAGGIAMENTO ─────────────────────────────
// Caselle fisse secondo lo schema: elmo e mantello in cima, parabracci e
// vesti scalati ai lati, le due mani a fiancheggiare l'armatura, stivali
// in fondo, quindi monili magici e consumabili a portata.
//
// Gesti distinti, per non far collidere consultazione e collocazione:
//   casella vuota → selettore degli oggetti idonei
//   casella piena → scheda dell'oggetto (effetto, descrizione), da cui si
//                   può comunque cambiare l'oggetto o sfilarlo
//
// Un'arma a due mani risiede nella mano principale e impegna anche la
// secondaria, che la rispecchia come impugnatura occupata.

const DIM = {
  sm: { w: 48, h: 48 },
  lg: { w: 72, h: 96 },
  xl: { w: 88, h: 116 },
};

const SIDE_OFFSET = 58;

export function EquipDoll({ s, p, updPlayer, campaignId, accent }: {
  s: any; p: any; updPlayer: (fn: (pl: any) => any) => void; campaignId: string | null; accent: string;
}) {
  const [picking, setPicking] = useState<SlotId | null>(null);
  const [detail, setDetail] = useState<SlotId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const inv: any[] = p?.inventory || [];
  const bySlot = (id: string) => inv.find(it => it.slot === id);
  const dollSlot = 'doll-' + (p?.id || 'x');

  // L'arma a due mani vive in mano1 e riverbera su mano2
  const mainHand = bySlot('mano1');
  const twoHandedActive = mainHand && isTwoHanded(mainHand) ? mainHand : null;

  // Oggetto mostrato in una casella (mano2 rispecchia l'arma a due mani)
  const shownIn = (id: string) => (id === 'mano2' && twoHandedActive) ? twoHandedActive : bySlot(id);

  const place = (slotId: SlotId, itemId: string) => {
    const item = inv.find(it => it.id === itemId);
    // Un'arma a due mani si radica nella mano principale e libera la secondaria
    const target: SlotId = (item && isTwoHanded(item) && (slotId === 'mano1' || slotId === 'mano2')) ? 'mano1' : slotId;
    const alsoClear = (item && isTwoHanded(item) && target === 'mano1') ? 'mano2' : null;
    // Se entra o esce un'armatura (corazza o scudo) la CA va ricalcolata
    const displaced = inv.filter(it => it.slot === target || (alsoClear && it.slot === alsoClear));
    const touchesArmor = (item?.type === 'armatura') || displaced.some(it => it.type === 'armatura');
    updPlayer(pl => {
      const inventory = (pl.inventory || []).map((it: any) => {
        if (it.id === itemId) return { ...it, slot: target, equipped: true };
        if (it.slot === target || (alsoClear && it.slot === alsoClear)) return { ...it, slot: undefined, equipped: false };
        return it;
      });
      const newPl = { ...pl, inventory };
      return touchesArmor ? { ...newPl, ac: computeAC(newPl) } : newPl;
    });
    setPicking(null); setShowAll(false);
  };

  const clear = (slotId: string) => {
    const removed = inv.find(it => it.slot === slotId);
    updPlayer(pl => {
      const inventory = (pl.inventory || []).map((it: any) => it.slot === slotId ? { ...it, slot: undefined, equipped: false } : it);
      const newPl = { ...pl, inventory };
      return removed?.type === 'armatura' ? { ...newPl, ac: computeAC(newPl) } : newPl;
    });
  };

  const toggleAttune = (itemId: string) => {
    const it = inv.find(x => x.id === itemId);
    if (!it) return;
    if (!it.attuned && attunedCount(inv) >= ATTUNE_MAX) return;   // limite raggiunto
    updPlayer(pl => ({
      ...pl,
      inventory: (pl.inventory || []).map((x: any) => x.id === itemId ? { ...x, attuned: !x.attuned || undefined } : x),
    }));
  };

  const setQty = (itemId: string, q: number) => {
    updPlayer(pl => ({
      ...pl,
      inventory: (pl.inventory || []).map((it: any) => it.id === itemId ? { ...it, qty: Math.max(0, q) } : it),
    }));
  };

  const uploadBg = async (file: File) => {
    if (!campaignId) return;
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    try {
      const { data: ex } = await supabase.storage.from('campaign-images').list(campaignId, { search: dollSlot });
      const rm = (ex || []).filter((f: any) => f.name.startsWith(dollSlot + '.')).map((f: any) => `${campaignId}/${f.name}`);
      if (rm.length) await supabase.storage.from('campaign-images').remove(rm);
      const vName = `${dollSlot}.${Date.now().toString(36)}.${ext}`;
      await supabase.storage.from('campaign-images').upload(`${campaignId}/${vName}`, file, { upsert: true, cacheControl: '31536000', contentType: file.type });
      await registerStorageFile(campaignId, vName);
      window.location.reload();
    } catch (err: any) { alert('Errore: ' + (err.message || err)); }
  };

  const Cell = ({ id }: { id: SlotId }) => {
    const def = SLOT_BY_ID[id];
    const d = DIM[def.size];
    const it = shownIn(id);
    const mirrored = id === 'mano2' && !!twoHandedActive;   // impugnatura impegnata
    const round = def.shape === 'circle';
    const qty = it ? (it.qty ?? 1) : 0;
    const spent = !!it && qty <= 0;
    const counted = !!it && !mirrored && (it.type === 'consumabile' || qty > 1 || qty <= 0);
    const dim = spent || mirrored;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div
          onClick={() => { if (it) setDetail(mirrored ? 'mano1' : id); else setPicking(id); }}
          title={it ? (mirrored ? `${it.name} — impugnata a due mani` : (counted ? `${it.name} ×${qty}` : it.name)) : def.label}
          style={{
            width: d.w, height: d.h, borderRadius: round ? '50%' : 8, position: 'relative', cursor: 'pointer',
            border: it ? `2px ${mirrored ? 'dashed' : 'solid'} ${spent ? 'var(--border)' : accent}` : '1px dashed var(--border)',
            background: it ? 'var(--bg-input)' : 'rgba(11,8,20,.55)',
            boxShadow: it && !dim ? `0 0 10px ${accent}33` : 'none',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}>
          {it ? (
            <>
              <div style={{ position: 'absolute', inset: 0, opacity: spent ? .28 : (mirrored ? .45 : 1), filter: spent ? 'grayscale(1) brightness(.55)' : 'none', transition: 'all .2s' }}>
                <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width="100%" height="100%"
                  dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
              </div>
              {it.attunement && !mirrored && (
                <span title={it.attuned ? 'Sintonizzato' : 'Richiede sintonia — non ancora sintonizzato'}
                  style={{ position: 'absolute', top: 1, left: 3, fontSize: 10, fontWeight: 700,
                    color: it.attuned ? 'var(--blue)' : 'var(--gray-purple)',
                    textShadow: it.attuned ? '0 0 6px var(--blue), 0 1px 3px #000' : '0 1px 3px #000',
                    opacity: it.attuned ? 1 : .8 }}>◈</span>
              )}
              {mirrored && (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: accent, textShadow: '0 1px 4px #000' }}>⇄</span>
              )}
              {counted && (
                <span style={{
                  position: 'absolute', bottom: 1, right: 3, fontSize: 9, fontWeight: 700,
                  color: spent ? 'var(--red)' : '#fff', textShadow: '0 1px 3px #000, 0 0 4px #000',
                }}>×{qty}</span>
              )}
            </>
          ) : (
            <span style={{ fontSize: def.size === 'sm' ? 15 : 20, color: 'var(--gray-purple-deep)' }}>+</span>
          )}
        </div>

        {counted && it && (
          <div className="row" style={{ gap: 3, alignItems: 'center' }}>
            <button onClick={e => { e.stopPropagation(); setQty(it.id, qty - 1); }} disabled={qty <= 0}
              style={{ width: 16, height: 16, lineHeight: 1, fontSize: 11, padding: 0, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg-deep)', color: qty <= 0 ? 'var(--gray-purple-deep)' : 'var(--text)', cursor: qty <= 0 ? 'default' : 'pointer' }}>−</button>
            <button onClick={e => { e.stopPropagation(); setQty(it.id, qty + 1); }}
              style={{ width: 16, height: 16, lineHeight: 1, fontSize: 11, padding: 0, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg-deep)', color: 'var(--text)', cursor: 'pointer' }}>+</button>
          </div>
        )}

        <span style={{ fontSize: 8, letterSpacing: .3, color: it ? (dim ? 'var(--gray-purple-deep)' : accent) : 'var(--gray-purple-deep)', maxWidth: d.w + 16, textAlign: 'center', lineHeight: 1.2 }}>
          {mirrored ? 'a due mani' : (it ? it.name : def.label)}
        </span>
      </div>
    );
  };

  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' };
  const band: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' };

  const pickable = inv.filter(it => s?.dmMode || it.revealed !== false);
  const candidates = picking ? pickable.filter(it => it.slot !== picking && (showAll || slotAccepts(picking, it))) : [];
  const detailItem = detail ? bySlot(detail) : null;

  return (
    <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <ImageSlot slotId={dollSlot} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="" />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(11,8,20,.35) 0%, rgba(11,8,20,.45) 35%, rgba(11,8,20,.75) 65%, rgba(11,8,20,.93) 88%, rgba(11,8,20,.97) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, padding: '14px 10px' }}>
        {s?.dmMode && (
          <label className="btn btn-ghost" style={{ position: 'absolute', top: 6, right: 6, padding: '2px 6px', fontSize: 9, cursor: 'pointer', background: 'rgba(11,8,20,.6)' }} title="Sfondo di questo personaggio">
            📷
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadBg(f); e.target.value = ''; }} />
          </label>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ ...col, paddingTop: SIDE_OFFSET }}>
            <Cell id="parabracci" />
            <Cell id="mano1" />
          </div>
          <div style={col}>
            <div style={{ display: 'flex', gap: 8 }}><Cell id="elmo" /><Cell id="mantello" /></div>
            <Cell id="armatura" />
            <Cell id="stivali" />
          </div>
          <div style={{ ...col, paddingTop: SIDE_OFFSET }}>
            <Cell id="vesti" />
            <Cell id="mano2" />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 14 }}>
          <div className="label" style={{ fontSize: 8, textAlign: 'center', marginBottom: 6 }}>Oggetti magici ed anelli</div>
          <div style={band}><Cell id="magico1" /><Cell id="magico2" /><Cell id="magico3" /></div>
          {/* Sintonie in atto: il conteggio appartiene ai monili e sta sotto di essi */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, marginTop: 10 }}>
            <span className="label" style={{ fontSize: 8 }}>◈ Sintonia</span>
            <div className="row" style={{ gap: 5, alignItems: 'center', justifyContent: 'center' }}>
              {Array.from({ length: ATTUNE_MAX }).map((_, i) => {
                const on = i < attunedCount(inv);
                return <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', border: `1px solid ${accent}`,
                  background: on ? accent : 'transparent',
                  boxShadow: on ? `0 0 6px ${accent}` : 'none', display: 'inline-block' }} />;
              })}
              <span className="small muted" style={{ fontSize: 10, marginLeft: 3 }}>{attunedCount(inv)}/{ATTUNE_MAX}</span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 12 }}>
          <div className="label" style={{ fontSize: 8, textAlign: 'center', marginBottom: 6 }}>Consumabili a portata</div>
          <div style={band}><Cell id="consum1" /><Cell id="consum2" /><Cell id="consum3" /></div>
        </div>
      </div>

      {/* Scheda dell'oggetto indossato — consultazione rapida */}
      {detail && detailItem && (
        <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="alchemy-popup" style={{ maxWidth: 420 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="small muted">{SLOT_BY_ID[detail].label}</div>
              <button className="btn btn-ghost" style={{ fontSize: 16, padding: '2px 8px' }} onClick={() => setDetail(null)}>✕</button>
            </div>

            <ItemDetailBody item={detailItem} inventory={inv} campaignId={campaignId} accent={accent}
              onAttune={() => toggleAttune(detailItem.id)} imageHeight={160} slotPrefix="dolldetail" />

            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn grow" style={{ fontSize: 11 }} onClick={() => { const sl = detail; setDetail(null); setPicking(sl); }}>Cambia oggetto</button>
              <button className="btn btn-danger btn-ghost" style={{ fontSize: 11 }} onClick={() => { clear(detail); setDetail(null); }}>Sfila</button>
            </div>
          </div>
        </div>
      )}

      {/* Selettore */}
      {picking && (
        <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) { setPicking(null); setShowAll(false); } }}>
          <div className="alchemy-popup" style={{ maxWidth: 420 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="h2" style={{ fontSize: 15, color: accent }}>{SLOT_BY_ID[picking].label}</div>
              <button className="btn btn-ghost" style={{ fontSize: 16, padding: '2px 8px' }} onClick={() => { setPicking(null); setShowAll(false); }}>✕</button>
            </div>

            {bySlot(picking) && (
              <button className="btn btn-danger btn-ghost" style={{ width: '100%', marginBottom: 8, fontSize: 11 }}
                onClick={() => { clear(picking); setPicking(null); setShowAll(false); }}>Sfila {bySlot(picking).name}</button>
            )}

            {candidates.length === 0 && (
              <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Nessun oggetto idoneo in inventario.</div>
            )}

            {candidates.map(it => (
              <div key={it.id} className="card" style={{ padding: '8px 10px', cursor: 'pointer' }} onClick={() => place(picking, it.id)}>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                    <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width={36} height={36} dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
                  </div>
                  <div className="grow">
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{it.name} <span className="small muted">×{it.qty ?? 1}</span></div>
                    <div className="small muted" style={{ fontSize: 10 }}>
                      {it.type}{it.subtype ? ' · ' + it.subtype : ''}
                      {isTwoHanded(it) ? ' · impegna entrambe le mani' : ''}
                      {it.slot ? ' · ora in ' + (SLOT_BY_ID[it.slot]?.label || it.slot) : ''}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 10 }} onClick={() => setShowAll(v => !v)}>
              {showAll ? 'Mostra solo gli oggetti idonei' : 'Mostra tutti gli oggetti (forza)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
