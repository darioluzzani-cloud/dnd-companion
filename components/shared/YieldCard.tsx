'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { NumberInput } from '@/components/shared/textUtils';
import { Product, activitiesOf, activityStatus, productsOf, yieldsOf, isKnown, postsOf, stepsOf, nextStep, WorkStep } from '@/lib/dnd/village';

// ─── PRODUZIONE SETTIMANALE ──────────────────────────────────
// Ciò che una bottega deposita in magazzino a ogni mercato, mostrato dentro
// il menù della bottega stessa: un riquadro per oggetto, con la sua
// illustrazione d'armeria e la quantità. Lo vedono tutti; in modalità DM gli
// stessi riquadri si scelgono, si correggono e si tolgono sul posto. La
// quantità che il DM dichiara è la resa di base. Gli adulti messi al lavoro
// nel riquadro «Gli abitanti» vi aggiungono pezzi soltanto al raggiungere
// delle soglie che il DM fissa oggetto per oggetto — «3 adulti → +1» — e
// che tutti leggono sotto il riquadro, con quelle già raggiunte in evidenza.
//
// Gli oggetti si pescano soltanto dall'armeria, e finiscono soltanto nel
// magazzino. La scheda è una sola per tutte le botteghe: compare nella
// fucina, nella conceria, nella taverna, nella biblioteca, e nella casella
// di ogni attività dentro «Gli abitanti» — che è il menù di quelle che un
// riquadro proprio non l'hanno, come i campi.

export function YieldCard({ s, update, campaignId, activityId, color }: {
  s: CampaignState; update: U; campaignId: string | null; activityId: string; color: string;
}) {
  const [addId, setAddId] = useState('');
  const act = activitiesOf(s).find(a => a.id === activityId);
  if (!act) return null;

  const st = activityStatus(s, act.id);
  const active = st.state === 'active';
  const ys = yieldsOf(s, act);
  // Ai giocatori una bottega che non rende nulla non mostra una scheda vuota.
  if (!s.dmMode && ys.length === 0) return null;

  const armory: any[] = (((s as any).armory || []) as any[]).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const inArmory = (id: string) => armory.some(e => e.id === id);
  // Il contributo di chi tiene la bottega si mostra soltanto quando è noto.
  const known = !!st.capo && (s.dmMode || isKnown(s, st.capo.id, act.id));

  // Ogni scrittura riparte dall'elenco più recente e lascia cadere le voci
  // che l'armeria non conosce più, che altrimenti resterebbero invisibili.
  const write = (fn: (list: Product[]) => Product[]) => update(prev => ({
    villageActivities: activitiesOf(prev).map(a => a.id === activityId
      ? { ...a, produces: fn(productsOf(a).filter(p => ((prev as any).armory || []).some((e: any) => e.id === p.armoryId))) }
      : a),
  } as any));
  const patch = (armoryId: string, p: Partial<Product>) => write(list => list.map(x => x.armoryId === armoryId ? { ...x, ...p } : x));
  const products = productsOf(act).filter(p => inArmory(p.armoryId));
  const free = armory.filter(e => !products.some(p => p.armoryId === e.id));
  const hasPosts = postsOf(s, act) > 0;
  // Il DM vede e scrive le soglie nell'ordine in cui le ha inserite: a
  // metterle in fila pensa la lettura (`stepsOf`), non la scrittura, così
  // una riga non cambia posto sotto le dita mentre se ne batte il numero.
  const rawSteps = (p: Product): WorkStep[] => (p.steps || []) as WorkStep[];
  const setStep = (p: Product, i: number, change: Partial<WorkStep>) =>
    patch(p.armoryId, { steps: rawSteps(p).map((x, k) => k === i ? { ...x, ...change } : x) });
  const num = { width: 44, textAlign: 'center', fontSize: 11, padding: '2px 3px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4 } as const;

  return (
    <div className="card" style={{ padding: '11px 13px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div className="label" style={{ fontSize: 9 }}>Produzione settimanale</div>
        <span className="small muted" style={{ fontSize: 10 }}>a ogni mercato, in magazzino</span>
      </div>

      {ys.length === 0 && <div className="small muted" style={{ fontSize: 11, marginBottom: s.dmMode ? 8 : 0 }}>Nulla, per ora.</div>}

      {ys.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ys.map(y => {
            const p = products.find(x => x.armoryId === y.entry.id);
            const shown = known ? y.qty : y.worked;
            return (
              <div key={y.entry.id} style={{ width: s.dmMode ? 118 : 92 }}>
                <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', border: '1px solid ' + color, background: 'var(--bg-deep)',
                  opacity: active ? 1 : .5, filter: active ? 'none' : 'grayscale(.7)' }}>
                  <ImageSlot slotId={'item-' + y.entry.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false}
                    placeholder={(y.entry.name || '?').slice(0, 2).toUpperCase()} alt={y.entry.name} />
                  <span style={{ position: 'absolute', bottom: 2, right: 5, fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000, 0 0 6px #000' }}>×{shown}</span>
                </div>
                <div style={{ fontSize: 10.5, lineHeight: 1.25, marginTop: 4, textAlign: 'center', fontFamily: 'var(--font-display)', color: 'var(--text-card)' }}>{y.entry.name}</div>
                {/* Come si arriva alla quantità: base, adulti al lavoro, capo. */}
                {(y.extra > 0 || (known && y.mod !== 0)) && (
                  <div className="small muted" style={{ fontSize: 9, textAlign: 'center', marginTop: 1 }}>
                    {y.base}{y.extra > 0 ? ` + ${y.extra}` : ''}{known && y.mod !== 0 ? ` ${y.mod > 0 ? '+' : '−'} ${Math.abs(y.mod)}` : ''}
                  </div>
                )}
                {/* Le soglie, per chi deve decidere dove mandare gli adulti:
                    quelle raggiunte in chiaro, la prossima in evidenza. */}
                {!s.dmMode && hasPosts && y.steps.length > 0 && (
                  <div style={{ marginTop: 3 }}>
                    {y.steps.map((st, i) => {
                      const got = st.adults <= y.workers, nxt = y.next === st;
                      return (
                        <div key={i} className="small" style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.45,
                          color: got ? 'var(--green)' : nxt ? 'var(--gold-dim)' : 'var(--gray-purple)', opacity: got || nxt ? 1 : .7 }}>
                          {got ? '✓ ' : ''}{st.adults} adulti → +{st.bonus}
                        </div>
                      );
                    })}
                  </div>
                )}
                {s.dmMode && p && (
                  <div style={{ marginTop: 5 }}>
                    <div className="row" style={{ gap: 3, alignItems: 'center', justifyContent: 'center' }}>
                      <NumberInput value={p.qty || 0} min={0} onChange={n => patch(p.armoryId, { qty: n })} style={num} title="Quantità a ogni mercato" />
                      <button className="btn btn-danger btn-ghost" style={{ fontSize: 10, padding: '1px 6px' }} title="Togli dalla produzione"
                        onClick={() => write(list => list.filter(x => x.armoryId !== p.armoryId))}>&times;</button>
                    </div>
                    {act.building !== 'none' && (
                      <label className="row" style={{ gap: 3, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 3 }} title="Moltiplica la quantità di base per il livello dell'edificio">
                        <input type="checkbox" checked={!!p.perLevel} onChange={e => patch(p.armoryId, { perLevel: e.target.checked || undefined })} />
                        <span className="small muted" style={{ fontSize: 9 }}>× livello</span>
                      </label>
                    )}
                    {/* Soglie di adulti: quanti ne servono, quanti pezzi in più rendono. */}
                    <div className="small muted" style={{ fontSize: 8.5, textAlign: 'center', marginTop: 6, letterSpacing: '.3px' }}>adulti → pezzi in più</div>
                    {rawSteps(p).map((st, i) => (
                      <div key={i} className="row" style={{ gap: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                        <NumberInput value={st.adults} min={1} onChange={n => setStep(p, i, { adults: n })} style={{ ...num, width: 34 }} title="Adulti al lavoro necessari" />
                        <span className="small muted" style={{ fontSize: 9 }}>→ +</span>
                        <NumberInput value={st.bonus} min={0} onChange={n => setStep(p, i, { bonus: n })} style={{ ...num, width: 34 }} title="Pezzi in più a questa soglia, in tutto" />
                        <button className="btn btn-danger btn-ghost" style={{ fontSize: 9, padding: '0 4px' }} title="Togli la soglia"
                          onClick={() => patch(p.armoryId, { steps: rawSteps(p).filter((_, k) => k !== i) })}>&times;</button>
                      </div>
                    ))}
                    <button className="btn btn-ghost" style={{ fontSize: 9, padding: '1px 6px', width: '100%', marginTop: 3 }}
                      title="Aggiunge una soglia che prosegue la scala delle precedenti"
                      onClick={() => patch(p.armoryId, { steps: [...rawSteps(p), nextStep(stepsOf(p))] })}>+ soglia</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!active && ys.length > 0 && (
        <div className="small muted" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.5 }}>La bottega è ferma: finché non riprende a lavorare, al magazzino non arriva nulla.</div>
      )}
      {active && ys.length > 0 && ys[0].workers > 0 && (
        <div className="small muted" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.5 }}>
          {ys[0].workers === 1 ? 'Un adulto al lavoro.' : `${ys[0].workers} adulti al lavoro.`}{' '}
          {ys.some(y => y.extra > 0) ? 'I pezzi delle soglie raggiunte sono già nel conto.' : ys.some(y => y.steps.length > 0) ? 'Nessuna soglia è ancora raggiunta.' : 'Qui gli adulti non aggiungono pezzi.'}
        </div>
      )}
      {active && ys.length > 0 && st.capo && !known && (
        <div className="small muted" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.5 }}>Chi la tiene può aggiungervi o togliervi qualcosa: si vedrà dopo una settimana di lavoro.</div>
      )}

      {/* Scelta dall'armeria — solo DM */}
      {s.dmMode && (
        <div className="row" style={{ gap: 6, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
          <select className="grow" value={addId} onChange={e => setAddId(e.target.value)} style={{ fontSize: 11 }}>
            <option value="">Aggiungi un oggetto dall'armeria…</option>
            {free.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button className="btn btn-gold" style={{ fontSize: 10, padding: '3px 10px' }} disabled={!addId}
            onClick={() => { write(list => [...list, { armoryId: addId, qty: 1 }]); setAddId(''); }}>+</button>
        </div>
      )}
    </div>
  );
}
