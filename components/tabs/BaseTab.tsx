'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';


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
                    <div className="pill" style={{padding:'3px 8px',fontSize:9,color:gate.color,borderColor:gate.color}}>Liv {b.level}/{b.maxLevel}</div>
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
