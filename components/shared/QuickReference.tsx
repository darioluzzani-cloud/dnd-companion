'use client';
import { useState } from 'react';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { getSlotTotals, CasterType } from '@/lib/dnd/spell-slots';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { masteryById, canUseMastery } from '@/lib/dnd/mastery';

// ─── RIFERIMENTO RAPIDO DEL PERSONAGGIO ──────────────────────
// Ciò che serve sapere — e spendere — durante il proprio turno, senza
// lasciare la battaglia: slot e incantesimi preparati, risorse di classe,
// armi impugnate con la loro padronanza.
//
// È consultabile e operativo insieme: uno specchietto che dice «hai due
// slot di secondo» ma costringe a cambiare scheda per spenderne uno non
// risolve il problema per cui è nato. I comandi di consumo restano però al
// proprietario del personaggio e al DM: nessuno spende gli slot altrui.

export function QuickReference({ s, p, updPlayer, canAct }: {
  s: any; p: any; updPlayer: (fn: (pl: any) => any) => void; canAct: boolean;
}) {
  const [tab, setTab] = useState<'magie' | 'risorse' | 'armi'>('magie');
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
  const resources = (p.resources || []) as any[];
  const weapons = (p.inventory || []).filter((it: any) =>
    it.equipped && ['arma', 'magico', 'unico'].includes(it.type));

  const spendSlot = (lv: number, delta: number) => updPlayer((pl: any) => ({
    ...pl,
    slotsUsed: { ...(pl.slotsUsed || {}), [lv]: Math.max(0, Math.min(slots[lv] ?? 0, (pl.slotsUsed?.[lv] || 0) + delta)) },
  }));
  const spendRes = (rid: string, delta: number) => updPlayer((pl: any) => ({
    ...pl,
    resources: (pl.resources || []).map((r: any) => r.id === rid
      ? { ...r, current: Math.max(0, Math.min(r.max ?? 0, (r.current ?? 0) + delta)) } : r),
  }));

  const TABS: [typeof tab, string, number][] = [
    ['magie', 'Magie', prepared.length],
    ['risorse', 'Risorse', resources.length],
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

      {/* ── Risorse di classe ── */}
      {tab === 'risorse' && (
        resources.length === 0
          ? <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5 }}>Nessuna risorsa registrata.</div>
          : resources.map(r => (
            <div key={r.id} className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 5 }}>
              <span className="grow" style={{ fontSize: 12, minWidth: 0 }}>{r.name}</span>
              {canAct && (
                <button className="btn btn-ghost" style={{ padding: '1px 8px', fontSize: 11 }}
                  disabled={(r.current ?? 0) <= 0} onClick={() => spendRes(r.id, -1)}>−</button>
              )}
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, minWidth: 34, textAlign: 'center', color: (r.current ?? 0) > 0 ? 'var(--gold)' : 'var(--gray-purple-deep)' }}>
                {r.current ?? 0}/{r.max ?? 0}
              </span>
              {canAct && (
                <button className="btn btn-ghost" style={{ padding: '1px 8px', fontSize: 11 }}
                  disabled={(r.current ?? 0) >= (r.max ?? 0)} onClick={() => spendRes(r.id, 1)}>+</button>
              )}
            </div>
          ))
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
