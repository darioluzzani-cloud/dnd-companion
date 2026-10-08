'use client';
import { useState, ReactNode } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { PanelBox, panelPos } from '@/components/shared/PanelBox';
import { NumberInput } from '@/components/shared/textUtils';
import { YieldCard } from '@/components/shared/YieldCard';
import { absDay, addDays, formatDateShort, DEFAULT_CALENDAR } from '@/lib/dnd/calendar';
import {
  HousingRow, VillageGateEntry, NOTABLE_MIN,
  popOf, ledgerOf, gateOf, residentIds, residentsOf, dismissedIds, deckOf,
  housingBuilding, housingRow, currentHousing, daysToGrowth,
  Activity, ActivityState, CapoSeat, ACT_BUILDERS,
  activitiesOf, assignOf, activityStatus, roleOf, withCapo,
  aptitudeOf, isKnown, daysToKnow, buildDiscount,
  agesOf, agePctOf, postsOf, workersOf, freeAdults, withWorkers, workerPctOf, productsOf,
} from '@/lib/dnd/village';

// ─── GLI ABITANTI ────────────────────────────────────────────
// Quanta gente vive a Olmobianco, chi bussa alla porta, e chi tiene le
// attività del villaggio: una casella per ciascuna, che i giocatori
// riempiono scegliendo fra i PNG marcati come residenti. Non c'è un elenco
// dei residenti a sé: chi può tenere una casella compare quando la si apre.
//
// Ai giocatori il tiro di crescita resta invisibile: vedono il numero
// salire e la capienza delle case. Dadi, fattore e conto alla rovescia
// stanno fra gli strumenti del DM.
//
// Gli abitanti si leggono in tre fasce — adulti, bambini, anziani — e gli
// adulti sono le braccia che i giocatori distribuiscono fra le attività,
// col selettore sotto chi le tiene, entro i posti di lavoro fissati dal DM.

/** Le tre figure delle fasce d'età: stessa mano, tre stature. */
const AGE_ICON: Record<string, (c: string) => ReactNode> = {
  adults: c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="5" r="2.6"/><path d="M12 8.5v7M7.5 11.5l4.5-2 4.5 2M12 15.5l-3 6M12 15.5l3 6"/></svg>,
  kids:   c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="10" r="2.3"/><path d="M12 13v4.5M8.8 15l3.2-1.4 3.2 1.4M12 17.5l-2 4M12 17.5l2 4"/></svg>,
  elders: c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="10.5" cy="5.5" r="2.5"/><path d="M10.5 8.5c0 3 1.5 4.5 1.5 7M8 12l3-1.8 3.5 2.3M12 15.5l-2.5 6M12 15.5l1.5 6M17.5 12.5v9"/></svg>,
};
const AGES: { k: 'adults' | 'kids' | 'elders'; label: string; color: string }[] = [
  { k: 'adults', label: 'Adulti',  color: 'var(--gold)' },
  { k: 'kids',   label: 'Bambini', color: 'var(--blue)' },
  { k: 'elders', label: 'Anziani', color: 'var(--gray-purple)' },
];

const COLOR = 'var(--purple-light)';
const STATE: Record<ActivityState, { label: string; color: string }> = {
  active:  { label: 'Attiva',        color: 'var(--green)' },
  idle:    { label: 'Senza capo',    color: 'var(--gold-dim)' },
  unbuilt: { label: 'Da costruire',  color: 'var(--gray-purple)' },
  low:     { label: 'Da potenziare', color: 'var(--gray-purple)' },
};

export function VillageBox({ s, update, campaignId, defaultOpen }: { s: CampaignState; update: U; campaignId: string | null; defaultOpen?: boolean }) {
  const pop = popOf(s);
  const house = currentHousing(s);
  const hb = housingBuilding(s);
  const led = ledgerOf(s);
  const gate = gateOf(s);
  const residents = residentsOf(s);
  const deck = deckOf(s);
  const [dmOpen, setDmOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);     // attività di cui si sta scegliendo il capo
  const [newAct, setNewAct] = useState('');
  const today = absDay((s.calendar || DEFAULT_CALENDAR).date);
  const acts = activitiesOf(s);
  const assign = assignOf(s);
  const ages = agesOf(s);
  const agePct = agePctOf(s);
  const workers = workersOf(s);
  const idle = freeAdults(s);
  // Gli adulti li spostano i giocatori: si riparte dallo stato più recente e
  // si scrive la sola chiave delle assegnazioni, già ricortata su posti e adulti.
  const setWorkers = (actId: string, n: number) => update(prev => ({ villageWorkers: withWorkers(prev, actId, n) } as any));

  /** Selettore degli adulti al lavoro in un'attività. */
  const workerStepper = (act: Activity, big?: boolean) => {
    const posts = postsOf(s, act);
    const n = workers[act.id] || 0;
    const canAdd = n < posts && idle > 0;
    const pad = big ? '4px 13px' : '1px 8px';
    return (
      <div className="row" style={{ gap: big ? 8 : 4, alignItems: 'center', justifyContent: big ? 'flex-start' : 'space-between' }} onClick={e => e.stopPropagation()}>
        <button className="hp-btn hp-btn-neg" style={{ flex: 'none', padding: pad, opacity: n > 0 ? 1 : .35 }} disabled={n <= 0}
          title="Togli un adulto" onClick={() => setWorkers(act.id, n - 1)}>−</button>
        <span title={`${n} adulti al lavoro su ${posts} posti`} style={{ fontFamily: 'var(--font-display)', fontSize: big ? 17 : 12, fontWeight: 700, color: n > 0 ? 'var(--gold)' : 'var(--gray-purple)', minWidth: big ? 56 : 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
          {n}<span style={{ fontWeight: 400, fontSize: big ? 12 : 10, color: 'var(--gray-purple)' }}> / {posts}</span>
        </span>
        <button className="hp-btn hp-btn-pos" style={{ flex: 'none', padding: pad, opacity: canAdd ? 1 : .35 }} disabled={!canAdd}
          title={n >= posts ? 'Tutti i posti sono occupati' : idle <= 0 ? 'Nessun adulto libero' : 'Aggiungi un adulto'} onClick={() => setWorkers(act.id, n + 1)}>+</button>
      </div>
    );
  };

  const pct = house.cap > 0 ? Math.min(100, Math.round((pop / house.cap) * 100)) : 0;
  const full = house.found && house.cap > 0 && pop >= house.cap;

  // ── La porta: integrare o respingere ──
  // Si riparte sempre dallo stato più recente, perché nel frattempo il
  // calendario può aver fatto arrivare qualcun altro.
  const leaveGate = (list: VillageGateEntry[], id: string) => list.filter(g => g.npcId !== id);
  const integrate = (id: string) => update(prev => ({
    villageGate: leaveGate(gateOf(prev), id),
    villageResidents: [...residentIds(prev).filter(x => x !== id), id],
  } as any));
  const reject = (id: string, name: string) => {
    if (!confirm(`Respingere ${name}? Riprenderà la strada e non si ripresenterà.`)) return;
    update(prev => ({
      villageGate: leaveGate(gateOf(prev), id),
      villageDismissed: [...dismissedIds(prev).filter(x => x !== id), id],
    } as any));
  };

  const person = (npc: any, sub?: string) => (
    <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
      <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-sec)' }}>
        <ImageSlot slotId={'png-' + npc.id} campaignId={campaignId} shape="circle" width={44} height={44} dmMode={false}
          placeholder={(npc.name || '?').slice(0, 2).toUpperCase()} alt={npc.name} objectPosition={`center ${npc.imgPos ?? 50}%`} />
      </div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>{npc.name}</span>
          {sub && <span className="small muted" style={{ fontSize: 10.5 }}>{sub}</span>}
        </div>
        {npc.trait && <div className="small" style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--text-card)', lineHeight: 1.4 }}>{npc.trait}</div>}
      </div>
    </div>
  );

  // ── Le caselle dei capi ──
  const setCapo = (actId: string, npcId: string | null) =>
    update(prev => ({ villageAssign: withCapo(assignOf(prev), actId, npcId, today) } as any));

  /** Bonus o malus di una persona in un'attività, per quanto se ne sa. */
  const aptLine = (npc: any, actId: string, seat?: CapoSeat, working?: boolean) => {
    const apt = aptitudeOf(npc, actId);
    const full = (hidden?: boolean) => (
      <span className="small" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
        {apt
          ? <>{apt.text}{apt.mod ? <b style={{ marginLeft: 6, color: apt.mod > 0 ? 'var(--green)' : 'var(--red)' }}>{apt.mod > 0 ? '+' : '−'}{Math.abs(apt.mod)}</b> : null}</>
          : <span className="muted">Né bonus né malus.</span>}
        {hidden && <span className="muted" style={{ fontSize: 9.5 }}> · celato ai giocatori</span>}
      </span>
    );
    if (isKnown(s, npc.id, actId)) return full();
    if (s.dmMode) return full(true);
    if (!seat) return <span className="small muted" style={{ fontSize: 11 }}>Bonus e malus: da scoprire al lavoro.</span>;
    if (!working) return <span className="small muted" style={{ fontSize: 11 }}>La settimana di lavoro non decorre finché l'attività è ferma.</span>;
    const left = daysToKnow(seat, today);
    return <span className="small muted" style={{ fontSize: 11 }}>Bonus e malus si vedranno {left <= 1 ? 'fra un giorno' : `fra ${left} giorni`} di lavoro.</span>;
  };

  const whyStopped = (actId: string): string => {
    const st = activityStatus(s, actId);
    if (st.state === 'unbuilt') return 'L\'edificio non esiste ancora: va costruito fra gli edifici di Olmobianco.';
    if (st.state === 'low') return `«${st.building?.name}» è al livello ${st.building?.level || 0}: serve il livello ${st.need}.`;
    if (st.state === 'idle') return 'Nessuno la tiene: finché la casella è vuota l\'attività resta ferma.';
    return '';
  };

  const tile = (act: Activity) => {
    const st = activityStatus(s, act.id);
    const meta = STATE[st.state];
    const sel = pick === act.id;
    return (
      <div key={act.id} className="card" onClick={() => setPick(sel ? null : act.id)}
        style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', marginBottom: 0, borderColor: sel ? COLOR : st.state === 'active' ? 'var(--green)' : undefined }}>
        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--bg-deep)' }}>
          {st.capo ? (
            <ImageSlot slotId={'png-' + st.capo.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false}
              placeholder={(st.capo.name || '?').slice(0, 2).toUpperCase()} alt={st.capo.name} objectPosition={`center ${st.capo.imgPos ?? 50}%`} />
          ) : (
            <div style={{ position: 'absolute', inset: 8, border: '1px dashed var(--border-sec)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: 'var(--gray-purple)', opacity: .55 }}>+</div>
          )}
          <span className="pill" style={{ position: 'absolute', top: 6, left: 6, padding: '2px 7px', fontSize: 7.5, color: meta.color, borderColor: meta.color, background: 'rgba(11,8,20,.78)' }}>{meta.label}</span>
        </div>
        <div style={{ padding: '7px 9px' }}>
          <div className="h2" style={{ fontSize: 13, lineHeight: 1.25 }}>{act.name}</div>
          <div className="small" style={{ fontSize: 11, marginTop: 1, color: st.capo ? 'var(--gold-dim)' : 'var(--gray-purple)' }}>{st.capo ? st.capo.name : 'Casella vuota'}</div>
          {/* Adulti al lavoro, sotto chi tiene l'attività */}
          {postsOf(s, act) > 0 && <div style={{ marginTop: 6 }}>{workerStepper(act)}</div>}
        </div>
      </div>
    );
  };

  /** Scheda dell'attività scelta: stato, capo, e l'elenco di chi può tenerla. */
  const seatPanel = (act: Activity) => {
    const st = activityStatus(s, act.id);
    const disc = act.id === ACT_BUILDERS ? buildDiscount(s) : null;
    return (
      <div className="card" style={{ borderColor: COLOR, padding: '11px 13px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div className="h2" style={{ fontSize: 15 }}>{act.name}</div>
          <span className="pill" style={{ padding: '2px 8px', fontSize: 8, color: STATE[st.state].color, borderColor: STATE[st.state].color }}>{STATE[st.state].label}</span>
        </div>
        {st.state !== 'active' && <div className="small muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{whyStopped(act.id)}</div>}
        {/* Lo sconto esatto tradirebbe il modificatore del capomastro prima
            del tempo: ai giocatori, finché non è noto, si dice quello di base. */}
        {disc && st.capo && st.state === 'active' && (
          (s.dmMode || isKnown(s, st.capo.id, act.id))
            ? (disc.pct !== 0 && <div className="small" style={{ fontSize: 11, marginTop: 4, color: 'var(--text-card)' }}>I cantieri avviati da ora durano il {Math.abs(disc.pct)}% in {disc.pct > 0 ? 'meno' : 'più'}.</div>)
            : <div className="small" style={{ fontSize: 11, marginTop: 4, color: 'var(--text-card)' }}>I cantieri avviati da ora durano circa il {act.buildPct ?? 20}% in meno; quanto vi aggiunga o tolga chi li guida si vedrà col lavoro.</div>
        )}

        {st.capo && (
          <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
            {person(st.capo, st.capo.role || undefined)}
            <div style={{ marginTop: 6 }}>{aptLine(st.capo, act.id, st.seat, st.state === 'active')}</div>
          </div>
        )}

        {/* Adulti al lavoro */}
        {(() => {
          const posts = postsOf(s, act);
          const n = workers[act.id] || 0;
          const wp = workerPctOf(act);
          const makes = productsOf(act).length > 0;
          // Livelli di cui il DM fissa i posti: uno solo per le attività
          // senza edificio, altrimenti dal livello richiesto al massimo.
          const levels: number[] = act.building === 'none' ? [1]
            : Array.from({ length: Math.max(st.building ? Math.max(st.building.maxLevel || 0, st.building.level || 0) : 4, st.need) - st.need + 1 }, (_, i) => st.need + i);
          const curLevel = act.building === 'none' ? 1 : (st.building?.level ?? -1);
          const setPost = (lv: number, v: number) => {
            const list = [...(act.posts || [])];
            for (let i = 0; i <= lv; i++) if (typeof list[i] !== 'number') list[i] = 0;
            list[lv] = Math.max(0, v);
            patchAct(act.id, { posts: list });
          };
          if (posts <= 0 && !s.dmMode) return null;
          return (
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <div className="label" style={{ fontSize: 8 }}>Adulti al lavoro</div>
                <span className="small muted" style={{ fontSize: 10 }}>{idle} {idle === 1 ? 'adulto libero' : 'adulti liberi'} in paese</span>
              </div>
              {posts > 0 ? (
                <>
                  {workerStepper(act, true)}
                  <div className="small muted" style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.5 }}>
                    {makes
                      ? (n > 0
                          ? <>Ogni adulto aggiunge il {wp}% alla resa di base: ora <b style={{ color: 'var(--green)' }}>+{n * wp}%</b>.</>
                          : <>Ogni adulto messo al lavoro qui aggiunge il {wp}% alla resa di base.</>)
                      : <>Quest'attività non deposita nulla in magazzino: per ora gli adulti che vi lavorano non cambiano alcun conto.</>}
                    {st.state !== 'active' && n > 0 && <> Finché l'attività è ferma, però, non rende nulla.</>}
                  </div>
                </>
              ) : (
                <div className="small muted" style={{ fontSize: 11 }}>{st.state === 'unbuilt' || st.state === 'low' ? 'Nessun posto finché l\'edificio non è al livello richiesto.' : 'Nessun posto di lavoro a questo livello: fissane il numero qui sotto.'}</div>
              )}
              {s.dmMode && (
                <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <span className="small muted" style={{ fontSize: 10 }}>Posti</span>
                  {levels.map(lv => (
                    <div key={lv} className="row" style={{ gap: 3, alignItems: 'center' }}>
                      {act.building !== 'none' && <span className="small" style={{ fontSize: 10, color: lv === curLevel ? 'var(--gold)' : 'var(--gray-purple)', fontWeight: lv === curLevel ? 600 : 400 }}>liv. {lv}</span>}
                      <NumberInput value={act.posts?.[lv] || 0} min={0} onChange={v => setPost(lv, v)} style={{ ...num, width: 44 }} title={act.building === 'none' ? 'Posti di lavoro' : `Posti di lavoro al livello ${lv}`} />
                    </div>
                  ))}
                  <span className="small muted" style={{ fontSize: 10, marginLeft: 4 }}>ogni adulto +</span>
                  <NumberInput value={wp} min={0} onChange={v => patchAct(act.id, { workerPct: v })} style={{ ...num, width: 44 }} title="Punti percentuali che ogni adulto aggiunge alla resa di base" />
                  <span className="small muted" style={{ fontSize: 10 }}>%</span>
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
          <div className="label" style={{ fontSize: 8, marginBottom: 6 }}>{st.capo ? 'Affida ad altri' : 'A chi affidarla'}</div>
          {residents.length === 0 && <div className="small muted" style={{ fontSize: 11 }}>Nessun PNG è ancora marcato come residente di Olmobianco: lo si fa dalla sua scheda, nella sezione «Villaggio».</div>}
          {residents.filter((npc: any) => npc.id !== st.capo?.id).map((npc: any) => {
            const cur = roleOf(assign, npc.id);
            const curName = acts.find(a => a.id === cur)?.name;
            return (
              <div key={npc.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '5px 0' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  {person(npc, curName ? `ora: ${curName}` : 'senza incarico')}
                  {(isKnown(s, npc.id, act.id) || s.dmMode) && <div style={{ marginLeft: 54, marginTop: 2 }}>{aptLine(npc, act.id)}</div>}
                </div>
                <button className="btn" style={{ fontSize: 9, padding: '4px 10px', flexShrink: 0 }} onClick={() => setCapo(act.id, npc.id)}>Affida</button>
              </div>
            );
          })}
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {st.capo && <button className="btn btn-ghost" style={{ fontSize: 9, padding: '3px 10px' }} onClick={() => setCapo(act.id, null)}>Libera la casella</button>}
            <button className="btn btn-ghost" style={{ fontSize: 9, padding: '3px 10px', marginLeft: 'auto' }} onClick={() => setPick(null)}>Chiudi</button>
          </div>
        </div>
      </div>
    );
  };
  const picked = acts.find(a => a.id === pick);
  const activeCount = acts.filter(a => activityStatus(s, a.id).state === 'active').length;

  // ── Strumenti del DM ──
  const setActs = (list: Activity[]) => update({ villageActivities: list } as any);
  const patchAct = (id: string, p: Partial<Activity>) => setActs(acts.map(a => a.id === id ? { ...a, ...p } : a));
  const setPop = (n: number) => update({ villagePop: Math.max(0, Math.floor(n || 0)) } as any);
  const setRow = (lv: number, p: Partial<HousingRow>) => update(prev => {
    const list = [...(((prev as any).villageHousing || []) as HousingRow[])];
    for (let i = 0; i <= lv; i++) if (!list[i]) list[i] = housingRow(prev, i);   // consolida i valori di partenza
    list[lv] = { ...list[lv], ...p };
    return { villageHousing: list } as any;
  });
  const callIn = (id: string) => {
    update(prev => ({ villageGate: [...leaveGate(gateOf(prev), id), { npcId: id, sinceAbs: today }] } as any));
  };
  const recall = (id: string) => update(prev => ({ villageDismissed: dismissedIds(prev).filter(x => x !== id) } as any));
  const dismissed = dismissedIds(s).map(id => s.characters.find(c => c.id === id)).filter(Boolean) as any[];
  const lastLevel = Math.max(hb?.maxLevel || 0, house.level);
  const dateOf = (abs: number) => formatDateShort(addDays({ year: 0, month: 1, day: 1 }, abs)).replace(/ · .*$/, '');
  const num = { width: 58, textAlign: 'center', fontSize: 11, padding: '2px 4px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4 } as const;

  return (
    <PanelBox title="Gli abitanti" color={COLOR} bgSlot="people-bg" campaignId={campaignId} dmMode={s.dmMode} defaultOpen={defaultOpen} {...panelPos(s, update, 'people-bg')}
      badge={<span className="pill" style={{ padding: '2px 8px', fontSize: 8.5, color: COLOR, borderColor: COLOR }}>{pop} abitanti{gate.length > 0 ? ' · ' + gate.length + ' alla porta' : ''}</span>}
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLOR} strokeWidth="1.5"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.3c3 .2 5.5 2.6 5.5 5.7"/></svg>}>

      {/* Indicatore della popolazione */}
      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>{pop}</span>
            <span className="small muted">abitanti a Olmobianco</span>
          </div>
          {house.found && house.cap > 0 && (
            <span className="small" style={{ color: full ? 'var(--gold-dim)' : 'var(--gray-purple)' }}>
              {full ? 'case piene' : `tetti per ${house.cap}`}
            </span>
          )}
        </div>
        {house.found && house.cap > 0 && (
          <div style={{ height: 6, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 9 }}>
            <div style={{ height: '100%', width: pct + '%', background: full ? 'var(--gold-dim)' : COLOR, borderRadius: 3, transition: 'width .4s' }} />
          </div>
        )}
        {full && <div className="small muted" style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.5 }}>Finché le case non vengono ampliate, chi arriva non trova dove fermarsi.</div>}

        {/* Le tre fasce d'età */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)' }}>
          {AGES.map(a => (
            <div key={a.k} className="row" style={{ gap: 7, alignItems: 'center', minWidth: 0 }} title={`${a.label}: ${agePct[a.k]}% degli abitanti`}>
              <span style={{ flexShrink: 0, display: 'flex' }}>{AGE_ICON[a.k](a.color)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: a.color, lineHeight: 1.1 }}>{ages[a.k]}</div>
                <div className="small muted" style={{ fontSize: 9.5, letterSpacing: '.4px' }}>{a.label}</div>
              </div>
            </div>
          ))}
        </div>
        {pop > 0 && (
          <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 9 }}>
            {AGES.map(a => <div key={a.k} style={{ width: (ages[a.k] / pop * 100) + '%', background: a.color, opacity: a.k === 'adults' ? 1 : .7 }} />)}
          </div>
        )}
        <div className="small muted" style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.5 }}>
          Degli adulti, {ages.adults - idle} {ages.adults - idle === 1 ? 'lavora' : 'lavorano'} nelle attività e {idle} {idle === 1 ? 'è libero' : 'sono liberi'}.
        </div>
      </div>

      {/* La porta del villaggio */}
      {gate.map(g => {
        const npc: any = s.characters.find(c => c.id === g.npcId);
        if (!npc) return null;
        return (
          <div key={g.npcId} className="card" style={{ borderColor: COLOR, padding: '11px 13px' }}>
            <div className="label" style={{ fontSize: 9, color: COLOR, marginBottom: 8 }}>Alla porta del villaggio</div>
            {person(npc, npc.role || undefined)}
            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn btn-gold" style={{ fontSize: 10, padding: '4px 14px' }} onClick={() => integrate(npc.id)}>Integra</button>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 14px' }} onClick={() => reject(npc.id, npc.name)}>Respingi</button>
            </div>
          </div>
        );
      })}

      {/* Le attività e chi le tiene */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0 7px' }}>
        <div className="label" style={{ fontSize: 9 }}>Attività del villaggio</div>
        <span className="small muted" style={{ fontSize: 10 }}>{activeCount} attive su {acts.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 9, marginBottom: 10 }}>
        {acts.map(tile)}
      </div>
      {picked && <>
        {seatPanel(picked)}
        {/* Per le attività senza un riquadro proprio — i campi, l'erboristeria,
            la cappella — è questa la scheda in cui si vede e si decide che cosa rendono. */}
        <YieldCard s={s} update={update} campaignId={campaignId} activityId={picked.id} color={COLOR} />
      </>}

      {/* ── Strumenti del DM ── */}
      {s.dmMode && (
        <div className="card" style={{ padding: '10px 13px', borderStyle: 'dashed' }}>
          <div className="row" style={{ cursor: 'pointer', justifyContent: 'space-between' }} onClick={() => setDmOpen(!dmOpen)}>
            <div className="label" style={{ fontSize: 9 }}>Strumenti del DM</div>
            <span className="small muted">{dmOpen ? '▾' : '▸'}</span>
          </div>
          {dmOpen && (
            <div style={{ marginTop: 10 }}>
              {/* Popolazione */}
              <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span className="small grow">Abitanti</span>
                <button className="hp-btn hp-btn-neg" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop - 10)}>-10</button>
                <button className="hp-btn hp-btn-neg" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop - 1)}>-1</button>
                <NumberInput value={pop} min={0} onChange={setPop} style={{ ...num, width: 64, fontSize: 13, color: 'var(--gold)', fontWeight: 600 }} title="Abitanti" />
                <button className="hp-btn hp-btn-pos" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop + 1)}>+1</button>
                <button className="hp-btn hp-btn-pos" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop + 10)}>+10</button>
              </div>
              <div className="small muted" style={{ fontSize: 10, lineHeight: 1.55, marginBottom: 12 }}>
                {led.last
                  ? <>Ultimo tiro, {dateOf(led.last.abs)}: {led.last.dice.join(' · ')} = {led.last.dice.reduce((a, b) => a + b, 0)}{led.last.mult > 1 ? ' × ' + led.last.mult : ''} → +{led.last.gained}. </>
                  : <>Nessun tiro ancora. </>}
                Il prossimo cade fra {daysToGrowth(today)} giorni: si tira un mercato sì e uno no.{' '}
                Con {NOTABLE_MIN}–12 sul tiro nudo si presenta un notabile del mazzo.
              </div>

              {/* Fasce d'età */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Fasce d'età</div>
              <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <span className="small muted" style={{ fontSize: 10 }}>adulti</span>
                <NumberInput value={agePct.adults} min={0} max={100} onChange={n => update({ villageAges: { adults: n, kids: Math.min(agePct.kids, 100 - n) } } as any)} style={{ ...num, width: 46 }} title="Quota degli adulti sugli abitanti" />
                <span className="small muted" style={{ fontSize: 10 }}>% · bambini</span>
                <NumberInput value={agePct.kids} min={0} max={100 - agePct.adults} onChange={n => update({ villageAges: { adults: agePct.adults, kids: n } } as any)} style={{ ...num, width: 46 }} title="Quota dei bambini sugli abitanti" />
                <span className="small muted" style={{ fontSize: 10 }}>% · anziani {agePct.elders}%, il resto</span>
              </div>

              {/* Case: capienza e fattore per livello */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Case: capienza e fattore del 3d4</div>
              <select value={(s as any).villageHousingId || hb?.id || ''} onChange={e => update({ villageHousingId: e.target.value || undefined } as any)} style={{ fontSize: 11, width: '100%', marginBottom: 6 }}>
                {!hb && <option value="">Nessun edificio delle case: scegline uno…</option>}
                {(((s as any).buildings || []) as any[]).map(b => <option key={b.id} value={b.id}>{b.name} — livello {b.level}</option>)}
              </select>
              {hb ? (
                <div style={{ marginBottom: 12 }}>
                  {Array.from({ length: lastLevel + 1 }).map((_, lv) => {
                    const row = housingRow(s, lv);
                    const cur = lv === house.level;
                    return (
                      <div key={lv} className="row" style={{ gap: 6, alignItems: 'center', padding: '2px 0' }}>
                        <span className="small" style={{ width: 62, fontSize: 11, color: cur ? 'var(--gold)' : 'var(--gray-purple)', fontWeight: cur ? 600 : 400 }}>Livello {lv}{cur ? ' ◂' : ''}</span>
                        <span className="small muted" style={{ fontSize: 10 }}>tetti</span>
                        <NumberInput value={row.cap} min={0} onChange={n => setRow(lv, { cap: n })} style={num} title={`Capienza al livello ${lv}`} />
                        <span className="small muted" style={{ fontSize: 10 }}>3d4 ×</span>
                        <NumberInput value={row.mult} min={0} onChange={n => setRow(lv, { mult: n })} style={{ ...num, width: 44 }} title={`Fattore di crescita al livello ${lv}`} />
                        <span className="small muted" style={{ fontSize: 10 }}>≈ {Math.round(7.5 * row.mult)} a tiro</span>
                      </div>
                    );
                  })}
                  <div className="small muted" style={{ fontSize: 10, lineHeight: 1.5, marginTop: 4 }}>Le righe seguono il livello massimo dell'edificio: alzandolo compaiono le successive.</div>
                </div>
              ) : (
                <div className="small muted" style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 12 }}>Senza un edificio delle case il tiro si fa comunque, ma non aggiunge nessuno.</div>
              )}

              {/* Catalogo delle attività */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Attività: edificio e livello richiesti</div>
              {acts.map(a => (
                <div key={a.id} className="row" style={{ gap: 5, alignItems: 'center', flexWrap: 'wrap', padding: '3px 0' }}>
                  <input value={a.name} onChange={e => patchAct(a.id, { name: e.target.value })}
                    style={{ flex: '1 1 104px', fontSize: 11, padding: '3px 6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--gold)', fontWeight: 600 }} />
                  <select value={a.building || ''} onChange={e => patchAct(a.id, { building: e.target.value || undefined })} style={{ flex: '1 1 120px', fontSize: 10.5 }} title="Edificio da cui l'attività dipende">
                    <option value="">Edificio: cercato per nome</option>
                    <option value="none">Nessun edificio richiesto</option>
                    {(((s as any).buildings || []) as any[]).map(b => <option key={b.id} value={b.id}>{b.name} (liv. {b.level})</option>)}
                  </select>
                  {a.building !== 'none' && <>
                    <span className="small muted" style={{ fontSize: 10 }}>liv.</span>
                    <NumberInput value={a.minLevel || 1} min={1} onChange={n => patchAct(a.id, { minLevel: n })} style={{ ...num, width: 38 }} title="Livello minimo dell'edificio" />
                  </>}
                  {a.id === ACT_BUILDERS && <>
                    <span className="small muted" style={{ fontSize: 10 }}>cantieri −</span>
                    <NumberInput value={a.buildPct ?? 20} min={0} max={75} onChange={n => patchAct(a.id, { buildPct: n })} style={{ ...num, width: 40 }} title="Punti percentuali tolti alla durata dei cantieri" />
                    <span className="small muted" style={{ fontSize: 10 }}>%</span>
                  </>}
                  <button className="btn btn-danger btn-ghost" style={{ fontSize: 10, padding: '1px 7px' }} onClick={() => { if (confirm(`Togliere «${a.name}» dalle attività?`)) setActs(acts.filter(x => x.id !== a.id)); }}>&times;</button>
                </div>
              ))}
              <div className="row" style={{ gap: 6, margin: '6px 0 12px' }}>
                <input className="grow" placeholder="Nuova attività…" value={newAct} onChange={e => setNewAct(e.target.value)} style={{ fontSize: 11 }} />
                <button className="btn btn-gold" style={{ fontSize: 10, padding: '3px 10px' }} disabled={!newAct.trim()}
                  onClick={() => { setActs([...acts, { id: uid('act'), name: newAct.trim() }]); setNewAct(''); }}>+</button>
              </div>

              {/* Mazzo */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Mazzo dei forestieri · {deck.length}</div>
              {deck.length === 0 && <div className="small muted" style={{ fontSize: 10, marginBottom: 6 }}>Vuoto. Una carta si prepara dalla scheda del PNG, nella sezione «Villaggio».</div>}
              {deck.map((npc: any) => (
                <div key={npc.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '2px 0' }}>
                  <span className="small grow">{npc.name}{npc.trait ? <span className="muted" style={{ fontSize: 10, fontStyle: 'italic' }}> · {npc.trait}</span> : <span className="muted" style={{ fontSize: 10 }}> · senza tratto</span>}</span>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '2px 8px', flexShrink: 0 }} onClick={() => callIn(npc.id)}>Fai arrivare</button>
                </div>
              ))}
              {dismissed.map((npc: any) => (
                <div key={npc.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '2px 0', opacity: .7 }}>
                  <span className="small grow">{npc.name} <span className="muted" style={{ fontSize: 10 }}>· ha avuto un rifiuto alla porta</span></span>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '2px 8px', flexShrink: 0 }} onClick={() => recall(npc.id)}>Rimetti nel mazzo</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PanelBox>
  );
}
