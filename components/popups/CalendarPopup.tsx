'use client';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { sfxDice } from '@/lib/dnd/sounds';
import { COND, BIOMES, INTENSITY_COLORS } from '@/lib/dnd/weather';
import {
  CalendarState, DEFAULT_CALENDAR, MONTHS, addDays, seasonForMonth,
  formatDate, formatDateShort, festivityOn, isMarketDay, nextFestivities, rollDailyWeather,
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

// ─── POPUP: CALENDARIO ───────────────────────────────────────
export function CalendarPopup({ s, update, onClose }: { s: CampaignState; update: U; onClose: () => void }) {
  const cal: CalendarState = s.calendar || DEFAULT_CALENDAR;
  const fest = festivityOn(cal.date);
  const season = seasonForMonth(cal.date.month);
  const w = cal.weatherKey ? COND[cal.weatherKey] : null;
  const wColor = w ? (w.i ? INTENSITY_COLORS[w.i] : 'var(--gray-purple)') : undefined;

  const setCal = (next: CalendarState) => update({ calendar: next });

  const advance = (n: number) => {
    const date = addDays(cal.date, n);
    if (n > 0) {
      const { key, roll } = rollDailyWeather(cal.biome || 'temperato', seasonForMonth(date.month));
      sfxDice();
      setCal({ ...cal, date, weatherKey: key, weatherRoll: roll });
    } else {
      setCal({ ...cal, date });
    }
  };

  const reroll = () => {
    const { key, roll } = rollDailyWeather(cal.biome || 'temperato', season);
    sfxDice();
    setCal({ ...cal, weatherKey: key, weatherRoll: roll });
  };

  const setDatePart = (part: 'year' | 'month' | 'day', v: number) => {
    const date = { ...cal.date, [part]: v };
    date.year = Math.max(0, date.year || 0);
    date.month = Math.min(12, Math.max(1, date.month || 1));
    date.day = Math.min(30, Math.max(1, date.day || 1));
    // Un salto manuale nel tempo invalida il meteo del giorno: andrà ritirato
    setCal({ ...cal, date, weatherKey: undefined, weatherRoll: undefined });
  };

  const upcoming = nextFestivities(cal.date, 3);
  const seasonLabel = season.charAt(0).toUpperCase() + season.slice(1);

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup calendar-popup">
        {/* Header */}
        <div className="row" style={{justifyContent:'space-between',marginBottom:12}}>
          <div className="row" style={{gap:8}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
            <div className="h2">Calendario</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{fontSize:16,padding:'2px 8px'}}>✕</button>
        </div>

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

        {/* Impostazione diretta */}
        <div className="card">
          <div className="label" style={{marginBottom:6}}>Imposta data</div>
          <div className="row" style={{gap:6}}>
            <input type="number" value={cal.date.day} min={1} max={30}
              onChange={e=>setDatePart('day', parseInt(e.target.value)||1)}
              style={{width:64,textAlign:'center'}} title="Giorno" />
            <select value={cal.date.month} onChange={e=>setDatePart('month', parseInt(e.target.value)||1)} className="grow" title="Mese">
              {MONTHS.map(m => <option key={m.n} value={m.n}>{m.short} ({m.n}º)</option>)}
            </select>
            <input type="number" value={cal.date.year} min={0}
              onChange={e=>setDatePart('year', parseInt(e.target.value)||0)}
              style={{width:80,textAlign:'center'}} title="Anno d.V." />
          </div>
          <div className="small muted" style={{marginTop:6}}>Impostare la data a mano azzera il meteo del giorno.</div>
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
      </div>
    </div>
  );
}
