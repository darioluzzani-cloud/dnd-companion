'use client';
import { useState } from 'react';
import { ImageSlot } from '@/components/ImageSlot';
import { SLOTS, SLOT_BY_ID, SlotId, slotAccepts } from '@/lib/dnd/equipment';

// ─── SAGOMA DELL'EQUIPAGGIAMENTO ─────────────────────────────
// Disposizione a caselle fisse: ciò che si indossa sul corpo in alto,
// le due mani ai lati dell'armatura, i monili magici e i consumabili in
// fascia. Toccando una casella vuota si scelgono gli oggetti idonei;
// toccandone una piena si sfila l'oggetto.

const DIM = {
  sm: { w: 48, h: 48 },
  lg: { w: 72, h: 96 },
  xl: { w: 88, h: 116 },
};

export function EquipDoll({ p, updPlayer, campaignId, accent }: {
  p: any; updPlayer: (fn: (pl: any) => any) => void; campaignId: string | null; accent: string;
}) {
  const [picking, setPicking] = useState<SlotId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const inv: any[] = p?.inventory || [];
  const bySlot = (id: string) => inv.find(it => it.slot === id);

  // Colloca: l'oggetto entra nella casella ed è equipaggiato; l'eventuale
  // occupante precedente viene sfilato (casella libera, non equipaggiato).
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

  const Cell = ({ id }: { id: SlotId }) => {
    const def = SLOT_BY_ID[id];
    const d = DIM[def.size];
    const it = bySlot(id);
    const round = def.shape === 'circle';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div onClick={() => setPicking(id)} title={it ? it.name : def.label}
          style={{
            width: d.w, height: d.h, borderRadius: round ? '50%' : 8, position: 'relative', cursor: 'pointer',
            border: it ? `2px solid ${accent}` : '1px dashed var(--border)',
            background: it ? 'var(--bg-input)' : 'var(--bg-deep)',
            boxShadow: it ? `0 0 10px ${accent}33` : 'none',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}>
          {it ? (
            <>
              <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width="100%" height="100%"
                dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
              {(it.qty || 1) > 1 && (
                <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}>×{it.qty}</span>
              )}
            </>
          ) : (
            <span style={{ fontSize: def.size === 'sm' ? 15 : 20, color: 'var(--gray-purple-deep)' }}>+</span>
          )}
        </div>
        <span style={{ fontSize: 8, letterSpacing: .3, color: it ? accent : 'var(--gray-purple-deep)', maxWidth: d.w + 14, textAlign: 'center', lineHeight: 1.2 }}>
          {it ? it.name : def.label}
        </span>
      </div>
    );
  };

  const row: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 };

  // Oggetti proponibili per la casella in scelta
  const candidates = picking
    ? inv.filter(it => it.slot !== picking && (showAll || slotAccepts(picking, it)))
    : [];

  return (
    <div className="card" style={{ padding: '14px 10px' }}>
      {/* Corpo */}
      <div style={row}>
        <Cell id="parabracci" /><Cell id="elmo" /><Cell id="mantello" /><Cell id="vesti" />
      </div>
      {/* Mani e armatura */}
      <div style={{ ...row, alignItems: 'flex-end' }}>
        <Cell id="mano1" /><Cell id="armatura" /><Cell id="mano2" />
      </div>
      {/* Stivali */}
      <div style={row}><Cell id="stivali" /></div>

      {/* Monili magici */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div className="label" style={{ fontSize: 8, textAlign: 'center', marginBottom: 6 }}>Oggetti magici</div>
        <div style={row}><Cell id="magico1" /><Cell id="magico2" /><Cell id="magico3" /></div>
      </div>

      {/* Consumabili a portata */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div className="label" style={{ fontSize: 8, textAlign: 'center', marginBottom: 6 }}>Consumabili a portata</div>
        <div style={{ ...row, marginBottom: 0 }}><Cell id="consum1" /><Cell id="consum2" /><Cell id="consum3" /></div>
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
              <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                Nessun oggetto idoneo in inventario.
              </div>
            )}

            {candidates.map(it => (
              <div key={it.id} className="card" style={{ padding: '8px 10px', cursor: 'pointer' }} onClick={() => place(picking, it.id)}>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                    <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width={36} height={36} dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
                  </div>
                  <div className="grow">
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</div>
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
