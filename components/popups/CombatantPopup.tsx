'use client';
import { ImageSlot } from '@/components/ImageSlot';
import { NumberInput } from '@/components/shared/textUtils';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { slotOf, woundStep } from '@/components/shared/CombatCard';

// ─── PANNELLO DEL COMBATTENTE ────────────────────────────────
// Ciò che non entra nella carta e che quasi sempre è lavoro da DM: nome,
// massimale dei punti ferita, assegnazione delle condizioni, fazione,
// visibilità, rimozione. Al giocatore resta la lettura, più i comandi che
// gli competono sui propri punti ferita.

export function CombatantPopup({ s, k, campaignId, liveHp, changeHp, update, onClose, onEnlarge }: {
  s: any; k: any; campaignId: string | null;
  liveHp: (c: any) => { hp: number; maxHp: number };
  changeHp: (id: string, d: number) => void;
  update: any; onClose: () => void;
  onEnlarge: (src: string) => void;
}) {
  const dm = !!s.dmMode;
  const { hp, maxHp } = liveHp(k);
  const pct = Math.round(((hp || 0) / (maxHp || 1)) * 100);
  const enemy = k.side === 'enemy';
  const seesNumbers = !enemy || dm;
  const step = woundStep(pct);

  const patch = (p: any) => update((prev: any) => ({ combatants: prev.combatants.map((c: any) => c.id === k.id ? { ...c, ...p } : c) }));

  const setMax = (v: number) => update((prev: any) => {
    const pcId = k.id.startsWith('pc-') ? k.id.slice(3) : null;
    const compId = k.id.startsWith('comp-') ? k.id.slice(5) : null;
    const players = pcId
      ? prev.players.map((pl: any) => pl.id === pcId ? { ...pl, maxHp: v, hp: Math.min(pl.hp ?? v, v) } : pl)
      : compId
        ? prev.players.map((pl: any) => pl.id === compId && pl.companion ? { ...pl, companion: { ...pl.companion, maxHp: v, hp: Math.min(pl.companion.hp ?? v, v) } } : pl)
        : prev.players;
    return { players, combatants: prev.combatants.map((c: any) => c.id === k.id ? { ...c, maxHp: v, hp: Math.min(c.hp, v) } : c) };
  });

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ borderColor: enemy ? 'var(--pink-border)' : 'var(--green)' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="h2" style={{ fontSize: 16, color: enemy ? 'var(--red)' : 'var(--green)' }}>{k.name}</div>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
        </div>

        <div className="row" style={{ gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
          <div data-slot={slotOf(k)} style={{ width: 92, height: 122, flexShrink: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
            onClick={() => { const img = document.querySelector(`[data-slot="${slotOf(k)}"] img`) as HTMLImageElement; if (img?.src) onEnlarge(img.src); }}>
            <ImageSlot slotId={slotOf(k)} campaignId={campaignId} shape="rect" width="100%" height="100%"
              dmMode={dm} placeholder={k.name.slice(0, 2).toUpperCase()} alt={k.name} />
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            {dm ? (
              <input value={k.name} onChange={e => patch({ name: e.target.value })}
                style={{ width: '100%', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, padding: '4px 8px', marginBottom: 6 }} />
            ) : null}

            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <span className="label" style={{ fontSize: 8 }}>Iniziativa</span>
              {dm
                ? <NumberInput value={k.init || 0} onChange={n => patch({ init: n })} style={{ width: 52, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 14, padding: '2px 4px' }} />
                : <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--gold)' }}>{k.init || 0}</span>}
              {dm && !k.id.startsWith('pc-') && (
                <>
                  <span className="label" style={{ fontSize: 8 }}>mod.</span>
                  <NumberInput value={k.initMod ?? 0} onChange={n => patch({ initMod: n })} style={{ width: 44, textAlign: 'center', fontSize: 12, padding: '2px 4px' }} />
                </>
              )}
            </div>

            {seesNumbers ? (
              <>
                <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14 }}>{hp}</span>
                  <span className="muted">/</span>
                  {dm
                    ? <NumberInput value={maxHp || 0} onChange={setMax} style={{ width: 52, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 13, padding: '2px 4px' }} />
                    : <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--gray-purple)' }}>{maxHp}</span>}
                  <span className="small muted" style={{ fontSize: 9 }}>PF</span>
                </div>
                <div className="hp-bar" style={{ marginTop: 5 }}>
                  <div className="hp-fill" style={{ width: pct + '%', background: `hsl(${Math.round(pct * 1.2)},65%,55%)` }} />
                </div>
              </>
            ) : (
              <div className="small" style={{ color: step.color }}>{step.label}</div>
            )}

            {(!enemy || dm) && (
              <div className="row" style={{ gap: 4, marginTop: 8 }}>
                <button className="hp-btn hp-btn-neg" onClick={() => changeHp(k.id, -5)}>-5</button>
                <button className="hp-btn hp-btn-neg" onClick={() => changeHp(k.id, -1)}>-1</button>
                <button className="hp-btn hp-btn-pos" onClick={() => changeHp(k.id, 1)}>+1</button>
                <button className="hp-btn hp-btn-pos" onClick={() => changeHp(k.id, 5)}>+5</button>
              </div>
            )}
          </div>
        </div>

        {/* Condizioni: al giocatore le sole attive, al DM tutta la tastiera */}
        <div className="card">
          <div className="label" style={{ marginBottom: 6 }}>Effetti attivi</div>
          {!dm && (k.conditions || []).length === 0 && (
            <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5 }}>Nessun effetto in corso.</div>
          )}
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {(dm ? CONDITIONS : CONDITIONS.filter(c => (k.conditions || []).includes(c.id))).map(c => {
              const on = (k.conditions || []).includes(c.id);
              return (
                <button key={c.id} className="pill" disabled={!dm}
                  style={{ fontSize: 9, padding: '3px 8px', cursor: dm ? 'pointer' : 'default', opacity: on ? 1 : .42, color: c.color, borderColor: c.color, background: on ? 'var(--bg-active)' : 'transparent' }}
                  onClick={() => dm && patch({ conditions: on ? (k.conditions || []).filter((x: string) => x !== c.id) : [...(k.conditions || []), c.id] })}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {dm && (
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>Regia</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className="pill" style={{ fontSize: 9, padding: '3px 9px', cursor: 'pointer', color: k.side === 'ally' ? 'var(--green)' : 'var(--red)', borderColor: k.side === 'ally' ? 'var(--green)' : 'var(--pink-border)' }}
                onClick={() => patch({ side: k.side === 'ally' ? 'enemy' : 'ally' })}>{k.side === 'ally' ? 'Alleato' : 'Nemico'}</button>
              <button className="pill" style={{ fontSize: 9, padding: '3px 9px', cursor: 'pointer', color: k.revealed === false ? 'var(--gray-purple)' : 'var(--gold)', borderColor: 'var(--border)' }}
                onClick={() => patch({ revealed: k.revealed === false ? true : false })}>
                {k.revealed === false ? '◯ nascosto' : '◉ in campo'}
              </button>
              <div className="grow" />
              <button className="btn btn-danger btn-ghost" style={{ fontSize: 10, padding: '3px 9px' }}
                onClick={() => { if (confirm('Rimuovere ' + k.name + ' dalla battaglia?')) { update((prev: any) => ({ combatants: prev.combatants.filter((c: any) => c.id !== k.id) })); onClose(); } }}>Rimuovi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
