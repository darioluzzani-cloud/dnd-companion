'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { DEFAULT_CALENDAR, formatDateShort } from '@/lib/dnd/calendar';

// ─── POPUP: DIARIO DI GIOCO — le note del tavolo ─────────────
export function JournalPopup({ s, update, campaignId, onClose }: { s: CampaignState; update: U; campaignId: string | null; onClose: () => void }) {
  const [bgTick, setBgTick] = useState(0);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [author, setAuthor] = useState<string>(() => {
    const active = s.players.find(pl => pl.id === s.activePlayer);
    return active ? (active.short || active.name) : 'DM';
  });

  const journal: any[] = (s as any).journal || [];
  const setJournal = (list: any[]) => update({ journal: list } as any);
  const velDate = formatDateShort(((s as any).calendar || DEFAULT_CALENDAR).date);

  const authors = [...s.players.map(pl => pl.short || pl.name), 'DM'];

  const add = () => {
    if (!draft.trim()) return;
    setJournal([{ id: uid('jr'), author, date: velDate, ts: Date.now(), text: draft.trim() }, ...journal]);
    setDraft('');
  };

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Sfondo — immagine piena in alto che sfuma nel pannello */}
        <div key={bgTick} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ImageSlot slotId="journal-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" hideIfEmpty alt="" />
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(30,22,48,0) 0%, rgba(30,22,48,0.55) 25%, rgba(30,22,48,0.92) 50%, rgba(30,22,48,1) 70%)' }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z"/><path d="M9 7h7M9 11h7"/></svg>
              <div className="h2">Diario di gioco</div>
            </div>
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
          </div>

          {/* Nuova nota */}
          <div className="card">
            <div className="row" style={{ gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <div className="label" style={{ flexShrink: 0 }}>Scrive</div>
              <select value={author} onChange={e => setAuthor(e.target.value)} className="grow" style={{ fontSize: 13, padding: '5px 8px' }}>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <span className="small muted" style={{ flexShrink: 0 }}>{velDate}</span>
            </div>
            <textarea value={draft} placeholder="Cosa è successo, cosa non va dimenticato…" onChange={e => setDraft(e.target.value)} style={{ minHeight: 56, fontSize: 13, marginBottom: 6 }} />
            <button className="btn btn-primary" style={{ width: '100%', fontSize: 11 }} onClick={add}>Annota</button>
          </div>

          {/* Note */}
          {journal.length === 0 && <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Il diario è ancora bianco.</div>}
          {journal.map((e: any) => (
            <div key={e.id} className="card" style={{ padding: '10px 12px' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="small" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: '.5px' }}>{e.author} · {e.date}</span>
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 10 }} title="Modifica"
                    onClick={() => { setEditingId(editingId === e.id ? null : e.id); setEditText(e.text); }}>✎</button>
                  <button className="btn btn-danger btn-ghost" style={{ padding: '1px 6px', fontSize: 10 }} title="Elimina"
                    onClick={() => { if (confirm('Eliminare questa nota?')) setJournal(journal.filter((x: any) => x.id !== e.id)); }}>&times;</button>
                </div>
              </div>
              {editingId === e.id ? (
                <div>
                  <textarea value={editText} onChange={ev => setEditText(ev.target.value)} style={{ minHeight: 56, fontSize: 13, marginBottom: 6 }} />
                  <button className="btn" style={{ fontSize: 10 }} onClick={() => { setJournal(journal.map((x: any) => x.id === e.id ? { ...x, text: editText } : x)); setEditingId(null); }}>Salva</button>
                </div>
              ) : (
                <div className="small" style={{ color: 'var(--text-card)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.text}</div>
              )}
            </div>
          ))}

          {/* Sfondo — solo DM */}
          {s.dmMode && (
            <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 10 }}>
              <div className="label" style={{ fontSize: 9 }}>Sfondo</div>
              <div style={{ width: 72, height: 44 }}>
                <ImageSlot slotId="journal-bg" campaignId={campaignId} shape="rounded" width="100%" height="100%" dmMode placeholder="Sfondo" alt="" onUploaded={() => setBgTick(t => t + 1)} />
              </div>
              <span className="small muted">Unico per il diario; sfuma nel pannello.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
