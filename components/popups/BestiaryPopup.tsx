'use client';
import { useState } from 'react';
import { CampaignState, uid, BestiaryEntry } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { sfxDice } from '@/lib/dnd/sounds';

// ─── POPUP: BESTIARIO — registro nemici riutilizzabile ──────
export function BestiaryPopup({ s, update, campaignId, combatScen, onClose }: { s: CampaignState; update: U; campaignId: string | null; combatScen: string; onClose: () => void }) {
  const [draftName, setDraftName] = useState('');
  const [draftHp, setDraftHp] = useState('');
  const [draftInit, setDraftInit] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const bestiary: BestiaryEntry[] = s.bestiary || [];
  const setBestiary = (list: BestiaryEntry[]) => update({ bestiary: list });

  const addEntry = () => {
    if (!draftName.trim()) return;
    setBestiary([...bestiary, {
      id: uid('bst'),
      name: draftName.trim(),
      maxHp: Math.max(1, parseInt(draftHp) || 1),
      initMod: parseInt(draftInit) || 0,
    }]);
    setDraftName(''); setDraftHp(''); setDraftInit('');
  };

  const patchEntry = (id: string, patch: Partial<BestiaryEntry>) =>
    setBestiary(bestiary.map(e => e.id === id ? { ...e, ...patch } : e));

  // Ingaggio: genera un combattente nello scenario corrente, con numerazione dei duplicati
  const engage = (e: BestiaryEntry) => {
    const dupRe = new RegExp('^' + e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( \\d+)?$');
    const existing = s.combatants.filter(c =>
      (!combatScen || (c as any).scenarioId === combatScen) && dupRe.test(c.name)
    ).length;
    const name = existing === 0 ? e.name : e.name + ' ' + (existing + 1);
    const init = Math.floor(Math.random() * 20) + 1 + (e.initMod || 0);
    sfxDice();
    update(prev => ({
      combatants: [...prev.combatants, {
        id: uid('k'), name, init,
        hp: e.maxHp, maxHp: e.maxHp,
        side: 'enemy' as const, conditions: [],
        scenarioId: combatScen,
        imgSlot: 'beast-' + e.id,
      } as any],
    }));
  };

  const fmtMod = (n: number) => (n >= 0 ? '+' + n : '' + n);

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ borderColor: 'var(--pink-border)', boxShadow: '0 0 40px rgba(214,100,122,.10)' }}>
        {/* Header */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5"><path d="M12 2c-1.5 3-4 4-7 4 0 7 3 12 7 16 4-4 7-9 7-16-3 0-5.5-1-7-4z"/><path d="M9 10h.01M15 10h.01M9.5 14c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1"/></svg>
            <div className="h2" style={{ color: 'var(--red)' }}>Bestiario</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
        </div>

        {bestiary.length === 0 && (
          <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Nessuna scheda nel registro. Prepara i nemici qui e ingaggiali in qualunque scenario.</div>
        )}

        {/* Schede */}
        {bestiary.map(e => (
          <div key={e.id} className="card" style={{ padding: '10px 12px' }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ width: 44, height: 60, flexShrink: 0, overflow: 'hidden', borderRadius: 6 }}>
                <ImageSlot slotId={'beast-' + e.id} campaignId={campaignId} shape="rect" width={44} height={60} dmMode={s.dmMode} placeholder={e.name.slice(0, 2).toUpperCase()} alt={e.name} />
              </div>
              <div className="grow">
                {editingId === e.id ? (
                  <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    <input value={e.name} onChange={ev => patchEntry(e.id, { name: ev.target.value })} style={{ fontSize: 13, padding: '3px 8px', flex: '1 1 100%' }} />
                    <input type="number" value={e.maxHp} title="PF massimi" onChange={ev => patchEntry(e.id, { maxHp: Math.max(1, parseInt(ev.target.value) || 1) })} style={{ width: 62, fontSize: 13, padding: '3px 6px', textAlign: 'center' }} />
                    <span className="small muted">PF</span>
                    <input type="number" value={e.initMod} title="Modificatore d'iniziativa" onChange={ev => patchEntry(e.id, { initMod: parseInt(ev.target.value) || 0 })} style={{ width: 52, fontSize: 13, padding: '3px 6px', textAlign: 'center' }} />
                    <span className="small muted">iniz.</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{e.name}</div>
                    <div className="small muted" style={{ marginTop: 2 }}>{e.maxHp} PF · iniziativa {fmtMod(e.initMod || 0)}</div>
                  </>
                )}
              </div>
              <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                {s.dmMode && (
                  <>
                    <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} title="Modifica scheda"
                      onClick={() => setEditingId(editingId === e.id ? null : e.id)}>✎</button>
                    <button className="btn btn-danger btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} title="Elimina scheda"
                      onClick={() => { if (confirm('Eliminare "' + e.name + '" dal bestiario? I combattenti già in battaglia restano.')) setBestiary(bestiary.filter(x => x.id !== e.id)); }}>&times;</button>
                  </>
                )}
                <button className="btn btn-primary" style={{ fontSize: 9, padding: '5px 10px' }} onClick={() => engage(e)}>Ingaggia</button>
              </div>
            </div>
          </div>
        ))}

        {/* Nuova scheda — solo DM */}
        {s.dmMode && (
          <div className="card" style={{ marginTop: 8, marginBottom: 0 }}>
            <div className="label" style={{ marginBottom: 6 }}>Nuova scheda</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <input value={draftName} placeholder="Nome (es. Lupo)" onChange={e => setDraftName(e.target.value)} style={{ fontSize: 13, flex: '1 1 100%' }} />
              <input type="number" value={draftHp} placeholder="PF" onChange={e => setDraftHp(e.target.value)} style={{ width: 70, fontSize: 13, textAlign: 'center' }} />
              <input type="number" value={draftInit} placeholder="Mod. iniz." onChange={e => setDraftInit(e.target.value)} style={{ width: 90, fontSize: 13, textAlign: 'center' }} />
              <button className="btn btn-primary grow" style={{ fontSize: 11 }} onClick={addEntry}>Aggiungi al registro</button>
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>Il ritratto si carica sulla scheda e segue il nemico in ogni scenario.</div>
          </div>
        )}
      </div>
    </div>
  );
}
