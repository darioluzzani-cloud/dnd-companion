'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { masteryById, normWeapon } from '@/lib/dnd/mastery';

// ─── Categorie delle voci ────────────────────────────────────
// La vecchia categoria a testo libero «Padronanza d'arma» è stata ritirata:
// la selezione automatica sulle armi possedute la sostituisce interamente, e
// tenerle entrambe significava avere due elenchi che dicevano la stessa cosa
// senza mai coincidere. Le voci già scritte non vengono cancellate — restano
// leggibili nel loro riquadro, marcato come superato, finché non le si toglie.
const KINDS = [
  { id: 'talento',    label: 'Talenti',              color: 'var(--gold)' },
  { id: 'privilegio', label: 'Privilegi di classe',  color: 'var(--purple-light)' },
  { id: 'altro',      label: 'Altro',                color: 'var(--gray-purple)' },
];
const LEGACY_KIND = { id: 'padronanza', label: 'Padronanze (voci manuali)', color: 'var(--gray-purple-deep)' };
const ALL_KINDS = [...KINDS, LEGACY_KIND];
const kindOf = (id: string) => ALL_KINDS.find(k => k.id === id) || KINDS[2];

// ─── Competenze in armi, armature e strumenti ────────────────
// Elenco canonico della 5.5 in italiano, con la possibilità di aggiungere
// voci proprie: gli strumenti da artigiano e le padronanze regionali non
// stanno in nessuna lista chiusa. La spunta segue lo stesso gesto delle
// abilità nella Scheda.
const PROF_GROUPS: { id: string; label: string; color: string; items: string[] }[] = [
  { id: 'armi', label: 'Armi', color: 'var(--red)', items: [
    'Armi semplici', 'Armi da guerra', 'Armi da fuoco',
    'Balestra a mano', 'Spada lunga', 'Spada corta', 'Stocco', 'Arco lungo', 'Arco corto',
  ] },
  { id: 'armature', label: 'Armature', color: 'var(--blue)', items: [
    'Armature leggere', 'Armature medie', 'Armature pesanti', 'Scudi',
  ] },
  { id: 'strumenti', label: 'Strumenti', color: 'var(--gold)', items: [
    'Arnesi da scasso', 'Kit da erborista', 'Attrezzi da fabbro', 'Attrezzi da falegname',
    'Attrezzi da conciapelli', 'Attrezzi da alchimista', 'Attrezzi da calligrafo',
    'Attrezzi da gioielliere', 'Strumenti musicali', 'Kit da camuffamento',
    'Kit da falsario', 'Kit da avvelenatore', 'Utensili da cuoco', 'Veicoli terrestri', 'Veicoli acquatici',
  ] },
];

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
  // Apertura dei riquadri: locale, tutti chiusi all'ingresso, così il popup
  // si presenta come un indice invece che come un muro di testo.
  const [openBox, setOpenBox] = useState<Set<string>>(new Set());
  const toggleBox = (k: string) => setOpenBox(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const feats: FeatEntry[] = (p as any).feats || [];
  const setFeats = (list: FeatEntry[]) => update(prev => ({ players: prev.players.map(pl => pl.id === p.id ? ({ ...pl, feats: list } as any) : pl) }));

  const addFeat = () => {
    if (!draftName.trim()) return;
    setFeats([...feats, { id: uid('ft'), name: draftName.trim(), kind: draftKind, desc: draftDesc.trim() }]);
    setDraftName(''); setDraftDesc('');
  };

  const patchFeat = (id: string, patch: Partial<FeatEntry>) => setFeats(feats.map(f => f.id === id ? { ...f, ...patch } : f));

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Competenze ──
  const profGear: Record<string, boolean> = (p as any).profGear || {};
  const setProfGear = (next: Record<string, boolean>) =>
    update(prev => ({ players: prev.players.map(pl => pl.id === p.id ? ({ ...pl, profGear: next } as any) : pl) }));
  const toggleProf = (key: string) => setProfGear({ ...profGear, [key]: !profGear[key] });
  /** Voci mostrate per un gruppo: il canone, più ciò che è stato aggiunto a mano. */
  const itemsOf = (g: typeof PROF_GROUPS[0]) => {
    const custom = Object.keys(profGear).filter(k => k.startsWith(g.id + ':')).map(k => k.slice(g.id.length + 1));
    return [...g.items, ...custom.filter(c => !g.items.includes(c))];
  };
  // ── Padronanze d'arma ──
  // Il personaggio dichiara con quali armi ha padronanza; l'elenco proposto
  // è quello delle armi che possiede, perché è là che la scelta ha effetto.
  // Da qui si accende o si spegne la pastiglia nella scheda dell'oggetto.
  const masteryWeapons: string[] = (p as any).masteryWeapons || [];
  const ownedWeapons: any[] = (p.inventory || []).filter((i: any) =>
    ['arma', 'magico', 'unico'].includes(i.type) && i.mastery);
  const setMasteryWeapons = (list: string[]) =>
    update(prev => ({ players: prev.players.map(pl => pl.id === p.id ? ({ ...pl, masteryWeapons: list } as any) : pl) }));
  const toggleMasteryWeapon = (name: string) => {
    const k = normWeapon(name);
    setMasteryWeapons(masteryWeapons.some(w => normWeapon(w) === k)
      ? masteryWeapons.filter(w => normWeapon(w) !== k)
      : [...masteryWeapons, name]);
  };
  const hasMastery = (name: string) => masteryWeapons.some(w => normWeapon(w) === normWeapon(name));

  const addCustomProf = (gid: string) => {
    const name = prompt('Nuova competenza da aggiungere all\'elenco:');
    if (!name || !name.trim()) return;
    setProfGear({ ...profGear, [gid + ':' + name.trim()]: true });
  };

  const featsOf = (kindId: string) => feats.filter(f => f.kind === kindId);
  const legacy = featsOf(LEGACY_KIND.id);

  /** Testata comune dei riquadri: titolo, contatore, chevron. */
  const boxHead = (key: string, label: string, color: string, count: number, note?: string) => (
    <div className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleBox(key)}>
      <div className="label" style={{ color }}>{label}</div>
      {note && <span className="small muted" style={{ fontSize: 8.5, fontStyle: 'italic' }}>{note}</span>}
      <div className="grow" />
      <span className="small muted" style={{ fontSize: 10 }}>{count}</span>
      <span style={{ fontSize: 13, color, transition: 'transform .2s', display: 'inline-block', transform: openBox.has(key) ? 'rotate(180deg)' : '' }}>▾</span>
    </div>
  );

  /** Riga di una voce, identica in ogni riquadro. */
  const renderFeat = (f: FeatEntry) => {
    const k = kindOf(f.kind);
    const open = expanded.has(f.id);
    return (
      <div key={f.id} className="card" style={{ padding: '9px 11px', marginBottom: 4, cursor: 'pointer' }} onClick={() => toggle(f.id)}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-purple)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : '' }}>▾</span>
          <span style={{ fontWeight: 500, fontSize: 13, flex: 1, minWidth: 0 }}>{f.name}</span>
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
                  {KINDS.map(kk => <option key={kk.id} value={kk.id}>{kk.label}</option>)}
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
  };

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

          {/* Talenti, Privilegi, Altro — un riquadro per categoria */}
          {KINDS.map(k => {
            const list = featsOf(k.id);
            return (
              <div key={k.id} className="card" style={{ marginBottom: 6 }}>
                {boxHead(k.id, k.label, k.color, list.length)}
                {openBox.has(k.id) && (
                  <div style={{ marginTop: 8 }}>
                    {list.length === 0
                      ? <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5 }}>Nessuna voce in questa categoria.</div>
                      : list.map(renderFeat)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Voci di padronanza scritte a mano prima della selezione
              automatica: restano leggibili, marcate come superate. */}
          {legacy.length > 0 && (
            <div className="card" style={{ marginBottom: 6, borderStyle: 'dashed' }}>
              {boxHead(LEGACY_KIND.id, LEGACY_KIND.label, LEGACY_KIND.color, legacy.length, 'superate')}
              {openBox.has(LEGACY_KIND.id) && (
                <div style={{ marginTop: 8 }}>
                  <div className="small muted" style={{ fontSize: 10, fontStyle: 'italic', marginBottom: 6, lineHeight: 1.5 }}>
                    Queste voci precedono la selezione automatica qui sotto, che le sostituisce. Si possono togliere quando vuoi, oppure spostare in un'altra categoria dalla matita.
                  </div>
                  {legacy.map(renderFeat)}
                </div>
              )}
            </div>
          )}

          {/* Padronanze d'arma */}
          <div className="card" style={{ marginTop: 8 }}>
            {boxHead('mastery', "Padronanze d'arma", 'var(--ember)', masteryWeapons.length)}
            {openBox.has('mastery') && (<div style={{ marginTop: 8 }}>
            {ownedWeapons.length === 0 ? (
              <div className="small muted" style={{ fontSize: 10.5, fontStyle: 'italic' }}>
                Nessuna arma con padronanza nell'inventario. La padronanza si assegna all'arma dal catalogo dell'Armeria.
              </div>
            ) : (
              <>
                <div className="small muted" style={{ fontSize: 10, marginBottom: 6, lineHeight: 1.5 }}>
                  Accendi le armi di cui il personaggio sa sfruttare la padronanza: nella scheda dell'oggetto l'effetto comparirà attivo, altrimenti resterà spento.
                </div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {ownedWeapons.map((w: any) => {
                    const on = hasMastery(w.name);
                    const mast = masteryById(s, w.mastery);
                    return (
                      <button key={w.id} className="pill" onClick={() => toggleMasteryWeapon(w.name)}
                        title={mast ? mast.name : undefined}
                        style={{ padding: '4px 10px', fontSize: 9.5, cursor: 'pointer',
                          color: on ? 'var(--ember)' : 'var(--gray-purple-deep)',
                          borderColor: on ? 'var(--ember)' : 'var(--border)',
                          background: on ? 'var(--bg-active)' : 'transparent' }}>
                        {on ? '◆' : '◇'} {w.name}
                        {mast && <span style={{ opacity: .75 }}> · {mast.name}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            </div>)}
          </div>

          {/* Competenze in armi, armature e strumenti */}
          <div className="card" style={{ marginBottom: 6 }}>
            {boxHead('prof', 'Competenze', 'var(--blue)', Object.values(profGear).filter(Boolean).length)}
            {openBox.has('prof') && (<div style={{ marginTop: 8 }}>
            {PROF_GROUPS.map(g => {
              const list = itemsOf(g);
              const active = list.filter(i => profGear[g.id + ':' + i]);
              return (
                <div key={g.id} style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'baseline', marginBottom: 5 }}>
                    <span className="label" style={{ fontSize: 8, color: g.color, letterSpacing: 1.4 }}>{g.label}</span>
                    <span className="small muted" style={{ fontSize: 9 }}>{active.length}</span>
                    <div className="grow" />
                    <button className="btn btn-ghost" style={{ padding: '1px 7px', fontSize: 9 }}
                      title="Aggiungi una voce non in elenco" onClick={() => addCustomProf(g.id)}>+ voce</button>
                  </div>
                  <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {list.map(i => {
                      const key = g.id + ':' + i;
                      const on = !!profGear[key];
                      const custom = !g.items.includes(i);
                      return (
                        <button key={key} className="pill" onClick={() => toggleProf(key)}
                          title={custom ? 'Voce aggiunta a mano — spegnendola resta in elenco' : undefined}
                          style={{ padding: '3px 9px', fontSize: 9, cursor: 'pointer',
                            color: on ? g.color : 'var(--gray-purple-deep)',
                            borderColor: on ? g.color : 'var(--border)',
                            borderStyle: custom ? 'dashed' : 'solid',
                            background: on ? 'var(--bg-active)' : 'transparent' }}>
                          {on ? '◆' : '◇'} {i}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="small muted" style={{ fontSize: 9, fontStyle: 'italic' }}>
              Le voci tratteggiate sono aggiunte proprie del personaggio e restano in elenco anche da spente.
            </div>
            </div>)}
          </div>

          {/* Aggiunta nuova voce */}
          <div className="card" style={{ marginBottom: s.dmMode ? 10 : 0 }}>
            {boxHead('new', 'Nuova voce', 'var(--gray-purple)', 0)}
            {openBox.has('new') && (<div style={{ marginTop: 8 }}>
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <input value={draftName} placeholder="Nome (es. Allerta, Fendere…)" onChange={e => setDraftName(e.target.value)} className="grow" style={{ fontSize: 13 }} />
              <select value={draftKind} onChange={e => setDraftKind(e.target.value)} style={{ width: 150, fontSize: 12 }}>
                {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <textarea value={draftDesc} placeholder="Effetto e note…" onChange={e => setDraftDesc(e.target.value)} style={{ minHeight: 48, fontSize: 13, marginBottom: 6 }} />
            <button className="btn btn-primary" style={{ width: '100%', fontSize: 11 }} onClick={addFeat}>Aggiungi</button>
            </div>)}
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
