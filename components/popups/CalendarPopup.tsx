'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { sfxDice } from '@/lib/dnd/sounds';
import { sweepExpired } from '@/lib/dnd/perishables';
import { jobsOf, jobProgress, tavernBuilding, TAVERN_WEEKLY_DEFAULT } from '@/lib/dnd/crafting';
import { GOLD_NAME, normName } from '@/lib/dnd/catalog';
import { absDay, advanceMark, VelmoraDate } from '@/lib/dnd/calendar';
import { COND, DT, WEATHER_MAP, WEATHER_DETAILS, BIOMES, SEASONS, EFFECT_CATS, INTENSITY_COLORS } from '@/lib/dnd/weather';
import {
  CalendarState, DEFAULT_CALENDAR, MONTHS, addDays, seasonForMonth,
  formatDate, formatDateShort, festivityOn, isMarketDay, nextFestivities, rollDailyWeather,
  DAYS_PER_MONTH,
} from '@/lib/dnd/calendar';

// ─── BARRA DATA (topbar — visibile a tutti, tocco DM apre il popup) ──
export function CalendarBar({ s, onOpen }: { s: CampaignState; onOpen: () => void }) {
  const cal: CalendarState = s.calendar || DEFAULT_CALENDAR;
  const fest = festivityOn(cal.date);
  const w = cal.weatherKey ? COND[cal.weatherKey] : null;
  const wColor = w ? (w.i ? INTENSITY_COLORS[w.i] : 'var(--gray-purple)') : undefined;
  const inner = (
    <>
      <span style={{color:'var(--gold-dim)'}}>{formatDateShort(cal.date)}</span>
      {w && <span style={{color:wColor}}> · {w.n}</span>}
      {fest && <span style={{color:'var(--purple-light)'}}> · {fest.name}</span>}
      {!fest && isMarketDay(cal.date) && <span style={{color:'var(--green)'}}> · Mercato</span>}
    </>
  );
  if (!s.dmMode) return <div className="calendar-bar">{inner}</div>;
  return <button className="calendar-bar calendar-bar-btn" onClick={onOpen} title="Apri calendario">{inner}</button>;
}

// ─── POPUP: CALENDARIO & METEO (unificato) ──────────────────
export function CalendarPopup({ s, update, onClose }: { s: CampaignState; update: U; onClose: () => void }) {
  const cal: CalendarState = s.calendar || DEFAULT_CALENDAR;
  const fest = festivityOn(cal.date);
  const calSeason = seasonForMonth(cal.date.month);
  const w = cal.weatherKey ? COND[cal.weatherKey] : null;
  const wColor = w ? (w.i ? INTENSITY_COLORS[w.i] : 'var(--gray-purple)') : undefined;

  // ── Tab principale ──
  const [tab, setTab] = useState<'day'|'roll'|'effects'>('day');

  // ── Stato locale per il tiro manuale (tab "roll") ──
  const [rollBiome, setRollBiome] = useState(cal.biome || 'temperato');
  const [rollSeason, setRollSeason] = useState(calSeason);
  const [manualRoll, setManualRoll] = useState<number|null>(null);
  const [manualHitId, setManualHitId] = useState<string|null>(null);
  const [manualExpanded, setManualExpanded] = useState(false);

  // ── Stato locale per la tab "effects" ──
  const [catFilter, setCatFilter] = useState('all');
  const [intFilter, setIntFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // Riepilogo di ciò che è maturato mentre il tempo passava: preparati
  // guasti, cantieri conclusi, commesse pronte. Tre meccanismi diversi
  // dipendono ormai dall'avanzare della data, e vederli in un punto solo
  // evita di doverli cercare in tre riquadri della tab Base.
  const [night, setNight] = useState<{ lost: string[]; ready: string[]; income?: string } | null>(null);

  // Bozza dell'impostazione manuale. Giorno e anno restano testo finché non
  // si conferma: ogni cifra battuta produrrebbe altrimenti una data di
  // passaggio, e il calendario la tratterebbe come tempo trascorso davvero —
  // con rendita pagata e preparati scartati lungo la strada.
  const [draft, setDraft] = useState<{ day: string; month: number; year: string } | null>(null);

  const setCal = (next: CalendarState) => update({ calendar: next });

  /**
   * Ogni cambio di data scarta i preparati guasti da tutti gli inventari.
   * La spazzata vive qui perché il calendario è l'unico punto in cui il
   * tempo avanza davvero, e perché così c'è un solo scrittore: un decotto
   * non può sparire due volte da due dispositivi diversi. Ciò che viene
   * tolto viene detto, mai fatto svanire in silenzio.
   */
  const setCalAndSweep = (next: CalendarState) => {
    update(prev => {
      const { players, removed } = sweepExpired(prev.players, next.date);
      const lost = removed.map(r => `${r.name} ×${r.doses} — ${r.player}`);

      // Ciò che è giunto a termine: si annuncia, non si completa da sé. Il
      // ritiro resta un gesto di chi gioca, com'era già per i cantieri.
      const ready: string[] = [];
      const nameOf = (id: string) => prev.players.find(pl => pl.id === id)?.short || prev.players.find(pl => pl.id === id)?.name || '—';
      // Una campagna che non ha ancora salvato il calendario parte dalla
      // data mostrata a schermo, non da un riferimento mancante.
      const prevDate = prev.calendar?.date || cal.date;
      const wasDone = (start: number, days: number) => Math.max(0, absDay(prevDate) - start) >= days;
      const isDone = (start: number, days: number) => Math.max(0, absDay(next.date) - start) >= days;

      for (const j of jobsOf(prev, 'forge')) {
        if (!wasDone(j.startAbs, j.days) && isDone(j.startAbs, j.days))
          ready.push(`Fucina · ${j.itemName} (${j.upgradeName}) — ${nameOf(j.playerId)}`);
      }
      for (const j of jobsOf(prev, 'tannery')) {
        if (!wasDone(j.startAbs, j.days) && isDone(j.startAbs, j.days))
          ready.push(`Conceria · ${j.toName} ×${j.toQty} — ${nameOf(j.playerId)}`);
      }
      for (const b of (((prev as any).buildings || []) as any[])) {
        const c = b.construction;
        if (c && !wasDone(c.startAbs, c.days) && isDone(c.startAbs, c.days))
          ready.push(`Cantiere · ${b.name} → livello ${c.targetLevel}`);
      }

      // ── Rendita della taverna ──
      // La tacca è il giorno più avanzato mai raggiunto e si salva a ogni
      // cambio di data, anche arretrando e anche senza incasso: mancando,
      // il primo ritorno in avanti pagava per intero i giorni già vissuti.
      let paidPlayers = players;
      let income: string | undefined;
      const tav = tavernBuilding(prev);
      const fromAbs = absDay(prevDate), toAbs = absDay(next.date);
      const { markets: weeks, mark } = advanceMark((prev as any).tavernPaidAbs, fromAbs, toAbs);
      if (tav && weeks > 0) {
        const rate = (prev as any).tavernWeekly ?? TAVERN_WEEKLY_DEFAULT;
        if (rate > 0) {
          const each = weeks * rate;
          paidPlayers = players.map((pl: any) => {
            const coin = (pl.inventory || []).find((it: any) => normName(it.name) === normName(GOLD_NAME));
            const inventory = coin
              ? pl.inventory.map((it: any) => it.id === coin.id ? { ...it, qty: (it.qty || 0) + each } : it)
              : [...(pl.inventory || []), { id: 'g' + Math.random().toString(36).slice(2, 9), name: GOLD_NAME, type: 'tesoro', qty: each, revealed: true }];
            return { ...pl, inventory };
          });
          income = `${each} mo a testa — ${weeks === 1 ? 'una settimana' : weeks + ' settimane'} di rendita`;
        }
      }

      if (lost.length || ready.length || income) setTimeout(() => setNight({ lost, ready, income }), 0);
      return { calendar: next, players: paidPlayers, ...(mark !== (prev as any).tavernPaidAbs ? { tavernPaidAbs: mark } : {}) } as any;
    });
  };

  // ── Giornata: avanzamento ──
  const advance = (n: number) => {
    setDraft(null);   // una bozza aperta si riferirebbe a una data ormai superata
    const date = addDays(cal.date, n);
    if (n > 0) {
      const { key, roll } = rollDailyWeather(cal.biome || 'temperato', seasonForMonth(date.month));
      sfxDice();
      setCalAndSweep({ ...cal, date, weatherKey: key, weatherRoll: roll });
    } else {
      setCalAndSweep({ ...cal, date });
    }
  };

  const reroll = () => {
    const { key, roll } = rollDailyWeather(cal.biome || 'temperato', calSeason);
    sfxDice();
    setCal({ ...cal, weatherKey: key, weatherRoll: roll });
  };

  // ── Impostazione manuale: si scrive in bozza, si applica con un gesto ──
  const draftOrCurrent = draft || { day: String(cal.date.day), month: cal.date.month, year: String(cal.date.year) };
  const editDraft = (patch: Partial<{ day: string; month: number; year: string }>) => setDraft({ ...draftOrCurrent, ...patch });
  const draftDate: VelmoraDate | null = draft ? {
    year: Math.max(0, parseInt(draft.year) || 0),
    month: Math.min(12, Math.max(1, draft.month || 1)),
    day: Math.min(DAYS_PER_MONTH, Math.max(1, parseInt(draft.day) || 1)),
  } : null;
  const draftDelta = draftDate ? absDay(draftDate) - absDay(cal.date) : 0;
  // Ciò che l'applicazione farebbe maturare, detto prima di farlo.
  const draftMarkets = (draftDate && tavernBuilding(s))
    ? advanceMark((s as any).tavernPaidAbs, absDay(cal.date), absDay(draftDate)).markets
    : 0;
  const applyDraft = () => {
    if (!draftDate) return;
    if (draftDelta !== 0) setCalAndSweep({ ...cal, date: draftDate, weatherKey: undefined, weatherRoll: undefined });
    setDraft(null);
  };

  const upcoming = nextFestivities(cal.date, 3);
  const seasonLabel = calSeason.charAt(0).toUpperCase() + calSeason.slice(1);

  // ── Tiro manuale (tab "roll") ──
  const doManualRoll = () => {
    const n = Math.floor(Math.random() * 100) + 1;
    const rows = DT[rollBiome][rollSeason];
    let cum = 0, mid: string | null = null;
    for (const r of rows) { cum += r.w; if (n <= cum) { mid = r.id; break; } }
    setManualRoll(n);
    setManualHitId(mid);
    setManualExpanded(false);
    sfxDice();
  };

  const applyManualRoll = () => {
    if (manualRoll != null && manualHitId) {
      setCal({ ...cal, biome: rollBiome, weatherKey: manualHitId, weatherRoll: manualRoll });
    }
  };

  // ── Effetti: helper di rendering (condivisi tra le due tab) ──
  const badge = (intensity: string | null) => {
    if (!intensity) return <span className="pill" style={{padding:'2px 7px',fontSize:9,color:'var(--gray-purple-deep)'}}>Neutro</span>;
    const c = INTENSITY_COLORS[intensity] || 'var(--gray-purple)';
    return <span className="pill" style={{padding:'2px 7px',fontSize:9,color:c,borderColor:c}}>{intensity.charAt(0).toUpperCase()+intensity.slice(1)}</span>;
  };

  const exhLabel = (t: string) => {
    if (t === 'a') return <span style={{color:'var(--red)',fontWeight:500,fontSize:11}}>Automatico</span>;
    if (t === 'm') return <span style={{color:'var(--red)',fontWeight:500,fontSize:11}}>Auto / TS Cos</span>;
    if (t === 'ts') return <span style={{color:'#e0a040',fontWeight:500,fontSize:11}}>TS Cos</span>;
    return <span style={{color:'var(--gray-purple-deep)',fontSize:11}}>—</span>;
  };

  const renderDetail = (wd: typeof WEATHER_DETAILS[0]) => (
    <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,fontSize:12}}>
        <div>
          <div className="label" style={{fontSize:8,marginBottom:3}}>Tiri coinvolti</div>
          {wd.sv.length > 0 ? wd.sv.map((s2,i) => <div key={i} style={{color:'var(--red)',fontSize:11}}>– svan. {s2}</div>) : <div className="muted" style={{fontSize:11}}>Nessun svantaggio</div>}
          {wd.va.map((v,i) => <div key={i} style={{color:'var(--green)',fontSize:11}}>– van. {v}</div>)}
        </div>
        <div>
          <div className="label" style={{fontSize:8,marginBottom:3}}>Indebolimento</div>
          <div style={{fontSize:11,color:wd.id.t==='a'||wd.id.t==='m'?'var(--red)':wd.id.t==='ts'?'#e0a040':'var(--gray-purple)'}}>{wd.id.d}</div>
        </div>
        <div>
          <div className="label" style={{fontSize:8,marginBottom:3}}>Effetti speciali</div>
          {wd.sp.map((s2,i) => <div key={i} style={{fontSize:11}}>– {s2}</div>)}
        </div>
      </div>
    </div>
  );

  const toggleRow = (k: string) => {
    setExpandedRows(prev => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });
  };

  const filteredEffects = WEATHER_DETAILS.filter(d =>
    (catFilter === 'all' || d.c === catFilter) && (intFilter === 'all' || d.i === intFilter)
  );
  const catOrder = ['precipitazioni','neve','vento','visibilita','temperature','desertico','marittimo'];
  const grouped: Record<string, typeof WEATHER_DETAILS> = {};
  filteredEffects.forEach(d => { if (!grouped[d.c]) grouped[d.c] = []; grouped[d.c].push(d); });

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup calendar-popup">
        {/* Header */}
        <div className="row" style={{justifyContent:'space-between',marginBottom:12}}>
          <div className="row" style={{gap:8}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
            <div className="h2">Calendario & Meteo</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{fontSize:16,padding:'2px 8px'}}>✕</button>
        </div>

        {/* Sub-tabs */}
        <div className="row" style={{gap:0,marginBottom:12,borderBottom:'1px solid var(--border)'}}>
          <button className={`weather-tab${tab==='day'?' active':''}`} style={{color: tab==='day' ? 'var(--gold)' : undefined, borderBottomColor: tab==='day' ? 'var(--gold)' : undefined}} onClick={()=>setTab('day')}>Giornata</button>
          <button className={`weather-tab${tab==='roll'?' active':''}`} onClick={()=>setTab('roll')}>Tiro meteo</button>
          <button className={`weather-tab${tab==='effects'?' active':''}`} onClick={()=>setTab('effects')}>Riferimento</button>
        </div>

        {/* ═══════════════════ TAB: GIORNATA ═══════════════════ */}
        {tab === 'day' && (
          <>
            {/* Data corrente */}
            <div className="card" style={{textAlign:'center'}}>
              <div className="cal-date-big">{formatDate(cal.date)}</div>
              <div className="row" style={{justifyContent:'center',gap:6,marginTop:8,flexWrap:'wrap'}}>
                <span className="pill" style={{padding:'3px 10px',fontSize:10,color:'var(--blue)',borderColor:'var(--blue)'}}>{seasonLabel}</span>
                {fest && <span className="pill" style={{padding:'3px 10px',fontSize:10,color:'var(--purple-light)',borderColor:'var(--purple)'}}>{fest.name}</span>}
                {!fest && isMarketDay(cal.date) && <span className="pill" style={{padding:'3px 10px',fontSize:10,color:'var(--green)',borderColor:'var(--green)'}}>Giorno di mercato</span>}
              </div>
              {fest && <div className="small muted" style={{marginTop:8,fontStyle:'italic'}}>{fest.desc}</div>}
            </div>

            {/* Meteo del giorno */}
            <div className="card">
              <div className="label" style={{marginBottom:6}}>Meteo del giorno</div>
              {w ? (
                <div className="row" style={{justifyContent:'space-between',gap:8}}>
                  <div className="grow">
                    <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:600,color:wColor}}>{w.n}</div>
                    <div className="small muted" style={{marginTop:2}}>{w.ef}</div>
                  </div>
                  <div className="row" style={{gap:6,flexShrink:0}}>
                    {cal.weatherRoll != null && <span className="small muted">d100: {cal.weatherRoll}</span>}
                    <button className="btn" style={{fontSize:9,padding:'4px 10px'}} onClick={reroll}>Ritira</button>
                  </div>
                </div>
              ) : (
                <div className="row" style={{justifyContent:'space-between',gap:8}}>
                  <div className="small muted">Nessun tiro per questa data.</div>
                  <button className="btn" style={{fontSize:9,padding:'4px 10px'}} onClick={reroll}>Tira</button>
                </div>
              )}
              {/* Bioma corrente */}
              <div className="row" style={{gap:4,marginTop:10,flexWrap:'wrap'}}>
                {BIOMES.map(b => (
                  <button key={b.id}
                    className="pill"
                    style={{padding:'3px 10px',fontSize:9,cursor:'pointer',
                      color: (cal.biome||'temperato')===b.id ? 'var(--gold)' : 'var(--gray-purple-deep)',
                      borderColor: (cal.biome||'temperato')===b.id ? 'var(--gold-dim)' : 'var(--border)'}}
                    onClick={()=>setCal({ ...cal, biome: b.id })}
                  >{b.label}</button>
                ))}
              </div>
            </div>

            {/* Avanzamento */}
            <div className="row" style={{gap:6,marginBottom:10}}>
              <button className="btn cal-adv" onClick={()=>advance(-1)}>−1 giorno</button>
              <button className="btn btn-primary cal-adv" onClick={()=>advance(1)}>+1 giorno</button>
              <button className="btn cal-adv" onClick={()=>advance(6)}>+1 settimana</button>
            </div>

            {/* Ciò che è maturato mentre il tempo passava */}
            {night && (
              <div className="card" style={{borderColor:'var(--gold)',padding:'9px 11px',marginBottom:10}}>
                <div className="row" style={{gap:6,alignItems:'baseline',marginBottom:6}}>
                  <span style={{color:'var(--gold)',fontSize:13}}>☾</span>
                  <div className="label" style={{fontSize:8,color:'var(--gold)'}}>Durante la notte</div>
                  <div className="grow" />
                  <button className="btn btn-ghost" style={{padding:'1px 6px',fontSize:10}} onClick={()=>setNight(null)}>✕</button>
                </div>
                {night.income && (
                  <div style={{ marginBottom: (night.ready.length || night.lost.length) ? 8 : 0 }}>
                    <div className="label" style={{fontSize:8,color:'var(--gold)',marginBottom:3}}>Rendita della taverna</div>
                    <div className="small" style={{fontSize:11,lineHeight:1.6,color:'var(--gold-light)'}}>◉ {night.income}</div>
                  </div>
                )}
                {night.ready.length > 0 && (
                  <div style={{marginBottom: night.lost.length ? 8 : 0}}>
                    <div className="label" style={{fontSize:8,color:'var(--green)',marginBottom:3}}>Pronto al ritiro</div>
                    {night.ready.map((r,i)=>(
                      <div key={i} className="small" style={{fontSize:11,lineHeight:1.6,color:'var(--text-card)'}}>✓ {r}</div>
                    ))}
                  </div>
                )}
                {night.lost.length > 0 && (
                  <div>
                    <div className="label" style={{fontSize:8,color:'var(--red)',marginBottom:3}}>Partite guaste, scartate</div>
                    {night.lost.map((r,i)=>(
                      <div key={i} className="small" style={{fontSize:11,lineHeight:1.6,color:'var(--gray-purple)'}}>⧖ {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Impostazione diretta */}
            <div className="card">
              <div className="label" style={{marginBottom:6}}>Imposta data</div>
              <div className="row" style={{gap:6}}>
                <input type="number" value={draftOrCurrent.day} min={1} max={30}
                  onChange={e=>editDraft({ day: e.target.value })}
                  style={{width:64,textAlign:'center'}} title="Giorno" />
                <select value={draftOrCurrent.month} onChange={e=>editDraft({ month: parseInt(e.target.value)||1 })} className="grow" title="Mese">
                  {MONTHS.map(m => <option key={m.n} value={m.n}>{m.short} ({m.n}º)</option>)}
                </select>
                <input type="number" value={draftOrCurrent.year} min={0}
                  onChange={e=>editDraft({ year: e.target.value })}
                  style={{width:80,textAlign:'center'}} title="Anno d.V." />
              </div>
              {draft && draftDate && (
                <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                  <div className="small" style={{fontSize:11,lineHeight:1.6,color: draftDelta === 0 ? 'var(--gray-purple)' : 'var(--text-card)'}}>
                    {draftDelta === 0
                      ? 'La data coincide con quella corrente.'
                      : <>→ {formatDate(draftDate)} · {draftDelta > 0
                          ? <>{draftDelta === 1 ? 'un giorno' : draftDelta + ' giorni'} in avanti{draftMarkets > 0 ? `, ${draftMarkets === 1 ? 'un mercato' : draftMarkets + ' mercati'} da onorare` : ''}: ciò che scade o matura nel frattempo verrà applicato.</>
                          : <>{-draftDelta === 1 ? 'un giorno' : -draftDelta + ' giorni'} indietro: nulla viene pagato né restituito.</>}</>}
                  </div>
                  <div className="row" style={{gap:6,marginTop:8}}>
                    <button className="btn btn-gold" style={{fontSize:10,padding:'4px 12px'}} disabled={draftDelta === 0} onClick={applyDraft}>Applica</button>
                    <button className="btn btn-ghost" style={{fontSize:10,padding:'4px 12px'}} onClick={()=>setDraft(null)}>Annulla</button>
                  </div>
                </div>
              )}
              <div className="small muted" style={{marginTop:6}}>La data cambia soltanto con «Applica», e impostarla a mano azzera il meteo del giorno.</div>
            </div>

            {/* Prossime ricorrenze */}
            <div className="card" style={{marginBottom:0}}>
              <div className="label" style={{marginBottom:6}}>Prossime ricorrenze</div>
              {upcoming.map(u => (
                <div key={u.fest.name + u.date.year} className="row" style={{justifyContent:'space-between',padding:'4px 0'}}>
                  <div>
                    <span style={{fontFamily:'var(--font-display)',fontSize:12,color:'var(--purple-light)'}}>{u.fest.name}</span>
                    <span className="small muted"> — {formatDateShort(u.date)}</span>
                  </div>
                  <span className="small" style={{color:'var(--gold-dim)',flexShrink:0}}>fra {u.inDays} g</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════════════════ TAB: TIRO METEO ═══════════════════ */}
        {tab === 'roll' && (
          <>
            {/* Bioma */}
            <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:6}}>
              <span className="label" style={{fontSize:8}}>Bioma</span>
              {BIOMES.map(b => (
                <button key={b.id} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',
                  background:rollBiome===b.id?'var(--bg-active)':'transparent',
                  borderColor:rollBiome===b.id?'var(--blue)':'var(--border)',
                  color:rollBiome===b.id?'var(--blue)':'var(--gray-purple-deep)'}}
                  onClick={()=>{setRollBiome(b.id);setManualRoll(null);setManualHitId(null);}}>{b.label}</button>
              ))}
            </div>
            {/* Stagione */}
            <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:10}}>
              <span className="label" style={{fontSize:8}}>Stagione</span>
              {SEASONS.map(s2 => (
                <button key={s2.id} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',
                  background:rollSeason===s2.id?'var(--bg-active)':'transparent',
                  borderColor:rollSeason===s2.id?'var(--blue)':'var(--border)',
                  color:rollSeason===s2.id?'var(--blue)':'var(--gray-purple-deep)'}}
                  onClick={()=>{setRollSeason(s2.id);setManualRoll(null);setManualHitId(null);}}>{s2.label}</button>
              ))}
            </div>

            {/* Roll button + result */}
            <div className="row" style={{gap:8,marginBottom:12}}>
              <button className="btn" style={{flexShrink:0,color:'var(--blue)',borderColor:'var(--blue)'}} onClick={doManualRoll}>Tira d100</button>
              <div className="weather-result-box" style={{flex:1,cursor:manualHitId&&WEATHER_MAP[manualHitId]?'pointer':'default'}}
                onClick={()=>{if(manualHitId&&WEATHER_MAP[manualHitId])setManualExpanded(!manualExpanded);}}>
                {manualRoll !== null && manualHitId ? (
                  <div>
                    <div className="row" style={{gap:10,alignItems:'center'}}>
                      <span style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:600,color:'var(--gold)',minWidth:36,textAlign:'center'}}>{manualRoll}</span>
                      <div className="grow">
                        <div className="row" style={{gap:6}}><span style={{fontWeight:500,fontSize:13}}>{COND[manualHitId].n}</span>{badge(COND[manualHitId].i)}</div>
                        <div style={{fontSize:11,color:'var(--gray-purple)',marginTop:2}}>{COND[manualHitId].ef}
                          {WEATHER_MAP[manualHitId] && !manualExpanded && <span style={{fontSize:10,color:'var(--gray-purple-deep)',marginLeft:6}}>— tocca per dettagli</span>}
                        </div>
                      </div>
                    </div>
                    {manualExpanded && WEATHER_MAP[manualHitId] && renderDetail(WEATHER_MAP[manualHitId])}
                  </div>
                ) : (
                  <span style={{fontSize:11,color:'var(--gray-purple-deep)',fontStyle:'italic'}}>Premi "Tira d100"</span>
                )}
              </div>
            </div>

            {/* Applica come meteo del giorno */}
            {manualRoll !== null && manualHitId && (
              <div style={{marginBottom:12}}>
                <button className="btn btn-primary" style={{width:'100%',fontSize:11}} onClick={applyManualRoll}>
                  Applica come meteo del giorno
                </button>
              </div>
            )}

            {/* Tabella d100 con barre colorate */}
            <div style={{fontSize:12}}>
              {(()=>{
                const rows = DT[rollBiome][rollSeason];
                let cum = 0;
                return rows.map(r => {
                  const from = cum + 1;
                  cum += r.w;
                  const c = COND[r.id];
                  const isHit = manualRoll !== null && manualRoll >= from && manualRoll <= cum;
                  const pc = c.i ? INTENSITY_COLORS[c.i] : 'var(--border)';
                  return (
                    <div key={r.id} className="card" style={{
                      padding:'8px 10px', marginBottom:3,
                      borderLeft: isHit ? '3px solid var(--blue)' : '1px solid var(--border)',
                      background: isHit ? 'var(--bg-active)' : 'var(--bg-input)',
                    }}>
                      <div className="row" style={{gap:8}}>
                        <span style={{fontSize:11,fontVariantNumeric:'tabular-nums',color:'var(--gray-purple)',minWidth:38}}>{from === cum ? String(from).padStart(2,'0') : String(from).padStart(2,'0')+'–'+String(cum).padStart(2,'0')}</span>
                        <span style={{fontWeight:500,flex:1}}>{c.n}</span>
                        {badge(c.i)}
                        <span style={{fontSize:10,color:'var(--gray-purple-deep)',minWidth:22,textAlign:'right'}}>{r.w}%</span>
                      </div>
                      <div style={{height:3,background:'var(--bg-deep)',borderRadius:2,marginTop:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:r.w+'%',background:pc,borderRadius:2}} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}

        {/* ═══════════════════ TAB: RIFERIMENTO EFFETTI ═══════════════════ */}
        {tab === 'effects' && (
          <>
            {/* Legend */}
            <div className="card" style={{fontSize:11,lineHeight:1.7,marginBottom:10,padding:'8px 12px'}}>
              <strong style={{color:'var(--text)'}}>Indebolimento (D&D 5.5)</strong> — ogni livello: −1 a tutti i tiri su d20 e alla CD degli incantesimi · Liv. 5: velocità 0 · Liv. 6: morte<br/>
              <span style={{color:'var(--red)',fontWeight:500}}>■ Automatico</span> · <span style={{color:'#e0a040',fontWeight:500}}>■ TS Cos</span> · Clicca una riga per i dettagli
            </div>

            {/* Filters */}
            <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:6}}>
              <span className="label" style={{fontSize:8}}>Categoria</span>
              <button className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',background:catFilter==='all'?'var(--bg-active)':'transparent',borderColor:catFilter==='all'?'var(--blue)':'var(--border)',color:catFilter==='all'?'var(--blue)':'var(--gray-purple-deep)'}} onClick={()=>setCatFilter('all')}>Tutte</button>
              {Object.entries(EFFECT_CATS).map(([k,v]) => (
                <button key={k} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',background:catFilter===k?'var(--bg-active)':'transparent',borderColor:catFilter===k?'var(--blue)':'var(--border)',color:catFilter===k?'var(--blue)':'var(--gray-purple-deep)'}} onClick={()=>setCatFilter(k)}>{v}</button>
              ))}
            </div>
            <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:10}}>
              <span className="label" style={{fontSize:8}}>Intensità</span>
              {['all','lieve','moderata','grave','estrema'].map(i => (
                <button key={i} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',background:intFilter===i?'var(--bg-active)':'transparent',borderColor:intFilter===i?'var(--blue)':'var(--border)',color:intFilter===i?'var(--blue)':'var(--gray-purple-deep)'}} onClick={()=>setIntFilter(i)}>{i==='all'?'Tutte':i.charAt(0).toUpperCase()+i.slice(1)}</button>
              ))}
            </div>

            <div className="small muted" style={{marginBottom:8}}>{filteredEffects.length} condizion{filteredEffects.length===1?'e':'i'}</div>

            {catOrder.map(cat => {
              if (!grouped[cat]) return null;
              return (
                <div key={cat}>
                  <div className="label" style={{fontSize:9,marginBottom:4,marginTop:8}}>{EFFECT_CATS[cat]}</div>
                  {grouped[cat].map(d => (
                    <div key={d.k}>
                      <div className="card" style={{padding:'8px 10px',marginBottom:2,cursor:'pointer'}} onClick={()=>toggleRow(d.k)}>
                        <div className="row" style={{gap:6}}>
                          <span style={{fontSize:12,color:'var(--gray-purple)',transition:'transform .15s',transform:expandedRows.has(d.k)?'rotate(180deg)':''}}>▾</span>
                          <span style={{fontWeight:500,fontSize:13,flex:1}}>{d.n}</span>
                          {badge(d.i)}
                          {exhLabel(d.id.t)}
                        </div>
                        <div className="row" style={{gap:12,marginTop:3,fontSize:11,color:'var(--gray-purple)'}}>
                          <span>Vis: {d.vs}</span>
                          <span>Mov: {d.mb}</span>
                        </div>
                      </div>
                      {expandedRows.has(d.k) && (
                        <div className="card" style={{padding:'8px 10px',marginBottom:4,marginTop:0,background:'var(--bg-deep)',borderTop:'none',borderRadius:'0 0 8px 8px'}}>
                          {renderDetail(d)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
