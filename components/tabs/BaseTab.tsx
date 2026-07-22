'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';
import { ForgeBox } from '@/components/shared/ForgeBox';
import { MarketBox } from '@/components/shared/MarketBox';
import { absDay } from '@/lib/dnd/calendar';


// ─── TAB: BASE (Olmobianco) ──────────────────────────────────
const GATE_TYPES = [
  {id:'mondano',label:'Mondano',color:'var(--gold)',desc:'Sbloccato dalla fama'},
  {id:'esoterico',label:'Esoterico',color:'var(--blue)',desc:'Richiede conoscenza'},
  {id:'organico',label:'Organico',color:'var(--green)',desc:'Crescita naturale'},
];

export function BaseTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const buildings: any[] = (s as any).buildings || [];
  const visible = s.dmMode ? buildings : buildings.filter((b:any)=>b.revealed!==false);
  const [draftName, setDraftName] = useState('');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);

  const setBuilding = (id:string, patch:any) => update(prev => ({
    buildings: ((prev as any).buildings||[]).map((b:any) => b.id===id ? {...b,...patch} : b)
  } as any));
  const setLevelData = (bId:string, lvIdx:number, field:string, value:any) => {
    update(prev => ({
      buildings: ((prev as any).buildings||[]).map((b:any) => {
        if (b.id !== bId) return b;
        const levels = [...(b.levels||[])];
        while (levels.length <= lvIdx) levels.push({desc:'',costGold:0,costTime:'',costPeople:0});
        levels[lvIdx] = {...levels[lvIdx], [field]:value};
        return {...b, levels};
      })
    } as any));
  };
  const addBuilding = () => {
    if (!draftName.trim()) return;
    const emptyLv = {desc:'',costGold:0,costTime:'',costPeople:0};
    update(prev => ({
      buildings: [...((prev as any).buildings||[]), {
        id:uid('bld'), name:draftName.trim(), level:0, maxLevel:4,
        gate:'mondano', revealed:true, expanded:false,
        levels: [emptyLv,emptyLv,emptyLv,emptyLv,emptyLv],
      }]
    } as any));
    setDraftName('');
  };
  const delBuilding = (id:string) => {
    if (!confirm('Eliminare questo edificio?')) return;
    update(prev => ({buildings: ((prev as any).buildings||[]).filter((b:any)=>b.id!==id)} as any));
  };

  return (
    <div>
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      {/* Magazzino del villaggio — razioni giornaliere condivise */}
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Magazzino di Olmobianco</div>
        {(() => {
          const rations = (s as any).baseRations || 0;
          const setRations = (n:number) => update({ baseRations: Math.max(0, n) } as any);
          const p = s.players.find(pl=>pl.id===s.activePlayer);
          const RATION_NAME = 'Razione giornaliera';
          const invQty = p?.inventory.find(it=>it.name===RATION_NAME)?.qty || 0;
          const moveRation = (dir: 1|-1) => {
            // dir 1 = preleva dal magazzino verso l'inventario del PG attivo; -1 = deposita
            if (!p) return;
            if (dir === 1 && rations <= 0) return;
            if (dir === -1 && invQty <= 0) return;
            update(prev => {
              const players = prev.players.map(pl => {
                if (pl.id !== p.id) return pl;
                const has = pl.inventory.find(it=>it.name===RATION_NAME);
                let inventory;
                if (has) {
                  inventory = pl.inventory
                    .map(it=>it.name===RATION_NAME?{...it,qty:it.qty+dir}:it)
                    .filter(it=>!(it.name===RATION_NAME && it.qty<=0));
                } else {
                  inventory = dir===1 ? [...pl.inventory, {id:uid('i'),name:RATION_NAME,qty:1,type:'consumabile'}] : pl.inventory;
                }
                return {...pl, inventory};
              });
              return { players, baseRations: Math.max(0,((prev as any).baseRations||0) - dir) } as any;
            });
          };
          return (
            <div className="card" style={{marginBottom:0}}>
              <div className="row" style={{justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:600,color:'var(--gold)'}}>Razioni giornaliere</div>
                  <div className="small muted">Scorte comuni del villaggio</div>
                </div>
                <div className="row" style={{gap:6}}>
                  {s.dmMode && <button className="hp-btn hp-btn-neg" style={{flex:'none',padding:'4px 10px'}} onClick={()=>setRations(rations-5)}>-5</button>}
                  {s.dmMode && <button className="hp-btn hp-btn-neg" style={{flex:'none',padding:'4px 10px'}} onClick={()=>setRations(rations-1)}>-1</button>}
                  <span style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,color:'var(--gold)',minWidth:44,textAlign:'center'}}>{rations}</span>
                  {s.dmMode && <button className="hp-btn hp-btn-pos" style={{flex:'none',padding:'4px 10px'}} onClick={()=>setRations(rations+1)}>+1</button>}
                  {s.dmMode && <button className="hp-btn hp-btn-pos" style={{flex:'none',padding:'4px 10px'}} onClick={()=>setRations(rations+5)}>+5</button>}
                </div>
              </div>
              {p && (
                <div className="row" style={{gap:6,marginTop:10,flexWrap:'wrap',alignItems:'center'}}>
                  <span className="small muted">{p.short||p.name} ne porta {invQty}</span>
                  <button className="btn" style={{fontSize:9,padding:'4px 10px',marginLeft:'auto',opacity:rations<=0?0.4:1}} disabled={rations<=0} onClick={()=>moveRation(1)}>Preleva 1</button>
                  <button className="btn" style={{fontSize:9,padding:'4px 10px',opacity:invQty<=0?0.4:1}} disabled={invQty<=0} onClick={()=>moveRation(-1)}>Deposita 1</button>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      <ForgeBox s={s} update={update} campaignId={campaignId} />
      <MarketBox s={s} update={update} campaignId={campaignId} />
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
          <div className="h1" style={{fontSize:18}}>Olmobianco</div>
          {s.dmMode && <div className="small muted">{buildings.length} edifici</div>}
        </div>
        {visible.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun edificio.</div>}
        {visible.map((b:any) => {
          const gate = GATE_TYPES.find(g=>g.id===b.gate) || GATE_TYPES[0];
          const pct = b.maxLevel > 0 ? Math.round((b.level/b.maxLevel)*100) : 0;
          const levels: any[] = b.levels || [];
          const curLvData = levels[b.level] || {};
          const nextLvData = levels[b.level+1] || {};
          const curDesc = curLvData.desc || b.desc || '';
          const nextDesc = nextLvData.desc || b.nextDesc || '';
          const nextGold = nextLvData.costGold ?? b.costGold ?? 0;
          const nextTime = nextLvData.costTime || b.costTime || '';
          const nextPeople = nextLvData.costPeople ?? b.costPeople ?? 0;
          // Cantiere in corso: b.construction = {startAbs, days, targetLevel}
          const today = s.calendar?.date ? absDay(s.calendar.date) : null;
          const con = b.construction;
          const conElapsed = (con && today !== null) ? Math.max(0, today - con.startAbs) : 0;
          const conPct = con && con.days > 0 ? Math.min(100, Math.round((conElapsed / con.days) * 100)) : 0;
          const conDone = con && conElapsed >= con.days;
          const conRemaining = con ? Math.max(0, con.days - conElapsed) : 0;
          return (
            <div key={b.id} className="card" style={{borderLeft:`3px solid ${gate.color}`}}>
              <div className="row" style={{cursor:'pointer',alignItems:'flex-start'}} onClick={()=>setBuilding(b.id,{expanded:!b.expanded})}>
                <div style={{width:64,height:88,flexShrink:0,overflow:'hidden',borderRadius:6,cursor:'pointer'}}
                  onClick={e=>{e.stopPropagation();const img=document.querySelector(`[data-slot="base-${b.id}-lv${b.level}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
                  <div data-slot={'base-'+b.id+'-lv'+b.level} style={{width:64,height:88}}>
                    <ImageSlot slotId={'base-'+b.id+'-lv'+b.level} campaignId={campaignId} shape="rect" width={64} height={88} dmMode={false} placeholder="🏠" alt={b.name} />
                  </div>
                </div>
                <div className="grow" style={{marginLeft:12}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div className="h2" style={{fontSize:15}}>{b.name}</div>
                    <div className="row" style={{gap:6,alignItems:'center'}}>
                      {con && (
                        <div title={conDone?'Cantiere pronto':`Cantiere: ${conElapsed}/${con.days} giorni`} style={{position:'relative',width:26,height:26,flexShrink:0}}>
                          <svg width="26" height="26" viewBox="0 0 26 26" style={{transform:'rotate(-90deg)'}}>
                            <circle cx="13" cy="13" r="10" fill="none" stroke="var(--bg-deep)" strokeWidth="3" />
                            <circle cx="13" cy="13" r="10" fill="none" stroke={conDone?'var(--green)':gate.color} strokeWidth="3"
                              strokeDasharray={2*Math.PI*10} strokeDashoffset={2*Math.PI*10*(1-conPct/100)} strokeLinecap="round" style={{transition:'stroke-dashoffset .4s'}} />
                          </svg>
                          <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:conDone?'var(--green)':gate.color}}>{conDone?'✓':conPct+'%'}</span>
                        </div>
                      )}
                      <div className="pill" style={{padding:'3px 8px',fontSize:9,color:gate.color,borderColor:gate.color}}>Liv {b.level}/{b.maxLevel}</div>
                    </div>
                  </div>
                  <div className="pill" style={{padding:'2px 7px',fontSize:8,marginTop:4,color:gate.color,borderColor:gate.color}}>{gate.label}</div>
                  <div style={{height:5,background:'var(--bg-deep)',borderRadius:3,overflow:'hidden',border:'1px solid var(--border)',marginTop:6}}>
                    <div style={{height:'100%',width:pct+'%',background:gate.color,borderRadius:3,transition:'width .3s'}} />
                  </div>
                  {b.revealed===false && s.dmMode && <span className="dm-badge" style={{marginTop:4}}>NASCOSTO</span>}
                </div>
                <span className="small muted" style={{marginLeft:6,fontSize:16,flexShrink:0}}>{b.expanded?'▾':'▸'}</span>
                <ReorderBtns
                  onUp={()=>{const idx=buildings.findIndex((x:any)=>x.id===b.id);update(prev=>({buildings:moveInArray((prev as any).buildings||[],idx,-1)} as any));}}
                  onDown={()=>{const idx=buildings.findIndex((x:any)=>x.id===b.id);update(prev=>({buildings:moveInArray((prev as any).buildings||[],idx,1)} as any));}}
                />
              </div>
              {b.expanded && (
                <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                  {s.dmMode && <input value={b.name} onChange={e=>setBuilding(b.id,{name:e.target.value})}
                    style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:14,color:'var(--gold)',background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',marginBottom:6}} />}
                  {s.dmMode ? (
                    <div style={{marginBottom:8}}>
                      {Array.from({length:(b.maxLevel||4)+1}).map((_,li) => {
                        const ld = levels[li] || {};
                        const isCurrent = li === b.level;
                        return (
                          <div key={li} style={{background:isCurrent?'var(--bg-active)':'var(--bg-deep)',border:isCurrent?`1px solid ${gate.color}`:'1px solid var(--border)',borderRadius:6,padding:8,marginBottom:4}}>
                            <div className="row" style={{gap:8,alignItems:'flex-start',marginBottom:4}}>
                              <div style={{width:48,height:64,flexShrink:0}}>
                                <ImageSlot slotId={'base-'+b.id+'-lv'+li} campaignId={campaignId} shape="rect" width={48} height={64} dmMode={true} placeholder={'Lv'+li} alt={b.name+' lv'+li} />
                              </div>
                              <div className="grow">
                                <div className="label" style={{fontSize:9,marginBottom:4}}>Livello {li} {isCurrent ? '← attuale' : ''}</div>
                                <textarea value={ld.desc||''} placeholder={`Descrizione livello ${li}…`} onChange={e=>setLevelData(b.id,li,'desc',e.target.value)}
                                  style={{fontSize:12,padding:'4px 8px',minHeight:28}} />
                              </div>
                            </div>
                            {li > 0 && (
                              <div className="row" style={{gap:8,flexWrap:'wrap'}}>
                                <div className="row" style={{gap:3}}><span style={{fontSize:11}}>🪙</span>
                                  <input type="number" value={ld.costGold||0} onChange={e=>setLevelData(b.id,li,'costGold',parseInt(e.target.value)||0)}
                                    style={{width:50,fontSize:11,padding:'2px 4px',background:'transparent',border:'1px solid var(--border)',borderRadius:4,textAlign:'center'}} /></div>
                                <div className="row" style={{gap:3}}><span style={{fontSize:11}}>⏳</span>
                                  <input value={ld.costTime||''} placeholder="tempo" onChange={e=>setLevelData(b.id,li,'costTime',e.target.value)}
                                    style={{width:80,fontSize:11,padding:'2px 4px',background:'transparent',border:'1px solid var(--border)',borderRadius:4}} /></div>
                                <div className="row" style={{gap:3}}><span style={{fontSize:11}}>👥</span>
                                  <input type="number" value={ld.costPeople||0} onChange={e=>setLevelData(b.id,li,'costPeople',parseInt(e.target.value)||0)}
                                    style={{width:36,fontSize:11,padding:'2px 4px',background:'transparent',border:'1px solid var(--border)',borderRadius:4,textAlign:'center'}} /></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      {/* Livello attuale — descrizione */}
                      {curDesc && (
                        <div style={{background:'var(--bg-deep)',border:`1px solid ${gate.color}44`,borderRadius:6,padding:10,marginBottom:6}}>
                          <div className="label" style={{fontSize:9,marginBottom:4,color:gate.color}}>Livello {b.level} — Attuale</div>
                          <div style={{fontSize:14,lineHeight:1.5,fontStyle:'italic'}}>{curDesc}</div>
                        </div>
                      )}
                      {/* Prossimo upgrade — vantaggi + costi */}
                      {b.level < b.maxLevel && nextDesc && (
                        <div style={{background:'var(--bg-deep)',border:'1px solid var(--border)',borderRadius:6,padding:10,marginBottom:6}}>
                          <div className="label" style={{fontSize:9,marginBottom:4}}>Prossimo upgrade → Liv {b.level+1}</div>
                          <div className="small" style={{marginBottom:6}}>{nextDesc}</div>
                          <div className="row" style={{gap:10,flexWrap:'wrap'}}>
                            {nextGold > 0 && <div className="row" style={{gap:4}}><span style={{fontSize:12}}>🪙</span><span className="small">{nextGold} mo</span></div>}
                            {nextTime && <div className="row" style={{gap:4}}><span style={{fontSize:12}}>⏳</span><span className="small">{nextTime}</span></div>}
                            {nextPeople > 0 && <div className="row" style={{gap:4}}><span style={{fontSize:12}}>👥</span><span className="small">{nextPeople} persone</span></div>}
                          </div>
                          {con && (
                            <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                              <div className="row" style={{gap:8,alignItems:'center'}}>
                                <span className="small" style={{color:conDone?'var(--green)':gate.color,fontWeight:600}}>{conDone?'Cantiere pronto':`Cantiere in corso`}</span>
                                <div className="grow" style={{height:6,background:'var(--bg-deep)',borderRadius:3,overflow:'hidden',border:'1px solid var(--border)'}}>
                                  <div style={{height:'100%',width:conPct+'%',background:conDone?'var(--green)':gate.color,transition:'width .4s'}} />
                                </div>
                                <span className="small muted" style={{fontSize:10}}>{conDone?'0':conRemaining} gg</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {b.level >= b.maxLevel && (
                        <div className="pill" style={{padding:'6px 14px',color:gate.color,borderColor:gate.color,fontSize:10}}>✦ Livello massimo raggiunto</div>
                      )}
                    </>
                  )}
                  {s.dmMode && (
                    <div style={{marginTop:6}}>
                      <div className="row" style={{gap:6,marginBottom:6}}>
                        <div className="label" style={{fontSize:9}}>Livello</div>
                        <button className="btn" style={{padding:'2px 8px',fontSize:11}} onClick={()=>setBuilding(b.id,{level:Math.max(0,b.level-1)})}>−</button>
                        <span style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:600}}>{b.level}</span>
                        <button className="btn" style={{padding:'2px 8px',fontSize:11}} onClick={()=>setBuilding(b.id,{level:Math.min(b.maxLevel,b.level+1)})}>+</button>
                        <div className="label" style={{fontSize:9,marginLeft:12}}>Max</div>
                        <input type="number" value={b.maxLevel||4} onChange={e=>setBuilding(b.id,{maxLevel:parseInt(e.target.value)||4})}
                          style={{width:36,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontSize:12,padding:'2px',borderRadius:4}} />
                      </div>
                      {/* Cantiere — legato al calendario */}
                      {b.level < b.maxLevel && (
                        <div style={{background:'var(--bg-deep)',border:'1px solid var(--border)',borderRadius:6,padding:8,marginBottom:6}}>
                          <div className="label" style={{fontSize:9,marginBottom:6}}>Cantiere → Liv {b.level+1}</div>
                          {!con ? (
                            <div className="row" style={{gap:6,alignItems:'center',flexWrap:'wrap'}}>
                              <span className="small muted">Durata</span>
                              <input type="number" min={1} defaultValue={14} id={'con-days-'+b.id} style={{width:52,textAlign:'center',fontSize:12,padding:'3px 4px'}} />
                              <span className="small muted">giorni</span>
                              <button className="btn btn-gold" style={{fontSize:10,padding:'3px 10px'}} disabled={!s.calendar?.date}
                                onClick={()=>{const el=document.getElementById('con-days-'+b.id) as HTMLInputElement;const days=Math.max(1,parseInt(el?.value||'14')||14);if(!s.calendar?.date){alert('Imposta prima la data nel calendario.');return;}setBuilding(b.id,{construction:{startAbs:absDay(s.calendar.date),days,targetLevel:b.level+1}});}}>Avvia</button>
                              {!s.calendar?.date && <span className="small muted" style={{fontSize:9}}>(serve il calendario)</span>}
                            </div>
                          ) : (
                            <div className="row" style={{gap:6,alignItems:'center',flexWrap:'wrap'}}>
                              <span className="small" style={{color:conDone?'var(--green)':gate.color}}>{conElapsed}/{con.days} gg {conDone?'· pronto':''}</span>
                              <div className="grow" />
                              {conDone && <button className="btn btn-primary" style={{fontSize:10,padding:'3px 10px'}}
                                onClick={()=>setBuilding(b.id,{level:Math.min(b.maxLevel,con.targetLevel),construction:null})}>Completa →</button>}
                              <button className="btn btn-danger btn-ghost" style={{fontSize:9,padding:'2px 8px'}} onClick={()=>{if(confirm('Annullare il cantiere?'))setBuilding(b.id,{construction:null});}}>Annulla</button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="row" style={{gap:6,marginBottom:6}}>
                        <div className="label" style={{fontSize:9}}>Tipo</div>
                        {GATE_TYPES.map(g=>(
                          <button key={g.id} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',color:g.color,borderColor:b.gate===g.id?g.color:'var(--border)',background:b.gate===g.id?'var(--bg-active)':'transparent'}}
                            onClick={()=>setBuilding(b.id,{gate:g.id})}>{g.label}</button>
                        ))}
                      </div>
                      <div className="row" style={{gap:6}}>
                        <button className="btn btn-ghost" style={{fontSize:9}} onClick={()=>setBuilding(b.id,{revealed:b.revealed===false?true:false})}>{b.revealed===false?'◯ Nascosto':'◉ Visibile'}</button>
                        <button className="btn btn-danger btn-ghost" style={{fontSize:9,marginLeft:'auto'}} onClick={()=>delBuilding(b.id)}>Elimina</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:10}}>
            <input className="grow" placeholder="Nuovo edificio…" value={draftName} onChange={e=>setDraftName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')addBuilding();}} />
            <button className="btn btn-primary" onClick={addBuilding}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
