'use client';
import { RevealFragment, uid } from '@/lib/types';
import { Markdown } from '@/components/shared/textUtils';
import { moveInArray, ReorderBtns } from '@/components/shared/common';
import { sfxReveal } from '@/lib/dnd/sounds';

// ─── FRAMMENTI RIVELABILI ────────────────────────────────────
// Consentono di redigere in anticipo il contenuto di un personaggio o di
// una voce di lore e di scoprirlo un pezzo alla volta durante la sessione.
// Al giocatore compaiono solo i frammenti accesi; al DM tutti, con quelli
// ancora spenti attenuati, così sa sempre che cosa resta da svelare.

export function revealedCount(list?: RevealFragment[]): { shown: number; total: number } {
  const l = list || [];
  return { shown: l.filter(f => f.revealed).length, total: l.length };
}

/** Accende il primo frammento ancora spento; restituisce null se non ce ne sono. */
export function revealNext(list?: RevealFragment[]): RevealFragment[] | null {
  const l = list || [];
  const i = l.findIndex(f => !f.revealed);
  if (i < 0) return null;
  return l.map((f, j) => j === i ? { ...f, revealed: true } : f);
}

/** Pastiglia compatta col conteggio: un tocco svela il frammento successivo. */
export function RevealBadge({ list, onChange, accent = 'var(--gold)' }: {
  list?: RevealFragment[]; onChange: (next: RevealFragment[]) => void; accent?: string;
}) {
  const { shown, total } = revealedCount(list);
  if (total === 0) return null;
  const done = shown >= total;
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        const next = revealNext(list);
        if (next) { sfxReveal(); onChange(next); }
      }}
      title={done ? 'Tutti i frammenti sono stati svelati' : 'Svela il frammento successivo'}
      className="pill"
      style={{
        cursor: done ? 'default' : 'pointer', padding: '2px 8px', fontSize: 9, flexShrink: 0,
        color: done ? 'var(--gray-purple-deep)' : accent,
        borderColor: done ? 'var(--border)' : accent,
        background: done ? 'transparent' : 'var(--bg-active)',
      }}>
      {done ? '◉' : '◐'} {shown}/{total}
    </button>
  );
}

/** Frammenti visibili in lettura. Il DM vede anche gli spenti, attenuati. */
export function RevealsView({ list, dmMode, accent = 'var(--gold)' }: {
  list?: RevealFragment[]; dmMode: boolean; accent?: string;
}) {
  const l = list || [];
  const visible = dmMode ? l : l.filter(f => f.revealed);
  if (visible.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      {visible.map(f => (
        <div key={f.id} style={{
          borderLeft: `2px solid ${f.revealed ? accent : 'var(--border)'}`,
          paddingLeft: 8, marginBottom: 8, opacity: f.revealed ? 1 : .45,
        }}>
          {f.title && (
            <div className="label" style={{ fontSize: 8, marginBottom: 2, color: f.revealed ? accent : 'var(--gray-purple-deep)' }}>
              {f.title}{!f.revealed && dmMode ? ' · non svelato' : ''}
            </div>
          )}
          {!f.title && !f.revealed && dmMode && (
            <div className="label" style={{ fontSize: 8, marginBottom: 2, color: 'var(--gray-purple-deep)' }}>non svelato</div>
          )}
          <div style={{ fontSize: 12, lineHeight: 1.6 }}><Markdown text={f.text} /></div>
        </div>
      ))}
    </div>
  );
}

/** Pannello di redazione: scrittura, ordinamento e accensione dei frammenti. */
export function RevealsEditor({ list, onChange, accent = 'var(--gold)' }: {
  list?: RevealFragment[]; onChange: (next: RevealFragment[]) => void; accent?: string;
}) {
  const l = list || [];
  const patch = (id: string, p: Partial<RevealFragment>) => onChange(l.map(f => f.id === id ? { ...f, ...p } : f));
  const { shown, total } = revealedCount(l);

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <span className="label" style={{ fontSize: 8 }}>Frammenti da svelare</span>
        {total > 0 && <span className="small muted" style={{ fontSize: 9 }}>{shown}/{total}</span>}
        <div className="grow" />
        <RevealBadge list={l} onChange={onChange} accent={accent} />
      </div>

      {l.map((f, i) => (
        <div key={f.id} className="card" style={{ padding: '6px 8px', marginBottom: 4, opacity: f.revealed ? 1 : .7 }}>
          <div className="row" style={{ gap: 4, alignItems: 'center', marginBottom: 3 }}>
            <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 9, color: f.revealed ? accent : 'var(--gray-purple-deep)' }}
              title={f.revealed ? 'Nascondi ai giocatori' : 'Svela ai giocatori'}
              onClick={() => { if (!f.revealed) sfxReveal(); patch(f.id, { revealed: !f.revealed }); }}>
              {f.revealed ? '◉' : '◯'}
            </button>
            <input value={f.title || ''} placeholder="Titolo (facoltativo)…"
              onChange={e => patch(f.id, { title: e.target.value })}
              style={{ flex: 1, fontSize: 11, padding: '2px 6px' }} />
            <ReorderBtns
              onUp={() => onChange(moveInArray(l, i, -1))}
              onDown={() => onChange(moveInArray(l, i, 1))}
            />
            <button className="btn btn-danger btn-ghost" style={{ padding: '1px 6px', fontSize: 9 }}
              onClick={() => { if (confirm('Eliminare il frammento?')) onChange(l.filter(x => x.id !== f.id)); }}>&times;</button>
          </div>
          <textarea value={f.text} placeholder="Testo del frammento…"
            onChange={e => patch(f.id, { text: e.target.value })}
            style={{ fontSize: 11, padding: '5px 7px', minHeight: 44, width: '100%' }} />
        </div>
      ))}

      <button className="btn btn-ghost" style={{ width: '100%', fontSize: 10 }}
        onClick={() => onChange([...l, { id: uid('rv'), title: '', text: '', revealed: false }])}>
        + Aggiungi frammento
      </button>
    </div>
  );
}
