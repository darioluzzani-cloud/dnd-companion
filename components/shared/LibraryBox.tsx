'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot, registerStorageFile } from '@/components/ImageSlot';
import { PanelBox } from '@/components/shared/PanelBox';
import { Markdown } from '@/components/shared/textUtils';
import { RevealBadge, RevealsView, RevealsEditor } from '@/components/shared/Reveals';
import { supabase } from '@/lib/supabase';
import { sfxReveal } from '@/lib/dnd/sounds';

// ─── BIBLIOTECA DI OLMOBIANCO ────────────────────────────────
// I volumi che il gruppo raccoglie lungo la campagna: un indice con
// copertina, scheda e, dove c'è, il PDF del testo. Il riquadro compare solo
// se nel villaggio esiste un edificio chiamato Biblioteca, così si accende
// da sé quando il DM lo costruisce senza che nulla vada configurato.
//
// Il PDF si apre in una scheda del browser invece che in un lettore
// integrato: funziona ovunque, non litiga col telefono, e soprattutto non
// consuma banda finché nessuno decide di leggere. Il file vive nello stesso
// deposito delle immagini, in una cartella propria.

const LIB_COLOR = 'var(--purple-light)';
const BUCKET = 'campaign-images';

export interface Volume {
  id: string;
  title: string;
  author?: string;          // attribuzione, spesso incerta
  kind?: string;            // trattato, diario, registro, liturgia…
  desc?: string;            // ciò che i giocatori leggono nella scheda
  dmNote?: string;
  file?: string;            // percorso del PDF nel deposito
  fileName?: string;
  revealed?: boolean;
  reveals?: any[];
}

/** L'edificio che abilita il riquadro, se il villaggio ce l'ha. */
export function libraryBuilding(s: any): any | undefined {
  return ((s?.buildings || []) as any[])
    .find(b => /bibliotec/i.test(b.name || ''));
}

export function LibraryBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const building = libraryBuilding(s);
  const volumes: Volume[] = ((s as any).library || []) as Volume[];
  const setVolumes = (list: Volume[]) => update({ library: list } as any);
  const patch = (id: string, p: Partial<Volume>) => setVolumes(volumes.map(v => v.id === id ? { ...v, ...p } : v));

  // Senza l'edificio il riquadro non esiste: né per i giocatori né per il DM,
  // che altrimenti si troverebbe una stanza che il villaggio non ha.
  if (!building) return null;
  if (!s.dmMode && building.revealed === false) return null;

  const shown = s.dmMode ? volumes : volumes.filter(v => v.revealed);

  const addVolume = () => {
    if (!draft.trim()) return;
    setVolumes([...volumes, { id: uid('vol'), title: draft.trim(), revealed: false }]);
    setDraft('');
  };

  /** Carica il PDF e registra il percorso sul volume. */
  const uploadPdf = async (v: Volume, file: File) => {
    if (!campaignId) return;
    setBusy(v.id);
    try {
      const path = `${campaignId}/library/${v.id}-${Date.now().toString(36)}.pdf`;
      if (v.file) await supabase.storage.from(BUCKET).remove([v.file]).catch(() => {});
      const { error } = await supabase.storage.from(BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '31536000', contentType: 'application/pdf' });
      if (error) throw error;
      patch(v.id, { file: path, fileName: file.name });
    } catch (e: any) {
      alert('Caricamento non riuscito: ' + (e.message || e));
    } finally { setBusy(null); }
  };

  const openPdf = async (v: Volume) => {
    if (!v.file) return;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(v.file);
    if (data?.publicUrl) window.open(data.publicUrl, '_blank', 'noopener');
  };

  const removePdf = async (v: Volume) => {
    if (!confirm('Rimuovere il PDF da questo volume? La scheda resta.')) return;
    if (v.file) await supabase.storage.from(BUCKET).remove([v.file]).catch(() => {});
    patch(v.id, { file: undefined, fileName: undefined });
  };

  return (
    <PanelBox title="Biblioteca" color={LIB_COLOR} bgSlot="library-bg" campaignId={campaignId} dmMode={s.dmMode}
      badge={<span className="pill" style={{ padding: '2px 8px', fontSize: 8.5, color: LIB_COLOR, borderColor: LIB_COLOR }}>{shown.length} volumi</span>}
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={LIB_COLOR} strokeWidth="1.5">
        <path d="M4 5h6a2 2 0 012 2v12a1.5 1.5 0 00-1.5-1.5H4V5zM20 5h-6a2 2 0 00-2 2v12a1.5 1.5 0 011.5-1.5H20V5z" />
      </svg>}>

      {shown.length === 0 && (
        <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>
          {s.dmMode ? 'Nessun volume. I libri che il gruppo trova si registrano qui sotto.' : 'Gli scaffali sono ancora vuoti.'}
        </div>
      )}

      {shown.map(v => {
        const isOpen = openId === v.id;
        const hidden = s.dmMode && !v.revealed;
        return (
          <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 5, opacity: hidden ? .62 : 1 }}>
            <div className="row" style={{ gap: 9, padding: 8, cursor: 'pointer', alignItems: 'flex-start' }}
              onClick={() => setOpenId(isOpen ? null : v.id)}>
              <div style={{ width: 42, height: 56, flexShrink: 0, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <ImageSlot slotId={'vol-' + v.id} campaignId={campaignId} shape="rect" width="100%" height="100%"
                  dmMode={false} placeholder="📕" alt={v.title} />
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, lineHeight: 1.25, color: 'var(--text)' }}>{v.title}</div>
                {(v.author || v.kind) && (
                  <div className="small muted" style={{ fontSize: 10, fontStyle: 'italic' }}>
                    {[v.kind, v.author].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="row" style={{ gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                  {v.file && <span className="pill" style={{ padding: '1px 7px', fontSize: 8, color: LIB_COLOR, borderColor: LIB_COLOR }}>PDF</span>}
                  {hidden && <span className="dm-badge">NON CATALOGATO</span>}
                </div>
              </div>
              <span style={{ fontSize: 12, color: LIB_COLOR, flexShrink: 0, transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : '' }}>▾</span>
            </div>

            {isOpen && (
              <div style={{ padding: '0 10px 10px' }}>
                {v.desc && <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-card)' }}><Markdown text={v.desc} /></div>}
                <RevealsView list={v.reveals} dmMode={!!s.dmMode} accent={LIB_COLOR} />

                {v.file && (
                  <button className="btn" style={{ width: '100%', fontSize: 11, marginTop: 8, borderColor: LIB_COLOR, color: LIB_COLOR }}
                    onClick={() => openPdf(v)}>
                    📖 Apri il volume{v.fileName ? ` · ${v.fileName}` : ''}
                  </button>
                )}

                {s.dmMode && v.dmNote && (
                  <div className="card" style={{ marginTop: 8, padding: '6px 9px', borderColor: 'var(--gold)', borderStyle: 'dashed' }}>
                    <div className="label" style={{ fontSize: 8, marginBottom: 2 }}>Nota DM</div>
                    <div style={{ fontSize: 11.5, lineHeight: 1.5 }}><Markdown text={v.dmNote} /></div>
                  </div>
                )}

                {s.dmMode && (
                  <>
                    <div className="row" style={{ gap: 5, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10, color: v.revealed ? LIB_COLOR : 'var(--gray-purple-deep)' }}
                        onClick={() => { if (!v.revealed) sfxReveal(); patch(v.id, { revealed: !v.revealed }); }}>
                        {v.revealed ? '◉ a scaffale' : '◯ non catalogato'}
                      </button>
                      <RevealBadge list={v.reveals} onChange={next => patch(v.id, { reveals: next })} accent={LIB_COLOR} />
                      <div className="grow" />
                      <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }}
                        onClick={() => setEditId(editId === v.id ? null : v.id)}>✎ redazione</button>
                    </div>

                    {editId === v.id && (
                      <div className="card" style={{ marginTop: 8, padding: '10px 11px' }}>
                        <input value={v.title} placeholder="Titolo…" onChange={e => patch(v.id, { title: e.target.value })}
                          style={{ width: '100%', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, padding: '5px 9px', marginBottom: 5 }} />
                        <div className="row" style={{ gap: 5, marginBottom: 5 }}>
                          <input value={v.kind || ''} placeholder="Genere (trattato, diario…)" onChange={e => patch(v.id, { kind: e.target.value })}
                            style={{ flex: 1, fontSize: 11, padding: '4px 7px' }} />
                          <input value={v.author || ''} placeholder="Attribuzione" onChange={e => patch(v.id, { author: e.target.value })}
                            style={{ flex: 1, fontSize: 11, padding: '4px 7px' }} />
                        </div>
                        <textarea value={v.desc || ''} placeholder="Scheda visibile ai giocatori…" onChange={e => patch(v.id, { desc: e.target.value })}
                          style={{ width: '100%', fontSize: 12, padding: '6px 8px', minHeight: 52, marginBottom: 5 }} />
                        <textarea value={v.dmNote || ''} placeholder="Nota DM…" onChange={e => patch(v.id, { dmNote: e.target.value })}
                          style={{ width: '100%', fontSize: 11.5, padding: '6px 8px', minHeight: 36, borderColor: 'var(--gold)', borderStyle: 'dashed' }} />

                        <div className="label" style={{ fontSize: 8, margin: '9px 0 4px' }}>Copertina</div>
                        <ImageSlot slotId={'vol-' + v.id} campaignId={campaignId} shape="rect" width="100%" height={120}
                          dmMode placeholder="📷 Copertina del volume" alt={v.title} />

                        <div className="label" style={{ fontSize: 8, margin: '9px 0 4px' }}>Testo (PDF)</div>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <label className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 10px', cursor: 'pointer', color: LIB_COLOR, borderColor: LIB_COLOR }}>
                            {busy === v.id ? 'caricamento…' : (v.file ? '📄 Sostituisci PDF' : '📄 Carica PDF')}
                            <input type="file" accept="application/pdf" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(v, f); e.target.value = ''; }} />
                          </label>
                          {v.file && (
                            <button className="btn btn-danger btn-ghost" style={{ fontSize: 10, padding: '4px 9px' }}
                              onClick={() => removePdf(v)}>Rimuovi PDF</button>
                          )}
                          <span className="small muted" style={{ fontSize: 9, flex: '1 1 100%' }}>
                            Si apre in una scheda del browser: non pesa finché nessuno lo apre. Conviene esportarlo compresso.
                          </span>
                        </div>

                        <RevealsEditor list={v.reveals} onChange={next => patch(v.id, { reveals: next })} accent={LIB_COLOR} />

                        <button className="btn btn-danger btn-ghost" style={{ width: '100%', fontSize: 10, marginTop: 8 }}
                          onClick={() => { if (confirm(`Eliminare «${v.title}» dalla biblioteca?`)) { setVolumes(volumes.filter(x => x.id !== v.id)); setEditId(null); setOpenId(null); } }}>
                          Elimina volume
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {s.dmMode && (
        <div className="card">
          <div className="label" style={{ marginBottom: 6 }}>Nuovo volume</div>
          <div className="row" style={{ gap: 6 }}>
            <input className="grow" value={draft} placeholder="Titolo del volume…" onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addVolume(); }} style={{ fontSize: 13 }} />
            <button className="btn btn-primary" onClick={addVolume}>+</button>
          </div>
          <div className="small muted" style={{ marginTop: 6, fontSize: 10 }}>
            Nasce non catalogato: i giocatori lo vedranno quando lo metterai a scaffale.
          </div>
        </div>
      )}
    </PanelBox>
  );
}
