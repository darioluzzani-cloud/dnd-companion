'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { NumberInput } from '@/components/shared/textUtils';
import { Product, activitiesOf, activityStatus, productsOf, yieldsOf, isKnown, postsOf, perWorkerOf } from '@/lib/dnd/village';

// ─── PRODUZIONE SETTIMANALE ──────────────────────────────────
// Ciò che una bottega deposita in magazzino a ogni mercato, mostrato dentro
// il menù della bottega stessa: un riquadro per oggetto, con la sua
// illustrazione d'armeria e la quantità. Lo vedono tutti; in modalità DM gli
// stessi riquadri si scelgono, si correggono e si tolgono sul posto. La
// quantità che il DM dichiara è la resa di base; ogni adulto messo al lavoro
// nel riquadro «Gli abitanti» vi aggiunge un numero fisso di pezzi, che il
// DM fissa oggetto per oggetto e che tutti leggono sotto il riquadro.
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
              <div key={y.entry.id} style={{ width: 84 }}>
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
                {/* Quanto vale un adulto, per chi deve decidere dove mandarlo. */}
                {!s.dmMode && hasPosts && y.perWorker > 0 && (
                  <div className="small" style={{ fontSize: 9, textAlign: 'center', marginTop: 1, color: 'var(--gold-dim)' }}>+{y.perWorker} per adulto</div>
                )}
                {s.dmMode && p && (
                  <div style={{ marginTop: 5 }}>
                    <div className="row" style={{ gap: 3, alignItems: 'center', justifyContent: 'center' }}>
                      <NumberInput value={p.qty || 0} min={0} onChange={n => patch(p.armoryId, { qty: n })} style={num} title="Quantità a ogni mercato" />
                      <button className="btn btn-danger btn-ghost" style={{ fontSize: 10, padding: '1px 6px' }} title="Togli dalla produzione"
                        onClick={() => write(list => list.filter(x => x.armoryId !== p.armoryId))}>&times;</button>
                    </div>
                    <div className="row" style={{ gap: 3, alignItems: 'center', justifyContent: 'center', marginTop: 3 }} title="Pezzi che ogni adulto al lavoro aggiunge a questo oggetto">
                      <span className="small muted" style={{ fontSize: 9 }}>+</span>
                      <NumberInput value={perWorkerOf(p)} min={0} onChange={n => patch(p.armoryId, { perWorker: n })} style={{ ...num, width: 34 }} title="Pezzi per adulto" />
                      <span className="small muted" style={{ fontSize: 9 }}>/adulto</span>
                    </div>
                    {act.building !== 'none' && (
                      <label className="row" style={{ gap: 3, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 3 }} title="Moltiplica la quantità di base per il livello dell'edificio">
                        <input type="checkbox" checked={!!p.perLevel} onChange={e => patch(p.armoryId, { perLevel: e.target.checked || undefined })} />
                        <span className="small muted" style={{ fontSize: 9 }}>× livello</span>
                      </label>
                    )}
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
          {ys[0].workers === 1 ? 'Un adulto al lavoro: i suoi pezzi sono già nel conto.' : `${ys[0].workers} adulti al lavoro: i loro pezzi sono già nel conto.`}
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
