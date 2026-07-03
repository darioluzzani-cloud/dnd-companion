'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { getLevelInfo } from '@/lib/dnd/xp-table';

// ─── Caratteristiche e abilità (D&D 5e 2024, nomi italiani) ──
const ABILITIES = [
  { k: 'str', l: 'Forza',        s: 'FOR' },
  { k: 'dex', l: 'Destrezza',    s: 'DES' },
  { k: 'con', l: 'Costituzione', s: 'COS' },
  { k: 'int', l: 'Intelligenza', s: 'INT' },
  { k: 'wis', l: 'Saggezza',     s: 'SAG' },
  { k: 'cha', l: 'Carisma',      s: 'CAR' },
];

const SKILLS = [
  { id: 'acrobazia',      l: 'Acrobazia',           ab: 'dex' },
  { id: 'addestrare',     l: 'Addestrare Animali',  ab: 'wis' },
  { id: 'arcano',         l: 'Arcano',              ab: 'int' },
  { id: 'atletica',       l: 'Atletica',            ab: 'str' },
  { id: 'furtivita',      l: 'Furtività',           ab: 'dex' },
  { id: 'indagare',       l: 'Indagare',            ab: 'int' },
  { id: 'inganno',        l: 'Inganno',             ab: 'cha' },
  { id: 'intimidire',     l: 'Intimidire',          ab: 'cha' },
  { id: 'intrattenere',   l: 'Intrattenere',        ab: 'cha' },
  { id: 'intuizione',     l: 'Intuizione',          ab: 'wis' },
  { id: 'medicina',       l: 'Medicina',            ab: 'wis' },
  { id: 'natura',         l: 'Natura',              ab: 'int' },
  { id: 'percezione',     l: 'Percezione',          ab: 'wis' },
  { id: 'persuasione',    l: 'Persuasione',         ab: 'cha' },
  { id: 'rapidita',       l: 'Rapidità di Mano',    ab: 'dex' },
  { id: 'religione',      l: 'Religione',           ab: 'int' },
  { id: 'sopravvivenza',  l: 'Sopravvivenza',       ab: 'wis' },
  { id: 'storia',         l: 'Storia',              ab: 'int' },
];

const fmt = (n: number) => (n >= 0 ? '+' + n : '' + n);

// ─── POPUP: SCHEDA — competenza, tiri salvezza, abilità ─────
export function SheetPopup({ s, update, p, campaignId, onClose }: { s: CampaignState; update: U; p: CampaignState['players'][0]; campaignId: string | null; onClose: () => void }) {
  const [bgTick, setBgTick] = useState(0);
  const info = getLevelInfo(p.xp || 0);
  const pb = 2 + Math.floor((info.level - 1) / 4);
  const abs = (p as any).abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const mod = (k: string) => Math.floor(((abs[k] ?? 10) - 10) / 2);
  const saveProf: Record<string, boolean> = (p as any).saveProf || {};
  const skillProf: Record<string, number> = (p as any).skillProf || {};

  const setP = (f: string, v: any) => update(prev => ({ players: prev.players.map(pl => pl.id === p.id ? { ...pl, [f]: v } : pl) }));
  const toggleSave = (k: string) => setP('saveProf', { ...saveProf, [k]: !saveProf[k] });
  const cycleSkill = (id: string) => setP('skillProf', { ...skillProf, [id]: ((skillProf[id] || 0) + 1) % 3 });

  const skillBonus = (sk: typeof SKILLS[0]) => mod(sk.ab) + (skillProf[sk.id] || 0) * pb;
  const passivePerception = 10 + skillBonus(SKILLS.find(x => x.id === 'percezione')!);

  const profMark = (lv: number) => lv === 2 ? '◆◆' : lv === 1 ? '◆' : '◇';
  const profColor = (lv: number) => lv === 2 ? 'var(--gold-light)' : lv === 1 ? (p.color || 'var(--gold)') : 'var(--gray-purple-deep)';

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Sfondo — immagine del PG a bassa opacità, sotto il contenuto */}
        <div key={bgTick} style={{ position: 'absolute', inset: 0, opacity: .12, pointerEvents: 'none' }}>
          <ImageSlot slotId={'sheet-bg-' + p.id} campaignId={campaignId} shape="rect" width="100%" height="100%" hideIfEmpty alt="" />
        </div>

        <div style={{ position: 'relative' }}>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={p.color || 'var(--gold)'} strokeWidth="1.5"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
              <div className="h2" style={{ color: p.color || 'var(--gold)' }}>{p.short || p.name}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="pill" style={{ padding: '4px 12px', color: 'var(--gold)', borderColor: 'var(--gold-dim)', fontWeight: 600 }}>Competenza +{pb}</span>
              <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
            </div>
          </div>

          {/* Tiri salvezza */}
          <div className="card">
            <div className="label" style={{ marginBottom: 8 }}>Tiri salvezza · tocca per la competenza</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {ABILITIES.map(a => {
                const prof = !!saveProf[a.k];
                const v = mod(a.k) + (prof ? pb : 0);
                return (
                  <button key={a.k} onClick={() => toggleSave(a.k)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                      padding: '7px 10px', borderRadius: 6, cursor: 'pointer', transition: 'all .15s',
                      background: prof ? 'var(--bg-active)' : 'var(--bg-deep)',
                      border: '1px solid ' + (prof ? (p.color || 'var(--gold)') : 'var(--border)'),
                    }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '1px', color: prof ? 'var(--text)' : 'var(--gray-purple)' }}>{a.s}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: prof ? (p.color || 'var(--gold)') : 'var(--gray-purple)' }}>{fmt(v)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Abilità */}
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="label">Abilità · tocca per ciclare</div>
              <div className="small muted">◇ nessuna · ◆ competenza · ◆◆ maestria</div>
            </div>
            {SKILLS.map(sk => {
              const lv = skillProf[sk.id] || 0;
              const v = skillBonus(sk);
              const abShort = ABILITIES.find(a => a.k === sk.ab)!.s;
              return (
                <div key={sk.id} className="row" style={{ padding: '4px 2px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => cycleSkill(sk.id)}>
                  <span style={{ fontSize: 13, color: profColor(lv), width: 26, letterSpacing: '1px', flexShrink: 0 }}>{profMark(lv)}</span>
                  <span style={{ fontSize: 13, flex: 1, color: lv > 0 ? 'var(--text)' : 'var(--text-card)' }}>{sk.l}</span>
                  <span className="small muted" style={{ width: 34, textAlign: 'center', flexShrink: 0 }}>{abShort}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, width: 34, textAlign: 'right', flexShrink: 0, color: lv > 0 ? (p.color || 'var(--gold)') : 'var(--gray-purple)' }}>{fmt(v)}</span>
                </div>
              );
            })}
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="small muted">Percezione passiva</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{passivePerception}</span>
            </div>
          </div>

          {/* Lingue, strumenti e altre competenze */}
          <div className="card" style={{ marginBottom: s.dmMode ? 10 : 0 }}>
            <div className="label" style={{ marginBottom: 6 }}>Lingue, strumenti e altre competenze</div>
            <textarea value={(p as any).profNotes || ''} placeholder="Es. Comune, Gigante · Arnesi da scasso · Kit da erborista…"
              onChange={e => setP('profNotes', e.target.value)}
              style={{ minHeight: 48, fontSize: 13 }} />
          </div>

          {/* Sfondo scheda — solo DM */}
          {s.dmMode && (
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 0 }}>
              <div className="label" style={{ fontSize: 9 }}>Sfondo scheda</div>
              <div style={{ width: 72, height: 44 }}>
                <ImageSlot slotId={'sheet-bg-' + p.id} campaignId={campaignId} shape="rounded" width="100%" height="100%" dmMode placeholder="Sfondo" alt="" onUploaded={() => setBgTick(t => t + 1)} />
              </div>
              <span className="small muted">L'immagine appare in filigrana dietro la scheda.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
