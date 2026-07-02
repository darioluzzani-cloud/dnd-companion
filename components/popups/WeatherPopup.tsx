'use client';
import { useState } from 'react';
import { sfxDice } from '@/lib/dnd/sounds';
import { COND, DT, WEATHER_MAP, WEATHER_DETAILS, BIOMES, SEASONS, EFFECT_CATS, INTENSITY_COLORS } from '@/lib/dnd/weather';

// ─── POPUP: METEO ────────────────────────────────────────────
export function WeatherPopup({ onClose, initialBiome, initialSeason }: { onClose:()=>void; initialBiome?:string; initialSeason?:string }) {
  const [biome, setBiome] = useState(initialBiome || 'temperato');
  const [season, setSeason] = useState(initialSeason || 'primavera');
  const [roll, setRoll] = useState<number|null>(null);
  const [hitId, setHitId] = useState<string|null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'roll'|'effects'>('roll');
  const [catFilter, setCatFilter] = useState('all');
  const [intFilter, setIntFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const doRoll = () => {
    const n = Math.floor(Math.random() * 100) + 1;
    const rows = DT[biome][season];
    let cum = 0, mid: string | null = null;
    for (const r of rows) { cum += r.w; if (n <= cum) { mid = r.id; break; } }
    setRoll(n);
    setHitId(mid);
    setExpanded(false);
    sfxDice();
  };

  const toggleRow = (k: string) => {
    setExpandedRows(prev => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });
  };

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

  const renderDetail = (w: typeof WEATHER_DETAILS[0]) => (
    <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,fontSize:12}}>
        <div>
          <div className="label" style={{fontSize:8,marginBottom:3}}>Tiri coinvolti</div>
          {w.sv.length > 0 ? w.sv.map((s2,i) => <div key={i} style={{color:'var(--red)',fontSize:11}}>– svan. {s2}</div>) : <div className="muted" style={{fontSize:11}}>Nessun svantaggio</div>}
          {w.va.map((v,i) => <div key={i} style={{color:'var(--green)',fontSize:11}}>– van. {v}</div>)}
        </div>
        <div>
          <div className="label" style={{fontSize:8,marginBottom:3}}>Indebolimento</div>
          <div style={{fontSize:11,color:w.id.t==='a'||w.id.t==='m'?'var(--red)':w.id.t==='ts'?'#e0a040':'var(--gray-purple)'}}>{w.id.d}</div>
        </div>
        <div>
          <div className="label" style={{fontSize:8,marginBottom:3}}>Effetti speciali</div>
          {w.sp.map((s2,i) => <div key={i} style={{fontSize:11}}>– {s2}</div>)}
        </div>
      </div>
    </div>
  );

  // Filtered effects for tab 2
  const filteredEffects = WEATHER_DETAILS.filter(d =>
    (catFilter === 'all' || d.c === catFilter) && (intFilter === 'all' || d.i === intFilter)
  );
  const catOrder = ['precipitazioni','neve','vento','visibilita','temperature','desertico','marittimo'];
  const grouped: Record<string, typeof WEATHER_DETAILS> = {};
  filteredEffects.forEach(d => { if (!grouped[d.c]) grouped[d.c] = []; grouped[d.c].push(d); });

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup weather-popup">
        {/* Header */}
        <div className="row" style={{justifyContent:'space-between',marginBottom:12}}>
          <div className="row" style={{gap:8}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.5"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-1.2-9.87A7 7 0 108 15z"/></svg>
            <div className="h2" style={{color:'var(--blue)',fontSize:16}}>Meteo</div>
          </div>
          <button className="btn btn-ghost" style={{fontSize:16,padding:'2px 8px'}} onClick={onClose}>✕</button>
        </div>

        {/* Sub-tabs */}
        <div className="row" style={{gap:0,marginBottom:12,borderBottom:'1px solid var(--border)'}}>
          <button className={`weather-tab${tab==='roll'?' active':''}`} onClick={()=>setTab('roll')}>Lancia il meteo</button>
          <button className={`weather-tab${tab==='effects'?' active':''}`} onClick={()=>setTab('effects')}>Consulta effetti</button>
        </div>

        {tab === 'roll' && (
          <>
            {/* Bioma */}
            <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:6}}>
              <span className="label" style={{fontSize:8}}>Bioma</span>
              {BIOMES.map(b => (
                <button key={b.id} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',
                  background:biome===b.id?'var(--bg-active)':'transparent',
                  borderColor:biome===b.id?'var(--blue)':'var(--border)',
                  color:biome===b.id?'var(--blue)':'var(--gray-purple-deep)'}}
                  onClick={()=>{setBiome(b.id);setRoll(null);setHitId(null);}}>{b.label}</button>
              ))}
            </div>
            {/* Stagione */}
            <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:10}}>
              <span className="label" style={{fontSize:8}}>Stagione</span>
              {SEASONS.map(s2 => (
                <button key={s2.id} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',
                  background:season===s2.id?'var(--bg-active)':'transparent',
                  borderColor:season===s2.id?'var(--blue)':'var(--border)',
                  color:season===s2.id?'var(--blue)':'var(--gray-purple-deep)'}}
                  onClick={()=>{setSeason(s2.id);setRoll(null);setHitId(null);}}>{s2.label}</button>
              ))}
            </div>

            {/* Roll button + result */}
            <div className="row" style={{gap:8,marginBottom:12}}>
              <button className="btn" style={{flexShrink:0,color:'var(--blue)',borderColor:'var(--blue)'}} onClick={doRoll}>Tira d100</button>
              <div className="weather-result-box" style={{flex:1,cursor:hitId&&WEATHER_MAP[hitId]?'pointer':'default'}}
                onClick={()=>{if(hitId&&WEATHER_MAP[hitId])setExpanded(!expanded);}}>
                {roll !== null && hitId ? (
                  <div>
                    <div className="row" style={{gap:10,alignItems:'center'}}>
                      <span style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:600,color:'var(--gold)',minWidth:36,textAlign:'center'}}>{roll}</span>
                      <div className="grow">
                        <div className="row" style={{gap:6}}><span style={{fontWeight:500,fontSize:13}}>{COND[hitId].n}</span>{badge(COND[hitId].i)}</div>
                        <div style={{fontSize:11,color:'var(--gray-purple)',marginTop:2}}>{COND[hitId].ef}
                          {WEATHER_MAP[hitId] && !expanded && <span style={{fontSize:10,color:'var(--gray-purple-deep)',marginLeft:6}}>— tocca per dettagli</span>}
                        </div>
                      </div>
                    </div>
                    {expanded && WEATHER_MAP[hitId] && renderDetail(WEATHER_MAP[hitId])}
                  </div>
                ) : (
                  <span style={{fontSize:11,color:'var(--gray-purple-deep)',fontStyle:'italic'}}>Premi "Tira d100"</span>
                )}
              </div>
            </div>

            {/* Tabella d100 */}
            <div style={{fontSize:12}}>
              {(()=>{
                const rows = DT[biome][season];
                let cum = 0;
                return rows.map(r => {
                  const from = cum + 1;
                  cum += r.w;
                  const c = COND[r.id];
                  const isHit = roll !== null && roll >= from && roll <= cum;
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
