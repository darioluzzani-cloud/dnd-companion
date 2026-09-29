'use client';
import { useState } from 'react';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { getSlotTotals, CasterType } from '@/lib/dnd/spell-slots';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { masteryById, canUseMastery } from '@/lib/dnd/mastery';
import { ImageSlot } from '@/components/ImageSlot';
import { isPerishable, batchesOf, consumeDose } from '@/lib/dnd/perishables';

// ─── RIFERIMENTO RAPIDO DEL PERSONAGGIO ──────────────────────
// Ciò che serve sapere — e spendere — durante il proprio turno, senza
// lasciare la battaglia: slot e incantesimi preparati, risorse di classe,
// armi impugnate con la loro padronanza.
//
// È consultabile e operativo insieme: uno specchietto che dice «hai due
// slot di secondo» ma costringe a cambiare scheda per spenderne uno non
// risolve il problema per cui è nato. I comandi di consumo restano però al
// proprietario del personaggio e al DM: nessuno spende gli slot altrui.

export function QuickReference({ s, p, updPlayer, canAct, campaignId }: {
  s: any; p: any; updPlayer: (fn: (pl: any) => any) => void; canAct: boolean;
  campaignId?: string | null;
}) {
  const [tab, setTab] = useState<'magie' | 'portata' | 'armi'>('magie');
  const [openSpell, setOpenSpell] = useState<string | null>(null);

  const info = getLevelInfo(p.xp || 0);
  const autoSlots = getSlotTotals((p.caster || 'none') as CasterType, info.level);
  const custom = (p as any).customSlots || {};
  const slots: Record<string, number> = { ...autoSlots };
  Object.entries(custom).forEach(([lv, v]: [string, any]) => { if (typeof v?.max === 'number') slots[lv] = v.max; });
  const used = p.slotsUsed || {};
  const slotLabel = (p as any).slotLabel || 'Slot';

  const spells = (p.spells || []).filter((sp: any) => sp.revealed !== false);
  const prepared = spells.filter((sp: any) => sp.prepared || sp.level === 0);
  // Consumabili a portata: gli stessi tre alloggiamenti della sagoma, non
  // un secondo elenco. Consumare di qui scala la scorta nell'inventario,
  // perché è lo stesso oggetto — non una copia.
  const HANDY = ['consum1', 'consum2', 'consum3'];
  const handy = HANDY
    .map(sl => (p.inventory || []).find((it: any) => it.slot === sl))
    .filter(Boolean) as any[];

  /** Consuma una dose: dal lotto più vecchio se il preparato è deperibile. */
  const consume = (it: any) => updPlayer((pl: any) => ({
    ...pl,
    inventory: (pl.inventory || []).map((x: any) => {
      if (x.id !== it.id) return x;
      if (isPerishable(x)) {
        const oldest = batchesOf(x)[0];
        return oldest ? consumeDose(x, oldest.madeOn, 1) : x;
      }
      return { ...x, qty: Math.max(0, (x.qty ?? 0) - 1) };
    }),
  }));
  const restore = (it: any) => updPlayer((pl: any) => ({
    ...pl,
    inventory: (pl.inventory || []).map((x: any) => x.id === it.id && !isPerishable(x)
      ? { ...x, qty: (x.qty ?? 0) + 1 } : x),
  }));
  const weapons = (p.inventory || []).filter((it: any) =>
    it.equipped && ['arma', 'magico', 'unico'].includes(it.type));

  const spendSlot = (lv: number, delta: number) => updPlayer((pl: any) => ({
    ...pl,
    slotsUsed: { ...(pl.slotsUsed || {}), [lv]: Math.max(0, Math.min(slots[lv] ?? 0, (pl.slotsUsed?.[lv] || 0) + delta)) },
  }));

  const TABS: [typeof tab, string, number][] = [
    ['magie', 'Magie', prepared.length],
    ['portata', 'A portata', handy.length],
    ['armi', 'Armi', weapons.length],
  ];

  return (
    <div className="card">
      <div className="row" style={{ gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
        {TABS.map(([k, label, n]) => (
          <button key={k} className="pill" onClick={() => setTab(k)}
            style={{
              padding: '3px 10px', fontSize: 9.5, cursor: 'pointer',
              color: tab === k ? 'var(--gold)' : 'var(--gray-purple-deep)',
              borderColor: tab === k ? 'var(--gold)' : 'var(--border)',
              background: tab === k ? 'var(--bg-active)' : 'transparent',
            }}>{label} {n > 0 ? n : ''}</button>
        ))}
      </div>

      {/* ── Magie ── */}
      {tab === 'magie' && (
        Object.keys(slots).length === 0 && prepared.length === 0 ? (
          <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5 }}>Nessun incantesimo.</div>
        ) : (
          <>
            {Object.keys(slots).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div className="label" style={{ fontSize: 8, marginBottom: 4 }}>{slotLabel}</div>
                {Object.entries(slots).sort((a, b) => +a[0] - +b[0]).map(([lv, max]) => {
                  const u = used[lv] || 0;
                  return (
                    <div key={lv} className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, width: 16, color: 'var(--blue)' }}>{lv}°</span>
                      <div className="row" style={{ gap: 3, flexWrap: 'wrap', flex: 1 }}>
                        {Array.from({ length: max as number }).map((_, i) => {
                          const spent = i < u;
                          return (
                            <button key={i} disabled={!canAct}
                              title={spent ? 'Recupera lo slot' : 'Spendi lo slot'}
                              onClick={() => spendSlot(+lv, spent ? -1 : 1)}
                              style={{
                                width: 15, height: 15, borderRadius: 3, padding: 0,
                                cursor: canAct ? 'pointer' : 'default',
                                border: '1px solid ' + (spent ? 'var(--border)' : 'var(--blue)'),
                                background: spent ? 'transparent' : 'var(--blue)',
                                opacity: spent ? .45 : 1,
                              }} />
                          );
                        })}
                      </div>
                      <span className="small muted" style={{ fontSize: 9 }}>{(max as number) - u}/{max as number}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="label" style={{ fontSize: 8, marginBottom: 4 }}>Preparati</div>
            {prepared.length === 0
              ? <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5 }}>Nessun incantesimo preparato.</div>
              : [...prepared].sort((a: any, b: any) => a.level - b.level || a.name.localeCompare(b.name)).map((sp: any) => (
                <div key={sp.id} className="card" style={{ padding: '5px 8px', marginBottom: 3 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setOpenSpell(openSpell === sp.id ? null : sp.id)}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: sp.level === 0 ? 'var(--gray-purple)' : 'var(--blue)', width: 18, flexShrink: 0 }}>
                      {sp.level === 0 ? '—' : sp.level + '°'}
                    </span>
                    <span className="grow" style={{ fontSize: 12, minWidth: 0 }}>{sp.name}</span>
                    {canAct && sp.level > 0 && (slots[sp.level] ?? 0) - (used[sp.level] || 0) > 0 && (
                      <button className="btn btn-ghost" style={{ padding: '1px 8px', fontSize: 9, color: 'var(--blue)', borderColor: 'var(--blue)' }}
                        title="Lancia: spende uno slot di questo livello"
                        onClick={e => { e.stopPropagation(); spendSlot(sp.level, 1); }}>lancia</button>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--gray-purple)' }}>{openSpell === sp.id ? '▴' : '▾'}</span>
                  </div>
                  {openSpell === sp.id && sp.desc && (
                    <div className="small" style={{ marginTop: 4, lineHeight: 1.5, color: 'var(--text-card)', whiteSpace: 'pre-wrap' }}>{sp.desc}</div>
                  )}
                </div>
              ))}
          </>
        )
      )}

      {/* ── Consumabili a portata ── */}
      {tab === 'portata' && (
        handy.length === 0
          ? <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5 }}>
              Nessun consumabile negli alloggiamenti rapidi. Si assegnano dalla sagoma, in inventario.
            </div>
          : handy.map((it: any) => {
            const qty = it.qty ?? 0;
            return (
              <div key={it.id} className="card" style={{ padding: '6px 8px', marginBottom: 4, opacity: qty > 0 ? 1 : .55 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <ImageSlot slotId={'item-' + it.id} campaignId={campaignId ?? null} shape="rect" width="100%" height="100%"
                      dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>{it.name}</div>
                    {it.effect && <div className="small" style={{ fontSize: 10, color: 'var(--gold-light)', lineHeight: 1.35 }}>{it.effect}</div>}
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: qty > 0 ? 'var(--gold)' : 'var(--gray-purple-deep)', flexShrink: 0 }}>×{qty}</span>
                  {canAct && (
                    <div className="row" style={{ gap: 3, flexShrink: 0 }}>
                      {!isPerishable(it) && (
                        <button className="btn btn-ghost" style={{ padding: '1px 7px', fontSize: 11 }}
                          title="Restituisci una dose" onClick={() => restore(it)}>+</button>
                      )}
                      <button className="btn" style={{ padding: '2px 9px', fontSize: 9.5, borderColor: 'var(--green)', color: 'var(--green)' }}
                        disabled={qty <= 0} title="Usa una dose: la scorta cala nell'inventario"
                        onClick={() => consume(it)}>usa</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
      )}

      {/* ── Armi impugnate ── */}
      {tab === 'armi' && (
        weapons.length === 0
          ? <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5 }}>Nessuna arma equipaggiata.</div>
          : weapons.map((w: any) => {
            const mast = masteryById(s, w.mastery);
            const active = canUseMastery(p, w);
            return (
              <div key={w.id} className="card" style={{ padding: '6px 9px', marginBottom: 3 }}>
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <ImageSlot slotId={'item-' + w.id} campaignId={campaignId ?? null} shape="rect" width="100%" height="100%"
                      dmMode={false} placeholder={w.name.slice(0, 2).toUpperCase()} alt={w.name} />
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                      <span className="grow" style={{ fontSize: 12, fontWeight: 500, minWidth: 0 }}>{w.name}</span>
                      {w.subtype && <span className="small muted" style={{ fontSize: 9 }}>{w.subtype}</span>}
                    </div>
                    {w.effect && <div className="small" style={{ fontSize: 10.5, color: 'var(--gold-light)', marginTop: 2 }}>✦ {w.effect}</div>}
                    {mast && (
                      <div className="small" style={{ fontSize: 10, marginTop: 3, color: active ? 'var(--ember)' : 'var(--gray-purple-deep)' }}>
                        ⚔ {mast.name}{!active && ' (non disponibile)'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}

/** Condizioni attive del combattente, in forma leggibile. */
export function activeConditionLabels(k: any): string[] {
  return (k.conditions || []).map((cid: string) => CONDITIONS.find(c => c.id === cid)?.label).filter(Boolean) as string[];
}
