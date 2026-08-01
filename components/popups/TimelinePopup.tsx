'use client';
import { useState, useMemo, useRef } from 'react';
import { CampaignState, TimelineEvent, TimelineCat, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { Markdown, NumberInput } from '@/components/shared/textUtils';
import { RevealBadge, RevealsView, RevealsEditor } from '@/components/shared/Reveals';
import { ImageSlot } from '@/components/ImageSlot';
import { MONTHS, monthInfo, DAYS_PER_MONTH, MONTHS_PER_YEAR } from '@/lib/dnd/calendar';
import { sfxReveal } from '@/lib/dnd/sounds';

// ─── LE CRONACHE DELLA MARCA — la linea del tempo ────────────
// Una spina verticale con i fatti in ordine cronologico. La scala NON è
// proporzionale, e la scelta è deliberata: fra il Rigurgito e il presente
// corrono ottantasette anni, fra il Vespro e oggi qualche secolo, e un
// grafico in scala ridurrebbe l'intera campagna a un punto. Al posto della
// proporzione ci sono gli "stacchi": quando fra due eventi contigui passa
// più di qualche anno, la spina si interrompe con un tratteggio che dichiara
// quanto tempo è passato. Il tempo si legge, non si misura.
//
// Visibilità: come per PNG e Lore, `revealed` decide se la voce esista per i
// giocatori, e i frammenti (`reveals`) ne scoprono il contenuto un pezzo alla
// volta. L'apertura delle schede è stato locale, mai condiviso.

export const TL_CATS: { k: TimelineCat; l: string; c: string }[] = [
  { k: 'campagna',  l: 'Cronaca',   c: 'var(--gold)' },
  { k: 'storia',    l: 'Storia',    c: 'var(--purple)' },
  { k: 'sigilli',   l: 'Sigilli',   c: 'var(--blue)' },
  { k: 'personale', l: 'Personali', c: 'var(--pink)' },
  { k: 'presagio',  l: 'Presagi',   c: 'var(--red)' },
];
const catOf = (e: TimelineEvent): TimelineCat => e.cat || 'campagna';
const colorOf = (e: TimelineEvent) => (TL_CATS.find(c => c.k === catOf(e)) || TL_CATS[0]).c;

/** Ordinamento: anno, poi mese e giorno se dichiarati. Le date vaghe
 *  precedono quelle precise dello stesso anno — un fatto collocato solo
 *  nell'anno sta "all'inizio" di quell'anno, che è la lettura più onesta. */
const sortKey = (e: TimelineEvent) =>
  ((e.year * MONTHS_PER_YEAR) + ((e.month || 0) === 0 ? 0 : e.month! - 1)) * DAYS_PER_MONTH + ((e.day || 1) - 1);

function fmtEventDate(e: TimelineEvent): string {
  const pre = e.approx ? 'attorno al ' : '';
  if (e.month && e.day) return `${e.day} ${monthInfo(e.month).short} · ${e.year} d.V.`;
  if (e.month) return `${pre}${monthInfo(e.month).short} ${e.year} d.V.`;
  return `${pre}${e.year} d.V.`;
}

/**
 * Stacco fra due eventi contigui. Una soglia unica non può servire due scale:
 * fra il Vespro e Altavena si ragiona in secoli, fra due sessioni in settimane.
 * Da qui i tre gradini — mesi, anni, secoli — e il peso, che governa l'altezza
 * del tratteggio: l'occhio coglie la differenza di scala senza doverla contare.
 * Sotto i due mesi non compare nulla: fatti a pochi giorni di distanza
 * appartengono alla stessa scena, e separarli sarebbe rumore.
 */
function gapInfo(prev: TimelineEvent, next: TimelineEvent): { label: string; weight: 1 | 2 | 3 } | null {
  const days = sortKey(next) - sortKey(prev);
  const years = Math.floor(days / (DAYS_PER_MONTH * MONTHS_PER_YEAR));
  if (years >= 100) return { label: `${Math.round(years / 100) * 100} anni circa`, weight: 3 };
  if (years >= 1) return { label: years === 1 ? '1 anno' : `${years} anni`, weight: 2 };
  const months = Math.floor(days / DAYS_PER_MONTH);
  if (months >= 2) return { label: `${months} mesi`, weight: 1 };
  return null;
}

const GAP_H: Record<1 | 2 | 3, number> = { 1: 10, 2: 18, 3: 28 };

export function TimelinePopup({ s, update, campaignId, onClose }: {
  s: CampaignState; update: U; campaignId: string | null; onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<TimelineCat | null>(null);
  const [draft, setDraft] = useState('');
  const todayRef = useRef<HTMLDivElement | null>(null);

  const all: TimelineEvent[] = s.timeline || [];
  const setAll = (list: TimelineEvent[]) => update({ timeline: list } as any);
  const patch = (id: string, p: Partial<TimelineEvent>) => setAll(all.map(e => e.id === id ? { ...e, ...p } : e));

  const today = s.calendar?.date;

  const events = useMemo(() => {
    const visible = all.filter(e => (s.dmMode || e.revealed) && (!catFilter || catOf(e) === catFilter));
    return [...visible].sort((a, b) => sortKey(a) - sortKey(b));
  }, [all, s.dmMode, catFilter]);

  // Posizione del segnalino "oggi": l'indice davanti al quale inserirlo.
  const todayKey = today ? ((today.year * MONTHS_PER_YEAR) + today.month - 1) * DAYS_PER_MONTH + (today.day - 1) : null;
  const todayIdx = todayKey === null ? -1 : events.findIndex(e => sortKey(e) > todayKey);
  const todayAt = todayKey === null ? -1 : (todayIdx < 0 ? events.length : todayIdx);

  const addEvent = () => {
    if (!draft.trim()) return;
    setAll([...all, {
      id: uid('tl'), title: draft.trim(),
      year: today?.year || 447, month: today?.month, day: today?.day,
      cat: 'campagna', text: '', revealed: false,
    }]);
    setDraft('');
  };

  const counts = TL_CATS.map(c => ({
    ...c, n: all.filter(e => catOf(e) === c.k && (s.dmMode || e.revealed)).length,
  })).filter(c => c.n > 0 || s.dmMode);

  // ── Il nodo sulla spina ──────────────────────────────────────
  // Funzioni di rendering, non componenti: un componente dichiarato dentro
  // TimelinePopup verrebbe visto da React come un tipo nuovo a ogni render e
  // rimontato da capo, facendo perdere il fuoco agli input della redazione a
  // ogni singola battuta. Restituendo direttamente JSX il problema non esiste.
  const renderNode = (e: TimelineEvent) => {
    const col = colorOf(e);
    const isOpen = openId === e.id;
    const isEdit = editId === e.id;
    const hidden = s.dmMode && !e.revealed;
    return (
      <div style={{ position: 'relative', paddingLeft: 30, paddingBottom: 14, opacity: hidden ? .62 : 1 }}>
        {/* pallino sulla spina */}
        <div style={{
          position: 'absolute', left: 8, top: 4, width: 13, height: 13, borderRadius: '50%',
          border: `2px solid ${col}`, background: e.revealed ? col : 'var(--bg-card)',
          boxShadow: e.revealed ? `0 0 9px ${col}` : 'none', zIndex: 1,
        }} />
        <button onClick={() => setOpenId(isOpen ? null : e.id)}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div className="label" style={{ fontSize: 8, color: col, letterSpacing: '1.4px' }}>
            {fmtEventDate(e)}{e.era ? ` · ${e.era}` : ''}
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'baseline', marginTop: 1 }}>
            <div className="grow" style={{ minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>
              {e.title}
            </div>
            {hidden && <span className="dm-badge" style={{ flexShrink: 0 }}>NASCOSTO</span>}
            <span style={{ flexShrink: 0, fontSize: 10, color: col, opacity: .8, transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : '' }}>▾</span>
          </div>
        </button>

        {isOpen && (
          <div style={{ marginTop: 6, borderLeft: `1px solid ${col}44`, paddingLeft: 10 }}>
            <div data-slot={'tl-' + e.id} style={{ marginBottom: e.text ? 8 : 0 }}>
              <ImageSlot slotId={'tl-' + e.id} campaignId={campaignId} shape="rounded" width="100%" height={120}
                dmMode={false} placeholder="" alt={e.title} hideIfEmpty
                objectPosition={`center ${e.imgPos ?? 50}%`} />
            </div>
            {e.text && <div style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--text-card)' }}><Markdown text={e.text} /></div>}
            <RevealsView list={e.reveals} dmMode={!!s.dmMode} accent={col} />
            {s.dmMode && e.dmNote && (
              <div className="card" style={{ marginTop: 8, padding: '6px 9px', borderColor: 'var(--gold)', borderStyle: 'dashed' }}>
                <div className="label" style={{ fontSize: 8, marginBottom: 2 }}>Nota DM</div>
                <div style={{ fontSize: 11.5, lineHeight: 1.5 }}><Markdown text={e.dmNote} /></div>
              </div>
            )}

            {s.dmMode && (
              <div className="row" style={{ gap: 5, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10, color: e.revealed ? col : 'var(--gray-purple-deep)' }}
                  title={e.revealed ? 'Nascondi ai giocatori' : 'Svela ai giocatori'}
                  onClick={() => { if (!e.revealed) sfxReveal(); patch(e.id, { revealed: !e.revealed }); }}>
                  {e.revealed ? '◉ visibile' : '◯ nascosto'}
                </button>
                <RevealBadge list={e.reveals} onChange={next => patch(e.id, { reveals: next })} accent={col} />
                <div className="grow" />
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }}
                  onClick={() => setEditId(isEdit ? null : e.id)}>✎ redazione</button>
              </div>
            )}

            {s.dmMode && isEdit && renderEditor(e)}
          </div>
        )}
      </div>
    );
  };

  // ── Redazione DM di una voce ─────────────────────────────────
  const renderEditor = (e: TimelineEvent) => {
    const col = colorOf(e);
    return (
      <div className="card" style={{ marginTop: 8, padding: '10px 11px' }}>
        <input value={e.title} placeholder="Titolo dell'evento…" onChange={ev => patch(e.id, { title: ev.target.value })}
          style={{ width: '100%', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, padding: '5px 9px', marginBottom: 7 }} />

        <div className="label" style={{ fontSize: 8, marginBottom: 4 }}>Datazione</div>
        <div className="row" style={{ gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 7 }}>
          <NumberInput value={e.year} onChange={n => patch(e.id, { year: n })} style={{ width: 68, fontSize: 12, padding: '4px 6px', textAlign: 'center' }} />
          <span className="small muted" style={{ fontSize: 10 }}>d.V.</span>
          <select value={e.month ?? ''} onChange={ev => patch(e.id, { month: ev.target.value ? parseInt(ev.target.value) : undefined })}
            style={{ fontSize: 11, padding: '4px 6px', flex: '1 1 110px' }}>
            <option value="">— mese ignoto —</option>
            {MONTHS.map(m => <option key={m.n} value={m.n}>{m.short}</option>)}
          </select>
          {e.month ? (
            <select value={e.day ?? ''} onChange={ev => patch(e.id, { day: ev.target.value ? parseInt(ev.target.value) : undefined })}
              style={{ fontSize: 11, padding: '4px 6px', width: 82 }}>
              <option value="">— giorno —</option>
              {Array.from({ length: DAYS_PER_MONTH }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          ) : null}
        </div>
        <div className="row" style={{ gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 7 }}>
          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10, color: e.approx ? 'var(--gold)' : 'var(--gray-purple-deep)' }}
            title="Datazione incerta: si leggerà «attorno al…»"
            onClick={() => patch(e.id, { approx: !e.approx })}>{e.approx ? '≈ incerta' : '= certa'}</button>
          <input value={e.era || ''} placeholder="Epoca (facoltativa)…" onChange={ev => patch(e.id, { era: ev.target.value })}
            style={{ flex: '1 1 130px', fontSize: 11, padding: '4px 8px' }} />
        </div>

        <div className="label" style={{ fontSize: 8, marginBottom: 4 }}>Filo</div>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {TL_CATS.map(c => (
            <button key={c.k} className="pill" onClick={() => patch(e.id, { cat: c.k })}
              style={{
                padding: '3px 9px', fontSize: 9, cursor: 'pointer',
                color: catOf(e) === c.k ? c.c : 'var(--gray-purple-deep)',
                borderColor: catOf(e) === c.k ? c.c : 'var(--border)',
                background: catOf(e) === c.k ? 'var(--bg-active)' : 'transparent',
              }}>{c.l}</button>
          ))}
        </div>

        <textarea value={e.text || ''} placeholder="Testo visibile ai giocatori…" onChange={ev => patch(e.id, { text: ev.target.value })}
          style={{ width: '100%', fontSize: 12, padding: '6px 8px', minHeight: 54, marginBottom: 6 }} />
        <textarea value={e.dmNote || ''} placeholder="Nota DM (mai visibile ai giocatori)…" onChange={ev => patch(e.id, { dmNote: ev.target.value })}
          style={{ width: '100%', fontSize: 11.5, padding: '6px 8px', minHeight: 40, borderColor: 'var(--gold)', borderStyle: 'dashed' }} />

        <div className="label" style={{ fontSize: 8, margin: '9px 0 4px' }}>Illustrazione</div>
        <ImageSlot slotId={'tl-' + e.id} campaignId={campaignId} shape="rounded" width="100%" height={110}
          dmMode placeholder="📷 Immagine dell'evento" alt={e.title} objectPosition={`center ${e.imgPos ?? 50}%`} />
        <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
          <span className="label" style={{ fontSize: 8 }}>Inquadr.</span>
          <input type="range" min={0} max={100} value={e.imgPos ?? 50} style={{ flex: 1 }}
            onChange={ev => patch(e.id, { imgPos: parseInt(ev.target.value) })} />
          <span className="small muted" style={{ fontSize: 9, width: 28, textAlign: 'right' }}>{e.imgPos ?? 50}%</span>
        </div>

        <RevealsEditor list={e.reveals} onChange={next => patch(e.id, { reveals: next })} accent={col} />

        <button className="btn btn-danger btn-ghost" style={{ width: '100%', fontSize: 10, marginTop: 8 }}
          onClick={() => { if (confirm(`Eliminare «${e.title}» dalle Cronache?`)) { setAll(all.filter(x => x.id !== e.id)); setEditId(null); setOpenId(null); } }}>
          Elimina evento
        </button>
      </div>
    );
  };

  return (
    <div className="alchemy-overlay" onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ borderColor: 'var(--gold-dim)', boxShadow: '0 0 40px rgba(216,180,92,.10)' }}>
        {/* Testata */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5">
              <path d="M12 3v18M12 6h6M12 12h5M12 18h6" strokeLinecap="round" />
              <circle cx="12" cy="6" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18" r="1.6" />
            </svg>
            <div className="h2" style={{ color: 'var(--gold)' }}>Le Cronache</div>
          </div>
          <div className="row" style={{ gap: 5 }}>
            {today && events.length > 4 && (
              <button className="btn btn-ghost" style={{ fontSize: 9, padding: '3px 8px', color: 'var(--gold)' }}
                title="Porta il presente sotto gli occhi"
                onClick={() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>↓ oggi</button>
            )}
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
          </div>
        </div>

        {/* Fili */}
        {counts.length > 1 && (
          <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            {counts.map(c => (
              <button key={c.k} className="pill" onClick={() => setCatFilter(catFilter === c.k ? null : c.k)}
                style={{
                  padding: '3px 9px', fontSize: 9, cursor: 'pointer',
                  color: catFilter === c.k ? c.c : 'var(--gray-purple-deep)',
                  borderColor: catFilter === c.k ? c.c : 'var(--border)',
                  background: catFilter === c.k ? 'var(--bg-active)' : 'transparent',
                }}>{c.l} {c.n > 0 ? c.n : ''}</button>
            ))}
          </div>
        )}

        {events.length === 0 && (
          <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>
            {s.dmMode ? 'Le Cronache sono ancora bianche. Annota qui sotto la prima data.' : 'Nessun evento è ancora stato annotato.'}
          </div>
        )}

        {/* La spina */}
        {events.length > 0 && (
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 14, top: 6, bottom: 6, width: 1,
              background: 'linear-gradient(180deg, transparent 0%, var(--border-sec) 6%, var(--border-sec) 94%, transparent 100%)',
            }} />
            {events.map((e, i) => {
              const gap = i > 0 ? gapInfo(events[i - 1], e) : null;
              return (
                <div key={e.id}>
                  {todayAt === i && renderToday()}
                  {gap && (
                    <div style={{ position: 'relative', paddingLeft: 30, paddingBottom: GAP_H[gap.weight], marginTop: -4 }}>
                      <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 1, borderLeft: '1px dashed var(--gray-purple-deep)', background: 'var(--bg-card)', opacity: .9 }} />
                      <span className="label" style={{ fontSize: 7.5, color: 'var(--gray-purple-deep)', letterSpacing: '2px' }}>⋯ {gap.label} ⋯</span>
                    </div>
                  )}
                  {renderNode(e)}
                </div>
              );
            })}
            {todayAt === events.length && renderToday()}
          </div>
        )}

        {/* Nuova voce — solo DM */}
        {s.dmMode && (
          <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
            <div className="label" style={{ marginBottom: 6 }}>Nuova voce</div>
            <div className="row" style={{ gap: 6 }}>
              <input className="grow" value={draft} placeholder="Titolo dell'evento…" onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addEvent(); }} style={{ fontSize: 13 }} />
              <button className="btn btn-primary" onClick={addEvent}>+</button>
            </div>
            <div className="small muted" style={{ marginTop: 6, fontSize: 10 }}>
              Nasce datata al giorno corrente e nascosta ai giocatori: data, filo e testo si correggono nella redazione.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function renderToday() {
    if (!today) return null;
    return (
      <div ref={todayRef} style={{ position: 'relative', paddingLeft: 30, paddingBottom: 14 }}>
        <div style={{
          position: 'absolute', left: 6, top: 2, width: 17, height: 17, borderRadius: '50%',
          border: '2px solid var(--gold)', background: 'var(--bg-card)', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} className="pulse-gold">
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />
        </div>
        <div className="label" style={{ fontSize: 8.5, color: 'var(--gold)', letterSpacing: '2px', paddingTop: 3 }}>
          OGGI · {today.day} {monthInfo(today.month).short} {today.year} d.V.
        </div>
      </div>
    );
  }
}
