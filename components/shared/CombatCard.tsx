'use client';
import { useState, useRef, useEffect } from 'react';
import { ImageSlot } from '@/components/ImageSlot';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { rollDice } from '@/components/shared/DiceOverlay';

// ─── CARTA DEL COMBATTENTE ───────────────────────────────────
// Sostituisce la riga a discesa: il ritratto occupa il grosso della carta,
// e i dati si dispongono attorno a esso invece che in colonne di testo.
// Le carte scorrono lateralmente, così la larghezza dello schermo lavora.
//
// Sulla carta sta solo ciò che serve a giocare il round — iniziativa, punti
// ferita, effetti attivi, companion, tiri contro morte. Tutto il resto, che
// è quasi interamente lavoro da DM, vive nel pannello di dettaglio: nome,
// massimale, assegnazione delle condizioni, fazione, rimozione.

/**
 * Cornice incisa delle piastre di cura e ferita. Stessa grammatica
 * dell'orbe d'iniziativa — doppio filetto, quello interno tratteggiato, e
 * quattro punte — ma su pianta quadra invece che circolare: le punte
 * diventano borchie agli angoli.
 */
function HpOrbRing() {
  return (
    <svg className="hp-orb-ring" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="7" y="7" width="86" height="86" rx="9" className="hp-orb-outer" />
      <rect x="17" y="17" width="66" height="66" rx="5" className="hp-orb-inner" />
      {[[7, 7], [93, 7], [93, 93], [7, 93]].map(([x, y], i) => (
        <rect key={i} x={x - 5} y={y - 5} width="10" height="10" rx="1.5"
          transform={`rotate(45 ${x} ${y})`} className="hp-orb-stud" />
      ))}
    </svg>
  );
}

/** Slot dell'immagine, secondo la natura del combattente. */
export function slotOf(k: any): string {
  if (k.imgSlot) return k.imgSlot;
  if (k.id.startsWith('pc-')) return 'portrait-' + k.id.slice(3);
  if (k.id.startsWith('comp-')) return 'companion-' + k.id.slice(5);
  return 'combat-' + k.id;
}

/** Gradino qualitativo dei PF: ciò che i giocatori possono vedere di un nemico. */
export function woundStep(pct: number): { i: number; label: string; color: string } {
  if (pct <= 0) return { i: 0, label: 'Abbattuto', color: 'var(--red)' };
  if (pct <= 25) return { i: 1, label: 'In fin di vita', color: 'var(--red)' };
  if (pct <= 50) return { i: 2, label: 'Malconcio', color: '#d8944c' };
  if (pct <= 75) return { i: 3, label: 'Ferito', color: 'var(--gold)' };
  return { i: 4, label: 'Illeso', color: 'var(--green)' };
}

export function CombatCard({
  s, k, isCurrent, campaignId, liveHp, changeHp, onOpen, onEnlarge, update,
}: {
  s: any; k: any; isCurrent: boolean; campaignId: string | null;
  liveHp: (c: any) => { hp: number; maxHp: number };
  changeHp: (id: string, d: number) => void;
  onOpen: () => void;
  onEnlarge: (src: string) => void;
  update: any;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [openComp, setOpenComp] = useState(false);
  const dm = !!s.dmMode;

  // La carta di turno si porta in vista da sola: con dieci combattenti in
  // fila, cercarla a ogni avanzamento sarebbe il vero costo dello scorrimento.
  useEffect(() => {
    if (isCurrent) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [isCurrent]);

  const { hp, maxHp } = liveHp(k);
  const pct = Math.round(((hp || 0) / (maxHp || 1)) * 100);
  const isPc = k.id.startsWith('pc-');
  const enemy = k.side === 'enemy';
  const hidden = k.revealed === false;
  const seesNumbers = !enemy || dm;          // i numeri dei nemici restano al DM
  const step = woundStep(pct);

  const conds = (k.conditions || []).map((cid: string) => CONDITIONS.find(c => c.id === cid)).filter(Boolean) as any[];

  const owner = isPc ? s.players.find((pl: any) => pl.id === k.id.slice(3)) : undefined;
  const comp = owner?.companion?.name ? owner.companion : null;
  const compPct = comp && comp.maxHp > 0 ? Math.round((comp.hp / comp.maxHp) * 100) : 0;
  const setComp = (d: number) => update((prev: any) => ({
    players: prev.players.map((p: any) => p.id === owner.id
      ? { ...p, companion: { ...p.companion, hp: Math.max(0, Math.min(p.companion.maxHp ?? 0, (p.companion.hp ?? 0) + d)) } }
      : p),
  }));

  /** Tiro d'iniziativa per questo solo combattente. */
  const canRoll = dm || isPc;
  const rollInit = () => {
    let mod = k.initMod ?? 0;
    if (owner) {
      const dex = Math.floor((((owner as any).abilities?.dex ?? 10) - 10) / 2);
      const ov = (owner as any).initOverride;
      mod = (ov !== undefined && ov !== null && ov !== '') ? Number(ov) : dex + ((owner as any).initBonus || 0);
    }
    const r = rollDice(20, 'Iniziativa · ' + k.name) + mod;
    update((prev: any) => ({ combatants: prev.combatants.map((c: any) => c.id === k.id ? { ...c, init: r } : c) }));
  };

  const cls = [
    'combat-card',
    enemy && hp === 0 ? 'enemy-dead' : '',
    enemy && hp > 0 && hp <= Math.max(1, Math.ceil(maxHp * 0.05)) ? 'enemy-critical' : '',
    isCurrent ? 'turn-indicator' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} style={{ opacity: hidden ? .5 : 1, borderStyle: hidden ? 'dashed' : undefined }}>
      {/* Nome sopra la carta, come nello schema di progetto */}
      <div className="combat-name" title={k.name}>{k.name}</div>

      {/* La figura non ritaglia: è dentro di essa che l'orbe dell'iniziativa
          e il tondo del companion sbordano. Il ritaglio vive nel ritratto. */}
      <div className="combat-figure">
      <div className="combat-portrait" onClick={onOpen} title="Apri la scheda del combattente">
        <div data-slot={slotOf(k)} style={{ position: 'absolute', inset: 0 }}>
          <ImageSlot slotId={slotOf(k)} campaignId={campaignId} shape="rect" width="100%" height="100%"
            dmMode={false} placeholder={k.name.slice(0, 2).toUpperCase()} alt={k.name} />
        </div>

        {/* Velatura degli effetti attivi: una fascia per condizione, così tre
            effetti insieme restano tutti e tre leggibili. */}
        {conds.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
            {conds.map((c, i) => (
              <div key={c.id} style={{ flex: 1, background: `linear-gradient(180deg, transparent 38%, ${c.color}00 45%, ${c.color}bb 100%)` }} />
            ))}
          </div>
        )}

        {/* Effetti attivi, in alto a destra */}
        {conds.length > 0 && (
          <div style={{ position: 'absolute', top: 3, right: 3, left: 26, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-end', pointerEvents: 'none' }}>
            {conds.slice(0, 4).map(c => (
              <span key={c.id} title={c.label} style={{
                fontSize: 7, letterSpacing: .3, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
                background: 'rgba(11,8,20,.72)', color: c.color, border: `1px solid ${c.color}`,
              }}>{c.label.slice(0, 4).toUpperCase()}</span>
            ))}
            {conds.length > 4 && <span style={{ fontSize: 7, color: '#fff', background: 'rgba(11,8,20,.72)', padding: '1px 4px', borderRadius: 3 }}>+{conds.length - 4}</span>}
          </div>
        )}

        {/* Salute, alla stessa altezza del cerchio d'iniziativa */}
        <div style={{ position: 'absolute', left: 46, right: 5, bottom: 6, pointerEvents: 'none' }}>
          {seesNumbers ? (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: '#fff', textShadow: '0 1px 4px #000, 0 0 6px #000', textAlign: 'right', lineHeight: 1.1 }}>
                {hp}/{maxHp} <span style={{ opacity: .7, fontSize: 9 }}>PF</span>
              </div>
              <div className="hp-bar" style={{ marginTop: 3, height: 8 }}>
                <div className="hp-fill" style={{ width: pct + '%', background: `hsl(${Math.round(pct * 1.2)},65%,55%)` }} />
              </div>
            </>
          ) : (
            <>
              {/* Barra qualitativa: quanto un occhio esperto vedrebbe guardando
                  l'avversario, senza svelare le cifre. */}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: step.color, textShadow: '0 1px 4px #000, 0 0 6px #000', textAlign: 'right', lineHeight: 1.1 }}>{step.label}</div>
              <div className="row" style={{ gap: 3, marginTop: 3 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 9, borderRadius: 2, border: '1px solid var(--border)',
                    background: i <= step.i ? step.color : 'var(--bg-deep)',
                    boxShadow: i <= step.i ? `0 0 5px ${step.color}66` : 'none',
                  }} />
                ))}
              </div>
            </>
          )}
        </div>

      </div>

        {/* Companion: tondo sopra l'orbe, anch'esso sbordante */}
        {comp && (() => {
          // La salute del companion corre lungo la circonferenza del ritratto:
          // un anello che si consuma è più immediato di una barra nascosta
          // dietro un tocco, e non ruba spazio alla carta.
          const R = 21, C = 2 * Math.PI * R;
          const ringCol = compPct <= 0 ? 'var(--red)' : `hsl(${Math.round(compPct * 1.2)},65%,55%)`;
          return (
            <div className="comp-orb" onClick={e => { e.stopPropagation(); setOpenComp(v => !v); }}
              title={`${comp.name} · ${comp.hp}/${comp.maxHp} PF — tocca per curare o ferire`}>
              <div className="comp-orb-img">
                <ImageSlot slotId={'companion-' + owner.id} campaignId={campaignId} shape="circle" width="100%" height="100%"
                  dmMode={false} placeholder="🐾" alt={comp.name} />
              </div>
              <svg className="comp-ring" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r={R} className="comp-ring-track" />
                <circle cx="24" cy="24" r={R} className="comp-ring-fill"
                  stroke={ringCol} strokeDasharray={`${(C * Math.max(0, compPct)) / 100} ${C}`} />
              </svg>
            </div>
          );
        })()}

        {/* Orbe dell'iniziativa: intero, sbordante, con la corona incisa */}
        <div className={'init-orb' + (canRoll ? ' rollable' : '')}
          title={'Iniziativa' + (canRoll ? ' — tocca per tirare d20 + modificatore' : '')}
          onClick={e => { if (!canRoll) return; e.stopPropagation(); rollInit(); }}>
          <svg className="init-orb-ring" viewBox="0 0 100 100" aria-hidden="true">
            {/* corona a otto punte: un rosone inciso, non una decorazione floreale
                che a questa scala diventerebbe una macchia illeggibile */}
            {Array.from({ length: 8 }).map((_, i) => (
              <path key={i} d="M50 0.5 L55.5 14 L50 10.5 L44.5 14 Z" transform={`rotate(${i * 45} 50 50)`} />
            ))}
            <circle cx="50" cy="50" r="41" className="init-orb-outer" />
            <circle cx="50" cy="50" r="35" className="init-orb-inner" />
          </svg>
          <span className="init-orb-value">
            {k.init ? k.init : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l8.5 5v10L12 22 3.5 17V7L12 2z" /><circle cx="12" cy="12" r="1.7" fill="currentColor" />
              </svg>
            )}
          </span>
        </div>
      </div>

      {/* ── Salute del companion, aperta dal tondo ── */}
      {comp && openComp && (
        <div className="card" style={{ padding: '5px 6px', margin: '24px 0 0' }}>
          <div style={{ fontSize: 9, color: 'var(--green)', fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>{comp.name}</div>
          <div className="row" style={{ gap: 3, marginTop: 2 }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-display)' }}>{comp.hp}/{comp.maxHp}</span>
            <div className="hp-bar" style={{ height: 4 }}><div className="hp-fill" style={{ width: compPct + '%', background: `hsl(${Math.round(compPct * 1.2)},65%,55%)` }} /></div>
          </div>
          <div className="row" style={{ gap: 3, marginTop: 3 }}>
            <button className="hp-btn hp-btn-neg" style={{ padding: '2px 0', fontSize: 10 }} onClick={() => setComp(-1)}>−</button>
            <button className="hp-btn hp-btn-pos" style={{ padding: '2px 0', fontSize: 10 }} onClick={() => setComp(1)}>+</button>
          </div>
        </div>
      )}

      {/* ── Meno e più, a destra del cerchio ── */}
      {(!enemy || dm) && (
        <div className="hp-pad" style={{ marginTop: comp && openComp ? 6 : 24 }}>
          {/* Stessa grammatica dell'orbe d'iniziativa — doppio filetto inciso,
              quello interno tratteggiato — ma su pianta quadra: parenti,
              non gemelli. */}
          <button className="hp-orb hp-orb-neg" title="Un punto ferita in meno" onClick={() => changeHp(k.id, -1)}>
            <HpOrbRing /><span className="hp-orb-glyph">−</span>
          </button>
          <button className="hp-orb hp-orb-pos" title="Un punto ferita in più" onClick={() => changeHp(k.id, 1)}>
            <HpOrbRing /><span className="hp-orb-glyph">+</span>
          </button>
        </div>
      )}
      {enemy && !dm && <div style={{ height: 24 }} />}

      {/* ── Tiri salvezza contro morte ── */}
      {isPc && hp === 0 && (() => {
        const ds = k.ds || { s: 0, f: 0 };
        const setDs = (ns: number, nf: number) => update((prev: any) => ({
          combatants: prev.combatants.map((c: any) => c.id === k.id ? { ...c, ds: { s: ns, f: nf } } : c),
        }));
        const dead = ds.f >= 3, stable = ds.s >= 3;
        return (
          <div style={{ marginTop: 5, padding: '4px 5px', borderRadius: 5, background: 'var(--bg-deep)', border: '1px solid ' + (dead ? 'var(--red)' : stable ? 'var(--green)' : 'var(--border)') }}>
            {dead ? <div style={{ color: 'var(--red)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: 1, textAlign: 'center' }}>MORTO</div>
              : stable ? <div style={{ color: 'var(--green)', fontSize: 9, fontWeight: 600, textAlign: 'center' }}>Stabilizzato</div>
                : null}
            <div className="row" style={{ gap: 3, justifyContent: 'center', marginTop: dead || stable ? 3 : 0 }}>
              <span style={{ fontSize: 9, color: 'var(--green)' }}>✓</span>
              {[0, 1, 2].map(i => (
                <button key={i} onClick={() => setDs(ds.s === i + 1 ? i : i + 1, ds.f)}
                  style={{ width: 11, height: 11, borderRadius: '50%', cursor: 'pointer', padding: 0, border: '1px solid ' + (i < ds.s ? 'var(--green)' : 'var(--border)'), background: i < ds.s ? 'var(--green)' : 'transparent' }} />
              ))}
            </div>
            <div className="row" style={{ gap: 3, justifyContent: 'center', marginTop: 2 }}>
              <span style={{ fontSize: 9, color: 'var(--red)' }}>✗</span>
              {[0, 1, 2].map(i => (
                <button key={i} onClick={() => setDs(ds.s, ds.f === i + 1 ? i : i + 1)}
                  style={{ width: 11, height: 11, borderRadius: '50%', cursor: 'pointer', padding: 0, border: '1px solid ' + (i < ds.f ? 'var(--red)' : 'var(--border)'), background: i < ds.f ? 'var(--red)' : 'transparent' }} />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
