'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ImageSlot, registerStorageFile } from '@/components/ImageSlot';
import { SLOT_BY_ID, SlotId, slotAccepts } from '@/lib/dnd/equipment';

// ─── SAGOMA DELL'EQUIPAGGIAMENTO ─────────────────────────────
// Disposizione a caselle fisse, sul modello dello schema: elmo e mantello
// in cima, parabracci e vesti scalati più in basso ai lati, le due mani
// ancora sotto a fiancheggiare l'armatura, gli stivali in fondo; quindi
// la fascia dei monili magici e quella dei consumabili a portata.
// Lo sfondo è personalizzabile per singolo personaggio (slot doll-<id>),
// con velatura scura crescente verso il basso come nella Fucina.

const DIM = {
  sm: { w: 48, h: 48 },
  lg: { w: 72, h: 96 },
  xl: { w: 88, h: 116 },
};

// Scalatura verticale delle colonne laterali: parabracci e vesti partono
// sotto la linea di elmo/mantello, e le armi seguono più in basso.
const SIDE_OFFSET = 58;

export function EquipDoll({ s, p, updPlayer, campaignId, accent }: {
  s: any; p: any; updPlayer: (fn: (pl: any) => any) => void; campaignId: string | null; accent: string;
}) {
  const [picking, setPicking] = useState<SlotId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const inv: any[] = p?.inventory || [];
  const bySlot = (id: string) => inv.find(it => it.slot === id);
  const dollSlot = 'doll-' + (p?.id || 'x');

  const place = (slotId: SlotId, itemId: string) => {
    updPlayer(pl => ({
      ...pl,
      inventory: (pl.inventory || []).map((it: any) => {
        if (it.id === itemId) return { ...it, slot: slotId, equipped: true };
        if (it.slot === slotId) return { ...it, slot: undefined, equipped: false };
        return it;
      }),
    }));
    setPicking(null); setShowAll(false);
  };

  const clear = (slotId: string) => {
    updPlayer(pl => ({
      ...pl,
      inventory: (pl.inventory || []).map((it: any) => it.slot === slotId ? { ...it, slot: undefined, equipped: false } : it),
    }));
  };

  const setQty = (itemId: string, q: number) => {
    updPlayer(pl => ({
      ...pl,
      inventory: (pl.inventory || []).map((it: any) => it.id === itemId ? { ...it, qty: Math.max(0, q) } : it),
    }));
  };

  // Caricamento dello sfondo: modello collaudato (input esterno + reload)
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
    const it = bySlot(id);
    const round = def.shape === 'circle';
    const qty = it ? (it.qty ?? 1) : 0;
    const spent = it && qty <= 0;   // consumato: resta la casella, l'immagine si spegne
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div onClick={() => setPicking(id)} title={it ? `${it.name} ×${qty}` : def.label}
          style={{
            width: d.w, height: d.h, borderRadius: round ? '50%' : 8, position: 'relative', cursor: 'pointer',
            border: it ? `2px solid ${spent ? 'var(--border)' : accent}` : '1px dashed var(--border)',
            background: it ? 'var(--bg-input)' : 'rgba(11,8,20,.55)',
            boxShadow: it && !spent ? `0 0 10px ${accent}33` : 'none',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}>
          {it ? (
            <>
              <div style={{ position: 'absolute', inset: 0, opacity: spent ? .28 : 1, filter: spent ? 'grayscale(1) brightness(.55)' : 'none', transition: 'all .2s' }}>
                <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width="100%" height="100%"
                  dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
              </div>
              <span style={{
                position: 'absolute', bottom: 1, right: 3, fontSize: 9, fontWeight: 700,
                color: spent ? 'var(--red)' : '#fff', textShadow: '0 1px 3px #000, 0 0 4px #000',
              }}>×{qty}</span>
            </>
          ) : (
            <span style={{ fontSize: def.size === 'sm' ? 15 : 20, color: 'var(--gray-purple-deep)' }}>+</span>
          )}
        </div>

        {/* Quantità: riducibile senza uscire dalla sagoma */}
        {it && (
          <div className="row" style={{ gap: 3, alignItems: 'center' }}>
            <button onClick={e => { e.stopPropagation(); setQty(it.id, qty - 1); }} disabled={qty <= 0}
              style={{ width: 16, height: 16, lineHeight: 1, fontSize: 11, padding: 0, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg-deep)', color: qty <= 0 ? 'var(--gray-purple-deep)' : 'var(--text)', cursor: qty <= 0 ? 'default' : 'pointer' }}>−</button>
            <button onClick={e => { e.stopPropagation(); setQty(it.id, qty + 1); }}
              style={{ width: 16, height: 16, lineHeight: 1, fontSize: 11, padding: 0, borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg-deep)', color: 'var(--text)', cursor: 'pointer' }}>+</button>
          </div>
        )}

        <span style={{ fontSize: 8, letterSpacing: .3, color: it ? (spent ? 'var(--gray-purple-deep)' : accent) : 'var(--gray-purple-deep)', maxWidth: d.w + 16, textAlign: 'center', lineHeight: 1.2 }}>
          {it ? it.name : def.label}
        </span>
      </div>
    );
  };

  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' };
  const band: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' };

  // Solo ciò che il personaggio vede davvero nel proprio inventario
  const pickable = inv.filter(it => s?.dmMode || it.revealed !== false);
  const candidates = picking ? pickable.filter(it => it.slot !== picking && (showAll || slotAccepts(picking, it))) : [];

  return (
    <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
      {/* Sfondo personalizzato del personaggio */}
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

        {/* Corpo: colonne laterali scalate sotto la linea di elmo/mantello */}
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
          <div className="label" style={{ fontSize: 8, textAlign: 'center', marginBottom: 6 }}>Oggetti magici</div>
          <div style={band}><Cell id="magico1" /><Cell id="magico2" /><Cell id="magico3" /></div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 12 }}>
          <div className="label" style={{ fontSize: 8, textAlign: 'center', marginBottom: 6 }}>Consumabili a portata</div>
          <div style={band}><Cell id="consum1" /><Cell id="consum2" /><Cell id="consum3" /></div>
        </div>
      </div>

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
                      {it.type}{it.subtype ? ' · ' + it.subtype : ''}{it.slot ? ' · ora in ' + (SLOT_BY_ID[it.slot]?.label || it.slot) : ''}
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
