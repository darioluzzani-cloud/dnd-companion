'use client';
import { useEffect, useState } from 'react';
import { sfxDice } from '@/lib/dnd/sounds';

// ─── DADO IN OVERLAY ─────────────────────────────────────────
// Animazione 2.5D: un poliedro stilizzato ruota su più assi e rallenta
// fino a fermarsi, poi scopre il valore. Pilotato da un evento globale
// 'velmora-roll' così qualunque punto dell'app può invocarlo senza prop:
//   rollDice(20) → mostra l'animazione e restituisce il valore tirato.
// La logica di gioco (iniziativa, dadi vita) continua a usare il valore
// restituito; l'overlay è puramente scenografico.

export type RollDetail = { die: number; value: number; label?: string };

export function rollDice(die: number, label?: string): number {
  const value = Math.floor(Math.random() * die) + 1;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<RollDetail>('velmora-roll', { detail: { die, value, label } }));
  }
  return value;
}

// Facce e forma del solido per ciascun tipo di dado (clip-path stilizzato)
const SHAPES: Record<number, string> = {
  4:  'polygon(50% 0%, 100% 100%, 0% 100%)',                                   // triangolo (d4)
  6:  'polygon(0 0, 100% 0, 100% 100%, 0 100%)',                               // quadrato (d6)
  8:  'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',                             // rombo (d8)
  10: 'polygon(50% 0, 90% 35%, 72% 100%, 28% 100%, 10% 35%)',                  // pentagono (d10)
  12: 'polygon(50% 0, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0 60%, 10% 20%)', // ~dodeca (d12)
  20: 'polygon(50% 0, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',            // esagono (d20)
  100:'polygon(50% 0, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
};

export function DiceOverlay() {
  const [roll, setRoll] = useState<RollDetail | null>(null);
  const [phase, setPhase] = useState<'spin' | 'settle' | 'done'>('spin');

  useEffect(() => {
    const onRoll = (e: Event) => {
      const detail = (e as CustomEvent<RollDetail>).detail;
      setRoll(detail); setPhase('spin'); sfxDice();
      // spin → settle → done → dismiss
      const t1 = setTimeout(() => setPhase('settle'), 700);
      const t2 = setTimeout(() => setPhase('done'), 1050);
      const t3 = setTimeout(() => setRoll(null), 2100);
      (onRoll as any)._timers = [t1, t2, t3];
    };
    window.addEventListener('velmora-roll', onRoll);
    return () => window.removeEventListener('velmora-roll', onRoll);
  }, []);

  if (!roll) return null;
  const shape = SHAPES[roll.die] || SHAPES[20];
  const crit = roll.die === 20 && roll.value === 20;
  const fail = roll.die === 20 && roll.value === 1;
  const accent = crit ? 'var(--green)' : fail ? 'var(--red)' : 'var(--gold)';

  return (
    <div onClick={() => setRoll(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(6,4,12,.72)', backdropFilter: 'blur(2px)', cursor: 'pointer', animation: 'dice-fade .18s ease' }}>
      <div style={{ perspective: 640 }}>
        <div style={{
          width: 132, height: 132, position: 'relative',
          transformStyle: 'preserve-3d',
          animation: phase === 'spin' ? 'dice-spin .7s cubic-bezier(.35,.1,.4,1) forwards'
            : phase === 'settle' ? 'dice-settle .35s cubic-bezier(.2,.8,.3,1.4) forwards'
            : 'dice-idle 2s ease-in-out infinite',
        }}>
          <div style={{
            position: 'absolute', inset: 0, clipPath: shape,
            background: `linear-gradient(150deg, ${accent} 0%, rgba(216,180,92,.35) 45%, var(--bg-deep) 100%)`,
            border: `2px solid ${accent}`,
            boxShadow: phase === 'done' ? `0 0 30px ${accent}, inset 0 0 20px rgba(0,0,0,.4)` : 'inset 0 0 20px rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: phase === 'done' ? 52 : 34, color: '#fff',
              textShadow: '0 2px 8px rgba(0,0,0,.9)', transition: 'font-size .2s',
              opacity: phase === 'spin' ? .5 : 1,
            }}>{roll.value}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 22, textAlign: 'center', opacity: phase === 'done' ? 1 : 0, transition: 'opacity .25s' }}>
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: 2, fontSize: 13, color: accent }}>
          {roll.label ? roll.label + ' · ' : ''}d{roll.die}
        </div>
        {crit && <div style={{ color: 'var(--green)', fontSize: 12, marginTop: 2 }}>Critico!</div>}
        {fail && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 2 }}>Fallimento critico</div>}
      </div>
    </div>
  );
}
