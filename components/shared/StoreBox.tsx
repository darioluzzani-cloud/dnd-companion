'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { PanelBox, panelPos } from '@/components/shared/PanelBox';
import { NumberInput } from '@/components/shared/textUtils';
import { armoryByName, itemFromArmory, cloneImage, normName } from '@/lib/dnd/catalog';
import { popOf, ledgerOf, weeklyYields } from '@/lib/dnd/village';
import {
  qtyOf, stockList, tallyOf, addTo, rationEntry, rationPct, leavePct, weeklyNeed, hungerLabel,
} from '@/lib/dnd/storehouse';

// ─── MAGAZZINO ───────────────────────────────────────────────
// Le scorte comuni di Olmobianco: oggetti d'armeria, ciascuno con la sua
// illustrazione e la sua quantità. Le attività del villaggio vi depositano
// ciò che rendono a ogni mercato; i personaggi prelevano e ripongono, uno o
// più pezzi alla volta; il villaggio, quando il consumo è attivo, vi mangia
// la propria quota di razioni.
//
// Chi preleva scrive soltanto il registro dei prelievi, mai quello delle
// rese: la giacenza è la differenza fra i due (si veda storehouse.ts).

const COLOR = 'var(--green)';

export function StoreBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  const list = stockList(s);
  const armory: any[] = (((s as any).armory || []) as any[]).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const p: any = s.players.find(pl => pl.id === s.activePlayer);

  const [sel, setSel] = useState<string | null>(null);   // voce aperta per il prelievo
  const [takeN, setTakeN] = useState(1);
  const [depId, setDepId] = useState('');                // oggetto dello zaino da riporre
  const [depN, setDepN] = useState(1);
  const [dmOpen, setDmOpen] = useState(false);
  const [adjId, setAdjId] = useState('');
  const [adjN, setAdjN] = useState(1);

  // ── Razioni ──
  const ration = rationEntry(s);
  const rationQty = ration ? qtyOf(s, ration.id) : 0;
  const pop = popOf(s);
  const pct = rationPct(s);
  const need = weeklyNeed(pop, pct);
  const hungerOn = !!(s as any).villageHunger;
  const hunger = ledgerOf(s).hunger;
  const alarm = hungerOn ? hungerLabel(hunger?.streak || 0) : null;
  const income = ration ? weeklyYields(s).filter(y => y.entry.id === ration.id).reduce((n, y) => n + y.qty, 0) : 0;
  const cover = need > 0 ? Math.min(100, Math.round((rationQty / need) * 100)) : 100;
  const weeks = need > 0 ? Math.floor(rationQty / need) : null;

  // ── Prelievo ──
  const selEntry = list.find(x => x.entry.id === sel) || null;
  const maxTake = selEntry?.qty || 0;
  const nTake = Math.max(1, Math.min(takeN, maxTake));
  const carried = (name: string) => (p?.inventory || []).filter((it: any) => normName(it.name) === normName(name)).reduce((n: number, it: any) => n + (it.qty || 0), 0);

  const withdraw = (entry: any, n: number) => {
    if (!p || n <= 0) return;
    // L'oggetto esce dal magazzino con la scheda d'armeria, non come voce nuda.
    const built = itemFromArmory(s, entry.name, n);
    const stackable = (it: any) => normName(it.name) === normName(entry.name) && !it.equipped && !(it.batches?.length);
    const already = (p.inventory || []).some(stackable);
    update(prev => {
      const take = Math.min(n, qtyOf(prev, entry.id));
      if (take <= 0) return {};
      const players = prev.players.map(pl => {
        if (pl.id !== p.id) return pl;
        const ex = pl.inventory.find(stackable);
        const inventory = ex
          ? pl.inventory.map((it: any) => it.id === ex.id ? { ...it, qty: (it.qty || 0) + take } : it)
          : [...pl.inventory, { ...built.item, qty: take }];
        return { ...pl, inventory };
      });
      return { players, villageDrawn: addTo(tallyOf(prev, 'villageDrawn'), entry.id, take) } as any;
    });
    if (!already) cloneImage(campaignId, built.sourceId, built.item.id);
    setTakeN(1);
  };

  // ── Deposito ──
  // Si ripone soltanto ciò che il magazzino sa contare: una voce nota
  // all'armeria, non indossata, senza lavori di fucina addosso e non
  // deperibile — un decotto datato perderebbe la sua scadenza in mezzo agli altri.
  const storable = (it: any) => !!armoryByName(s, it.name) && !it.equipped && !it.attuned
    && !(it.upgrades?.length) && !it.pu && !it.perishable && !(it.batches?.length) && (it.qty || 0) > 0;
  const mine: any[] = ((p?.inventory || []) as any[]).filter(storable);
  const depItem = mine.find(it => it.id === depId) || null;
  const nDep = Math.max(1, Math.min(depN, depItem?.qty || 1));

  const deposit = () => {
    if (!p || !depItem) return;
    const entry = armoryByName(s, depItem.name);
    if (!entry) return;
    update(prev => {
      const pl0: any = prev.players.find(pl => pl.id === p.id);
      const it0 = pl0?.inventory.find((it: any) => it.id === depItem.id);
      const give = Math.min(nDep, it0?.qty || 0);
      if (give <= 0) return {};
      const players = prev.players.map(pl => pl.id !== p.id ? pl : {
        ...pl,
        inventory: pl.inventory
          .map((it: any) => it.id === depItem.id ? { ...it, qty: (it.qty || 0) - give } : it)
          .filter((it: any) => !(it.id === depItem.id && (it.qty || 0) <= 0)),
      });
      return { players, villageDrawn: addTo(tallyOf(prev, 'villageDrawn'), entry.id, -give) } as any;
    });
    setDepId(''); setDepN(1);
  };

  // ── Strumenti del DM ──
  const adjust = (sign: 1 | -1) => {
    if (!adjId || adjN <= 0) return;
    update(prev => {
      const n = sign > 0 ? adjN : Math.min(adjN, qtyOf(prev, adjId));
      return n > 0 ? { villageStock: addTo(tallyOf(prev, 'villageStock'), adjId, sign * n) } as any : {};
    });
  };
  const oldRations = Math.max(0, Math.floor((s as any).baseRations || 0));
  const migrate = () => {
    if (!ration || oldRations <= 0) return;
    update(prev => {
      const n = Math.max(0, Math.floor((prev as any).baseRations || 0));
      return n > 0 ? { villageStock: addTo(tallyOf(prev, 'villageStock'), ration.id, n), baseRations: 0 } as any : {};
    });
  };
  const num = { width: 54, textAlign: 'center', fontSize: 11, padding: '2px 4px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4 } as const;
  const stepper = (value: number, max: number, set: (n: number) => void) => (
    <div className="row" style={{ gap: 5, alignItems: 'center', flexShrink: 0 }}>
      <button className="hp-btn hp-btn-neg" style={{ flex: 'none', padding: '3px 10px', opacity: value <= 1 ? .4 : 1 }} disabled={value <= 1} onClick={() => set(value - 1)}>−</button>
      <NumberInput value={value} min={1} max={Math.max(1, max)} onChange={set} style={{ ...num, width: 46, fontSize: 13, color: 'var(--gold)', fontWeight: 600 }} title="Quantità" />
      <button className="hp-btn hp-btn-pos" style={{ flex: 'none', padding: '3px 10px', opacity: value >= max ? .4 : 1 }} disabled={value >= max} onClick={() => set(value + 1)}>+</button>
      {max > 1 && value < max && <button className="btn btn-ghost" style={{ fontSize: 9, padding: '2px 8px' }} onClick={() => set(max)}>tutto ({max})</button>}
    </div>
  );

  return (
    <PanelBox title="Magazzino" color={COLOR} bgSlot="store-bg" campaignId={campaignId} dmMode={s.dmMode} {...panelPos(s, update, 'store-bg')}
      badge={<span className="pill" style={{ padding: '2px 8px', fontSize: 8.5, color: alarm ? 'var(--red)' : COLOR, borderColor: alarm ? 'var(--red)' : COLOR }}>{alarm ? alarm + ' · ' : ''}{rationQty} razioni</span>}
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLOR} strokeWidth="1.5"><path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/><path d="M9 21v-7h6v7"/></svg>}>

      {/* Il vecchio contatore, finché il DM non lo travasa */}
      {oldRations > 0 && (
        <div className="card" style={{ borderColor: 'var(--gold-dim)', padding: '9px 12px' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="small grow" style={{ fontSize: 11.5, color: 'var(--gold-dim)', lineHeight: 1.5 }}>
              {oldRations} razioni attendono ancora nel vecchio contatore del magazzino{s.dmMode ? (ration ? '.' : ': manca in armeria una voce per le razioni a cui travasarle.') : ': le travasa il DM.'}
            </span>
            {s.dmMode && ration && <button className="btn btn-gold" style={{ fontSize: 10, padding: '4px 12px', flexShrink: 0 }} onClick={migrate}>Porta in magazzino</button>}
          </div>
        </div>
      )}

      {/* Le razioni e il fabbisogno del villaggio */}
      {ration && (
        <div className="card" style={{ padding: '12px 14px', borderColor: alarm ? 'var(--red)' : undefined }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>{rationQty}</span>
              <span className="small muted">{ration.name}</span>
            </div>
            {alarm && <span className="pill" style={{ padding: '2px 9px', fontSize: 8.5, color: 'var(--red)', borderColor: 'var(--red)' }}>{alarm}</span>}
          </div>
          {hungerOn ? (
            <>
              <div style={{ height: 6, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 9 }}>
                <div style={{ height: '100%', width: cover + '%', background: cover >= 100 ? COLOR : cover >= 50 ? 'var(--gold-dim)' : 'var(--red)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
              <div className="small muted" style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.55 }}>
                Il villaggio ne consuma {need} a ogni mercato: il {pct}% dei suoi {pop} abitanti al giorno, per sei giorni.
                {' '}Le scorte coprono il {cover}% della prossima settimana{weeks !== null && weeks >= 1 ? `, e bastano per ${weeks === 1 ? 'una settimana' : weeks + ' settimane'}` : ''}.
                {income > 0 && <> Le attività ne rendono {income} a mercato{income >= need ? '' : `: ne mancano ${need - income} per pareggiare`}.</>}
              </div>
              {alarm === 'Penuria' && <div className="small" style={{ fontSize: 11, marginTop: 6, color: 'var(--red)', lineHeight: 1.5 }}>All'ultimo mercato le scorte non sono bastate. Se accadrà di nuovo, la gente comincerà a partire; intanto chi arriva non si ferma.</div>}
              {alarm === 'Carestia' && <div className="small" style={{ fontSize: 11, marginTop: 6, color: 'var(--red)', lineHeight: 1.5 }}>Le scorte mancano da più mercati: a ognuno una parte degli abitanti lascia il villaggio, finché la dispensa non torna a bastare.</div>}
            </>
          ) : (
            <div className="small muted" style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.5 }}>Per ora il villaggio non attinge a queste scorte.</div>
          )}
        </div>
      )}

      {/* Le scorte */}
      {list.length === 0 && <div className="card muted small" style={{ textAlign: 'center' }}>Il magazzino è vuoto.</div>}
      {list.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8, marginBottom: 10 }}>
          {list.map(({ entry, qty }) => {
            const on = sel === entry.id;
            return (
              <div key={entry.id} className="card" onClick={() => { setSel(on ? null : entry.id); setTakeN(1); }}
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', marginBottom: 0, borderColor: on ? COLOR : undefined }}>
                <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--bg-deep)' }}>
                  <ImageSlot slotId={'item-' + entry.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false}
                    placeholder={(entry.name || '?').slice(0, 2).toUpperCase()} alt={entry.name} />
                  <span style={{ position: 'absolute', bottom: 2, right: 5, fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000, 0 0 6px #000' }}>×{qty}</span>
                </div>
                <div style={{ padding: '5px 7px', fontSize: 11, lineHeight: 1.25, fontFamily: 'var(--font-display)', color: 'var(--text-card)' }}>{entry.name}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Prelievo dalla voce scelta */}
      {selEntry && (
        <div className="card" style={{ borderColor: COLOR, padding: '11px 13px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div className="h2" style={{ fontSize: 15 }}>{selEntry.entry.name}</div>
            <span className="small muted">{selEntry.qty} in magazzino</span>
          </div>
          {(selEntry.entry.effect || selEntry.entry.desc) && <div className="small muted" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.5 }}>{selEntry.entry.effect || selEntry.entry.desc}</div>}
          {p ? (
            <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              {stepper(nTake, maxTake, setTakeN)}
              <div className="grow" />
              <button className="btn btn-gold" style={{ fontSize: 10, padding: '5px 14px' }} onClick={() => withdraw(selEntry.entry, nTake)}>Preleva {nTake} per {p.short || p.name}</button>
            </div>
          ) : <div className="small muted" style={{ fontSize: 11, marginTop: 8 }}>Scegli un personaggio per prelevare.</div>}
          {p && <div className="small muted" style={{ fontSize: 10, marginTop: 6 }}>{p.short || p.name} ne porta {carried(selEntry.entry.name)}.</div>}
        </div>
      )}

      {/* Deposito dallo zaino */}
      {p && (
        <div className="card" style={{ padding: '11px 13px' }}>
          <div className="label" style={{ fontSize: 9, marginBottom: 7 }}>Riponi dallo zaino di {p.short || p.name}</div>
          {mine.length === 0
            ? <div className="small muted" style={{ fontSize: 11 }}>Nulla, nello zaino, che il magazzino possa prendere in carico.</div>
            : (
              <>
                <select value={depId} onChange={e => { setDepId(e.target.value); setDepN(1); }} style={{ fontSize: 12, width: '100%' }}>
                  <option value="">— scegli che cosa riporre —</option>
                  {mine.map(it => <option key={it.id} value={it.id}>{it.name} ×{it.qty}</option>)}
                </select>
                {depItem && (
                  <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 9, flexWrap: 'wrap' }}>
                    {stepper(nDep, depItem.qty || 1, setDepN)}
                    <div className="grow" />
                    <button className="btn btn-primary" style={{ fontSize: 10, padding: '5px 14px' }} onClick={deposit}>Riponi {nDep}</button>
                  </div>
                )}
              </>
            )}
        </div>
      )}

      {/* ── Strumenti del DM ── */}
      {s.dmMode && (
        <div className="card" style={{ padding: '10px 13px', borderStyle: 'dashed' }}>
          <div className="row" style={{ cursor: 'pointer', justifyContent: 'space-between' }} onClick={() => setDmOpen(!dmOpen)}>
            <div className="label" style={{ fontSize: 9 }}>Strumenti del DM</div>
            <span className="small muted">{dmOpen ? '▾' : '▸'}</span>
          </div>
          {dmOpen && (
            <div style={{ marginTop: 10 }}>
              {/* Consumo */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Consumo delle razioni</div>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <button className="pill" style={{ cursor: 'pointer', padding: '3px 10px', fontSize: 9, color: hungerOn ? COLOR : 'var(--gray-purple)', borderColor: hungerOn ? COLOR : 'var(--border)', background: hungerOn ? 'var(--bg-active)' : 'transparent' }}
                  onClick={() => update({ villageHunger: !hungerOn } as any)}>{hungerOn ? '◉ Consumo attivo' : '◯ Consumo spento'}</button>
                <span className="small muted" style={{ fontSize: 10 }}>quota</span>
                <NumberInput value={pct} min={0} max={100} onChange={n => update({ villageRationPct: n } as any)} style={num} title="Percentuale degli abitanti che mangia dal magazzino, al giorno" />
                <span className="small muted" style={{ fontSize: 10 }}>% · partenze</span>
                <NumberInput value={leavePct(s)} min={0} max={100} onChange={n => update({ villageLeavePct: n } as any)} style={num} title="Percentuale degli abitanti che parte a ogni mercato di carestia" />
                <span className="small muted" style={{ fontSize: 10 }}>%</span>
              </div>
              <select value={(s as any).villageRationId || ration?.id || ''} onChange={e => update({ villageRationId: e.target.value || undefined } as any)} style={{ fontSize: 11, width: '100%', marginBottom: 6 }} title="Voce d'armeria che vale come razione">
                {!ration && <option value="">Nessuna voce d'armeria per le razioni: scegline una…</option>}
                {armory.map(e => <option key={e.id} value={e.id}>Razione: {e.name}</option>)}
              </select>
              <div className="small muted" style={{ fontSize: 10, lineHeight: 1.55, marginBottom: 12 }}>
                A consumo attivo ogni mercato toglie {need} razioni. Il primo mercato scoperto è penuria; dal secondo consecutivo parte il {leavePct(s)}% degli abitanti a mercato.
                {hunger?.abs !== undefined && <> All'ultimo conto: {hunger.eaten} mangiate su {hunger.need} richieste.</>}
              </div>

              {/* Rettifica delle scorte */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Rettifica delle scorte</div>
              <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={adjId} onChange={e => setAdjId(e.target.value)} style={{ fontSize: 11, flex: '1 1 150px' }}>
                  <option value="">— voce d'armeria —</option>
                  {armory.map(e => <option key={e.id} value={e.id}>{e.name}{qtyOf(s, e.id) > 0 ? ` (${qtyOf(s, e.id)})` : ''}</option>)}
                </select>
                <NumberInput value={adjN} min={1} onChange={setAdjN} style={num} title="Quantità" />
                <button className="hp-btn hp-btn-pos" style={{ flex: 'none', padding: '3px 10px' }} disabled={!adjId} onClick={() => adjust(1)}>Aggiungi</button>
                <button className="hp-btn hp-btn-neg" style={{ flex: 'none', padding: '3px 10px' }} disabled={!adjId} onClick={() => adjust(-1)}>Togli</button>
              </div>
              <div className="small muted" style={{ fontSize: 10, lineHeight: 1.5, marginTop: 6 }}>Che cosa rende ogni bottega si dichiara nella sua scheda «Produzione settimanale»; le scorte di una singola voce si ritoccano anche dall'Armeria.</div>
            </div>
          )}
        </div>
      )}
    </PanelBox>
  );
}
