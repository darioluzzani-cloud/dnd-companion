'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { RevealsEditor } from '@/components/shared/Reveals';
import { absDay, DEFAULT_CALENDAR } from '@/lib/dnd/calendar';
import {
  DeckCard, Aptitude, CardStatus, deckCardsOf, cardStatus, activitiesOf, gateOf, dismissedIds,
} from '@/lib/dnd/village';

// ─── POPUP: FORESTIERI — il catalogo del mazzo ──────────────
// Speculare all'Armeria: il DM prepara qui, prima della sessione, i
// notabili che potranno bussare alla porta di Olmobianco — ritratto, ruolo,
// tratto, lore visibile e nascosta, bonus e malus per attività. Le carte
// non compaiono fra i PNG: lo diventano quando il gruppo le accoglie, con
// lo stesso identificativo e quindi con lo stesso ritratto.
//
// Una carta già accolta non si modifica più da qui: da quel momento vive
// nella sezione PNG, ed è lì che se ne svela la lore nascosta.

const COLOR = 'var(--purple-light)';
const STATUS: Record<CardStatus, { label: string; color: string }> = {
  mazzo:    { label: 'Nel mazzo',  color: 'var(--gold-dim)' },
  porta:    { label: 'Alla porta', color: COLOR },
  accolto:  { label: 'Accolto',    color: 'var(--green)' },
  respinto: { label: 'Respinto',   color: 'var(--gray-purple)' },
};

export function DeckPopup({ s, update, campaignId, onClose }: { s: CampaignState; update: U; campaignId: string | null; onClose: () => void }) {
  const cards = deckCardsOf(s);
  const acts = activitiesOf(s);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const today = absDay((s.calendar || DEFAULT_CALENDAR).date);

  // Ogni scrittura riparte dal catalogo più recente.
  const writeCards = (fn: (list: DeckCard[]) => DeckCard[]) => update(prev => ({ villageDeck: fn(deckCardsOf(prev)) } as any));
  const patchCard = (id: string, p: Partial<DeckCard>) => writeCards(list => list.map(c => c.id === id ? { ...c, ...p } : c));
  const addCard = () => {
    if (!draft.trim()) return;
    const id = uid('c');
    writeCards(list => [...list, { id, name: draft.trim() }]);
    setDraft(''); setOpenId(id);
  };
  const delCard = (c: DeckCard) => {
    if (!confirm(`Eliminare la carta di ${c.name}? Il ritratto caricato resta nello spazio immagini.`)) return;
    update(prev => ({
      villageDeck: deckCardsOf(prev).filter(x => x.id !== c.id),
      villageGate: gateOf(prev).filter(g => g.npcId !== c.id),
      villageDismissed: dismissedIds(prev).filter(x => x !== c.id),
    } as any));
  };
  const callIn = (id: string) => update(prev => ({ villageGate: [...gateOf(prev).filter(g => g.npcId !== id), { npcId: id, sinceAbs: today }] } as any));
  const sendBack = (id: string) => update(prev => ({
    villageGate: gateOf(prev).filter(g => g.npcId !== id),
    villageDismissed: dismissedIds(prev).filter(x => x !== id),
  } as any));

  const counts = cards.reduce((m, c) => { const k = cardStatus(s, c.id); m[k] = (m[k] || 0) + 1; return m; }, {} as Record<string, number>);
  const inp = { fontSize: 12, padding: '4px 8px', width: '100%', marginBottom: 4 } as const;

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ maxWidth: 600 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div className="h2" style={{ fontSize: 18, color: COLOR }}>Forestieri</div>
            <div className="small muted" style={{ fontSize: 11, marginTop: 2 }}>
              {cards.length === 0 ? 'Nessuna carta ancora.' : (['mazzo', 'porta', 'accolto', 'respinto'] as CardStatus[]).filter(k => counts[k]).map(k => `${counts[k]} ${STATUS[k].label.toLowerCase()}`).join(' · ')}
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 16, padding: '2px 8px' }} onClick={onClose}>✕</button>
        </div>
        <div className="small muted" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>
          Quando il tiro degli abitanti dà fra 10 e 12, una carta del mazzo si presenta alla porta. Alla porta i giocatori vedono ritratto, ruolo, tratto e lore visibile; accolta, la carta diventa un PNG alleato di Olmobianco, e la lore nascosta lo segue come frammenti da svelare.
        </div>

        {cards.map(c => {
          const st = cardStatus(s, c.id);
          const open = openId === c.id;
          const locked = st === 'accolto';
          const apts: Aptitude[] = c.aptitudes || [];
          const setApts = (list: Aptitude[]) => patchCard(c.id, { aptitudes: list });
          const freeAct = acts.find(a => !apts.some(x => x.activityId === a.id));
          return (
            <div key={c.id} className="card" style={{ padding: '10px 12px' }}>
              <div className="row" style={{ gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpenId(open ? null : c.id)}>
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-sec)' }}>
                  <ImageSlot slotId={'png-' + c.id} campaignId={campaignId} shape="circle" width={44} height={44} dmMode={false}
                    placeholder={(c.name || '?').slice(0, 2).toUpperCase()} alt={c.name} objectPosition={`center ${c.imgPos ?? 50}%`} />
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>{c.name}</span>
                    {c.role && <span className="small muted" style={{ fontSize: 10.5 }}>{c.role}</span>}
                  </div>
                  {c.trait && <div className="small" style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-card)' }}>{c.trait}</div>}
                </div>
                <span className="pill" style={{ padding: '2px 8px', fontSize: 8, color: STATUS[st].color, borderColor: STATUS[st].color, flexShrink: 0 }}>{STATUS[st].label}</span>
                <span className="small muted" style={{ fontSize: 13 }}>{open ? '▾' : '▸'}</span>
              </div>

              {open && locked && (
                <div className="small muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
                  Accolto a Olmobianco: ora è un PNG del registro, e si modifica dalla sezione PNG, dove se ne sveleranno anche i frammenti nascosti.
                </div>
              )}

              {open && !locked && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  {/* Ritratto, caricabile qui: è lo stesso slot che userà il PNG */}
                  <div className="row" style={{ gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ width: 120, flexShrink: 0 }}>
                      <ImageSlot slotId={'png-' + c.id} campaignId={campaignId} shape="rounded" width={120} height={120} dmMode
                        placeholder="📷 Ritratto" alt={c.name} objectPosition={`center ${c.imgPos ?? 50}%`} />
                      <input type="range" min={0} max={100} value={c.imgPos ?? 50} title="Inquadratura del ritratto"
                        onChange={e => patchCard(c.id, { imgPos: parseInt(e.target.value) })} style={{ width: '100%', marginTop: 4 }} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <input value={c.name} onChange={e => patchCard(c.id, { name: e.target.value })} placeholder="Nome"
                        style={{ ...inp, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--gold)' }} />
                      <input value={c.role || ''} onChange={e => patchCard(c.id, { role: e.target.value })} placeholder="Ruolo (es. vedova di un barcaiolo)" style={inp} />
                      <input value={c.trait || ''} onChange={e => patchCard(c.id, { trait: e.target.value })} placeholder="Tratto visibile (es. «conta ogni cosa due volte»)" style={inp} />
                    </div>
                  </div>

                  <div className="label" style={{ fontSize: 8, marginBottom: 3 }}>Lore visibile</div>
                  <textarea value={c.lore || ''} onChange={e => patchCard(c.id, { lore: e.target.value })}
                    placeholder="Ciò che i giocatori leggono alla porta, e che resterà nella scheda del PNG…" style={{ fontSize: 12, padding: '6px 8px', minHeight: 64, width: '100%' }} />

                  <div className="label" style={{ fontSize: 8, margin: '8px 0 0' }}>Lore nascosta</div>
                  <RevealsEditor list={c.secrets} onChange={l => patchCard(c.id, { secrets: l.map(f => ({ ...f, revealed: false })) })} accent={COLOR} />

                  <div className="label" style={{ fontSize: 8, margin: '8px 0 4px' }}>Bonus e malus per attività</div>
                  {apts.map((a, i) => (
                    <div key={i} className="row" style={{ gap: 5, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <select value={a.activityId} onChange={e => setApts(apts.map((x, k) => k === i ? { ...x, activityId: e.target.value } : x))} style={{ fontSize: 11, padding: '3px 4px', flex: '0 1 120px' }}>
                        {acts.filter(o => o.id === a.activityId || !apts.some(x => x.activityId === o.id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        {!acts.some(o => o.id === a.activityId) && <option value={a.activityId}>(attività rimossa)</option>}
                      </select>
                      <input value={a.text || ''} placeholder="Che cosa porta, in parole" onChange={e => setApts(apts.map((x, k) => k === i ? { ...x, text: e.target.value } : x))} style={{ fontSize: 11, padding: '3px 6px', flex: '1 1 130px' }} />
                      <input type="number" value={a.mod ?? 0} title="Positivo è un bonus, negativo un malus" onChange={e => setApts(apts.map((x, k) => k === i ? { ...x, mod: parseInt(e.target.value) || 0 } : x))} style={{ fontSize: 11, padding: '3px 4px', width: 50, textAlign: 'center' }} />
                      <button className="btn btn-danger btn-ghost" style={{ padding: '1px 7px', fontSize: 10 }} onClick={() => setApts(apts.filter((_, k) => k !== i))}>&times;</button>
                    </div>
                  ))}
                  {freeAct && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 9 }} onClick={() => setApts([...apts, { activityId: freeAct.id, text: '', mod: 0 }])}>+ bonus o malus</button>}

                  <div className="row" style={{ gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    {st === 'mazzo' && <button className="btn btn-gold" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => callIn(c.id)}>Fai arrivare alla porta</button>}
                    {(st === 'porta' || st === 'respinto') && <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => sendBack(c.id)}>Rimetti nel mazzo</button>}
                    <div className="grow" />
                    <button className="btn btn-danger btn-ghost" style={{ fontSize: 9, padding: '2px 8px' }} onClick={() => delCard(c)}>Elimina</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <input className="grow" placeholder="Nuovo forestiero…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCard(); }} />
          <button className="btn btn-gold" onClick={addCard}>+</button>
        </div>
      </div>
    </div>
  );
}
