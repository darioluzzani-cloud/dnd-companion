'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';

// ─── Categorie delle voci ────────────────────────────────────
const KINDS = [
  { id: 'talento',    label: 'Talento',            color: 'var(--gold)' },
  { id: 'padronanza', label: "Padronanza d'arma",  color: 'var(--blue)' },
  { id: 'privilegio', label: 'Privilegio di classe', color: 'var(--purple-light)' },
  { id: 'altro',      label: 'Altro',              color: 'var(--gray-purple)' },
];
const kindOf = (id: string) => KINDS.find(k => k.id === id) || KINDS[3];

export interface FeatEntry {
  id: string;
  name: string;
  kind: string;
  desc: string;
}

// ─── POPUP: TALENTI & PADRONANZE ─────────────────────────────
export function FeatsPopup({ s, update, p, campaignId, onClose }: { s: CampaignState; update: U; p: CampaignState['players'][0]; campaignId: string | null; onClose: () => void }) {
  const [bgTick, setBgTick] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState('talento');
  const [draftDesc, setDraftDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const feats: FeatEntry[] = (p as any).feats || [];
  const setFeats = (list: FeatEntry[]) => update(prev => ({ players: prev.players.map(pl => pl.id === p.id ? ({ ...pl, feats: list } as any) : pl) }));

  const addFeat = () => {
    if (!draftName.trim()) return;
    setFeats([...feats, { id: uid('ft'), name: draftName.trim(), kind: draftKind, desc: draftDesc.trim() }]);
    setDraftName(''); setDraftDesc('');
  };

  const patchFeat = (id: string, patch: Partial<FeatEntry>) => setFeats(feats.map(f => f.id === id ? { ...f, ...patch } : f));

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Ordino per categoria mantenendo l'ordine di inserimento interno
  const ordered = KINDS.flatMap(k => feats.filter(f => f.kind === k.id));

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Sfondo — immagine piena in alto che sfuma nel colore del pannello (condivisa tra i PG) */}
        <div key={bgTick} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ImageSlot slotId="feats-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" hideIfEmpty alt="" />
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(30,22,48,0) 0%, rgba(30,22,48,0.55) 25%, rgba(30,22,48,0.92) 50%, rgba(30,22,48,1) 70%)' }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={p.color || 'var(--gold)'} strokeWidth="1.5"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.5L7 22l5-2.5L17 22l-1.5-7.5"/></svg>
              <div className="h2" style={{ color: p.color || 'var(--gold)' }}>Talenti & Padronanze</div>
            </div>
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
          </div>

          {/* Elenco voci */}
          {ordered.length === 0 && (
            <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Nessuna voce registrata per {p.short || p.name}.</div>
          )}
          {ordered.map(f => {
            const k = kindOf(f.kind);
            const open = expanded.has(f.id);
            return (
              <div key={f.id} className="card" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => toggle(f.id)}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-purple)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : '' }}>▾</span>
                  <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{f.name}</span>
                  <span className="pill" style={{ padding: '2px 8px', fontSize: 8, color: k.color, borderColor: k.color, flexShrink: 0 }}>{k.label}</span>
                  <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 10, flexShrink: 0 }} title="Correggi testo"
                    onClick={e => { e.stopPropagation(); setEditingId(editingId === f.id ? null : f.id); if (!expanded.has(f.id)) toggle(f.id); }}>✎</button>
                  <button className="btn btn-danger btn-ghost" style={{ padding: '1px 6px', fontSize: 10, flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); if (confirm('Rimuovere "' + f.name + '"?')) setFeats(feats.filter(x => x.id !== f.id)); }}>&times;</button>
                </div>
                {open && (
                  <div className="small" style={{ marginTop: 6, color: 'var(--text-card)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }} onClick={e => e.stopPropagation()}>
                    {editingId === f.id ? (
                      <div>
                        <input value={f.name} onChange={e => patchFeat(f.id, { name: e.target.value })} style={{ fontSize: 13, marginBottom: 4 }} />
                        <select value={f.kind} onChange={e => patchFeat(f.id, { kind: e.target.value })} style={{ fontSize: 12, marginBottom: 4 }}>
                          {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                        <textarea value={f.desc} onChange={e => patchFeat(f.id, { desc: e.target.value })} style={{ minHeight: 56, fontSize: 13, marginBottom: 4 }} />
                        <button className="btn" style={{ fontSize: 10 }} onClick={() => setEditingId(null)}>Fine</button>
                      </div>
                    ) : (
                      f.desc || <span className="muted" style={{ fontStyle: 'italic' }}>Nessuna descrizione.</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Aggiunta nuova voce */}
          <div className="card" style={{ marginTop: 8, marginBottom: s.dmMode ? 10 : 0 }}>
            <div className="label" style={{ marginBottom: 6 }}>Nuova voce</div>
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <input value={draftName} placeholder="Nome (es. Allerta, Fendere…)" onChange={e => setDraftName(e.target.value)} className="grow" style={{ fontSize: 13 }} />
              <select value={draftKind} onChange={e => setDraftKind(e.target.value)} style={{ width: 150, fontSize: 12 }}>
                {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <textarea value={draftDesc} placeholder="Effetto e note…" onChange={e => setDraftDesc(e.target.value)} style={{ minHeight: 48, fontSize: 13, marginBottom: 6 }} />
            <button className="btn btn-primary" style={{ width: '100%', fontSize: 11 }} onClick={addFeat}>Aggiungi</button>
          </div>

          {/* Sfondo — solo DM */}
          {s.dmMode && (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div className="label" style={{ fontSize: 9 }}>Sfondo</div>
              <div style={{ width: 72, height: 44 }}>
                <ImageSlot slotId="feats-bg" campaignId={campaignId} shape="rounded" width="100%" height="100%" dmMode placeholder="Sfondo" alt="" onUploaded={() => setBgTick(t => t + 1)} />
              </div>
              <span className="small muted">Unica per tutti i personaggi; sfuma nel pannello come nell'alchimia.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
