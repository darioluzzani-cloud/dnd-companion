'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { getSlotTotals, CasterType } from '@/lib/dnd/spell-slots';
import { PlayerSelector } from '@/components/shared/PlayerSelector';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';


// ─── TAB: MAGIE ──────────────────────────────────────────────
export function SpellsTab({ s, update, updPlayer, p, campaignId }: { s:CampaignState; update:U; updPlayer:any; p:any; campaignId:string|null }) {
  const info = getLevelInfo(p.xp||0);
  const autoSlots = getSlotTotals((p.caster||'none') as CasterType, info.level);
  // customSlots sovrascrive i valori auto se presente
  const customSlots = (p as any).customSlots || {};
  const mergedSlots: Record<string, number> = {...autoSlots};
  Object.entries(customSlots).forEach(([lv, v]: [string, any]) => { if (typeof v?.max === 'number') mergedSlots[lv] = v.max; });
  const slots = mergedSlots;
  const used = p.slotsUsed || {};
  const byLevel: Record<number, any[]> = {};
  const visibleSpells = s.dmMode ? (p.spells||[]) : (p.spells||[]).filter((sp:any) => sp.revealed !== false);
  visibleSpells.forEach((sp:any) => { (byLevel[sp.level]=byLevel[sp.level]||[]).push(sp); });
  const [draftName, setDraftName] = useState('');
  const [draftLv, setDraftLv] = useState('1');
  const slotLabel = (p as any).slotLabel || 'Slot';
  const setCustomSlot = (lv:string, max:number) => updPlayer((pl:any)=>({...pl, customSlots:{...(pl.customSlots||{}), [lv]:{...(pl.customSlots?.[lv]||{}), max}}}));
  const setSlotLevelLabel = (lv:string, label:string) => updPlayer((pl:any)=>({...pl, customSlots:{...(pl.customSlots||{}), [lv]:{...(pl.customSlots?.[lv]||{}), label}}}));

  return (
    <div>
      <PlayerSelector s={s} update={update} p={p} campaignId={campaignId} />
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:8}}>
          {s.dmMode ? (
            <input value={slotLabel} onChange={e=>updPlayer((pl:any)=>({...pl,slotLabel:e.target.value}))}
              style={{fontFamily:'var(--font-display)',fontSize:11,letterSpacing:'2px',textTransform:'uppercase',color:'var(--gray-purple)',background:'transparent',border:'1px solid var(--border)',padding:'2px 8px',width:160}} />
          ) : (
            <div className="label">{slotLabel} · {p.short||p.name}</div>
          )}
          <button className="btn" style={{fontSize:10}} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{}}))}>Riposo lungo</button>
        </div>
        {Object.keys(slots).filter(lv=>slots[lv]>0).length===0 && !s.dmMode
          ? <div className="small muted" style={{fontStyle:'italic'}}>Nessuno slot incantesimo.</div>
          : Object.entries(slots).filter(([,max])=>max>0||s.dmMode).map(([lv,max]) => {
              const u = used[lv]||0;
              const lvLabel = customSlots[lv]?.label || ('Liv '+lv);
              const boxes = [];
              for (let i=0; i<max; i++) {
                const isUsed = i < u;
                boxes.push(
                  <button key={i} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{...pl.slotsUsed,[lv]: isUsed ? Math.max(0,(pl.slotsUsed?.[lv]||0)-1) : (pl.slotsUsed?.[lv]||0)+1 }}))}
                    style={{width:24,height:24,borderRadius:4,border:'1px solid '+(isUsed?p.color||'var(--gold)':'var(--border)'),
                      background:isUsed?(p.color||'var(--gold)'):'transparent',cursor:'pointer',transition:'all .15s'}} />
                );
              }
              return (
                <div key={lv} className="row" style={{gap:8,marginBottom:6}}>
                  {s.dmMode ? (
                    <input value={lvLabel} onChange={e=>setSlotLevelLabel(lv,e.target.value)}
                      style={{width:50,fontSize:10,padding:'2px 4px',background:'transparent',border:'1px solid var(--border)',color:'var(--gray-purple)',textAlign:'right'}} />
                  ) : (
                    <div className="label" style={{width:40,textAlign:'right',fontSize:10}}>{lvLabel}</div>
                  )}
                  <div className="row" style={{gap:4,flexWrap:'wrap'}}>{boxes}</div>
                  <div className="small muted" style={{marginLeft:'auto',whiteSpace:'nowrap'}}>{u} / {max}</div>
                  {s.dmMode && (
                    <div className="row" style={{gap:2}}>
                      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setCustomSlot(lv,Math.max(0,(customSlots[lv]?.max??max)-1))}>−</button>
                      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setCustomSlot(lv,(customSlots[lv]?.max??max)+1)}>+</button>
                      <button className="btn btn-danger btn-ghost" style={{padding:'1px 5px',fontSize:9}} onClick={()=>{
                        updPlayer((pl:any)=>{
                          const cs = {...(pl.customSlots||{})};
                          cs[lv] = {...(cs[lv]||{}), max:0};
                          const su = {...(pl.slotsUsed||{})};
                          delete su[lv];
                          return {...pl, customSlots:cs, slotsUsed:su};
                        });
                      }} title="Rimuovi livello">&times;</button>
                    </div>
                  )}
                </div>
              );
            })
        }
        {s.dmMode && (
          <button className="btn" style={{fontSize:10,marginTop:6}} onClick={()=>{
            const newLv = String(Math.max(...Object.keys(slots).map(Number),0)+1);
            setCustomSlot(newLv, 1);
          }}>+ Aggiungi livello slot</button>
        )}
      </div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Repertorio · tocca per i dettagli</div>
        {Object.keys(byLevel).map(n=>parseInt(n)).sort((a,b)=>a-b).map(lv => (
          <div key={lv} style={{marginBottom:10}}>
            <div className="h3" style={{margin:'4px 0 6px'}}>{lv===0?'Trucchi':'Livello '+lv}</div>
            {byLevel[lv].map((sp:any,spIdx:number) => {
              const allSpells = p.spells||[];
              const globalIdx = allSpells.findIndex((x:any)=>x.id===sp.id);
              return (
              <div key={sp.id} className="card" style={{borderLeft:sp.prepared?`3px solid ${p.color||'var(--gold)'}`:'3px solid transparent'}}>
                <div className="row">
                  <button onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,expanded:!ss.expanded}:ss)}))}
                    style={{width:30,height:30,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--bg-deep)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',transition:'all .15s',color:sp.expanded?p.color||'var(--gold)':'var(--gray-purple-deep)'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4 5.6 21.2 8 14 2 9.2h7.6z"/></svg>
                  </button>
                  <div className="grow" style={{marginLeft:8,cursor:'pointer'}} onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,expanded:!ss.expanded}:ss)}))}>
                    <div style={{fontWeight:600,fontFamily:'var(--font-display)',fontSize:14,letterSpacing:'.3px'}}>{sp.name}</div>
                    {sp.school && <div className="small muted" style={{fontSize:12}}>{sp.school}</div>}
                  </div>
                  <div className="pill" style={{padding:'3px 8px',fontSize:9,color:lv===0?'var(--purple)':'var(--gold)',borderColor:lv===0?'var(--purple)':'var(--gold)'}}>
                    {lv===0 ? 'Trucco' : 'Liv '+lv}
                  </div>
                  <ReorderBtns
                    onUp={()=>updPlayer((pl:any)=>({...pl,spells:moveInArray(pl.spells,globalIdx,-1)}))}
                    onDown={()=>updPlayer((pl:any)=>({...pl,spells:moveInArray(pl.spells,globalIdx,1)}))}
                  />
                  {s.dmMode && (
                    <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9,flexShrink:0}}
                      onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,revealed:sp.revealed===false?true:false}:ss)}))}
                      title={sp.revealed===false?'Rivela':'Nascondi'}>{sp.revealed===false?'◯':'◉'}</button>
                  )}
                </div>
                {s.dmMode && sp.revealed===false && <div className="dm-badge" style={{marginTop:4}}>SEGRETA</div>}
                {sp.expanded && (
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                    <div className="row" style={{gap:6,marginBottom:6}}>
                      <button className={'pill'} style={{cursor:'pointer',padding:'4px 10px',
                        background:sp.prepared?(p.color||'var(--gold)'):'transparent',
                        color:sp.prepared?'var(--bg-deep)':'var(--gray-purple)',
                        borderColor:p.color||'var(--gold)'}}
                        onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,prepared:!ss.prepared}:ss)}))}>
                        {sp.prepared ? '✓ Preparato' : 'Preparare'}
                      </button>
                      {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'2px 8px',fontSize:9,marginLeft:'auto'}} onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.filter((ss:any)=>ss.id!==sp.id)}))}>&times; Rimuovi</button>}
                    </div>
                    {s.dmMode ? (
                      <>
                        <input value={sp.school||''} placeholder="Scuola" onChange={e=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,school:e.target.value}:ss)}))} style={{marginBottom:4,fontSize:13,padding:'4px 8px'}} />
                        <textarea value={sp.desc||''} placeholder="Descrizione…" onChange={e=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,desc:e.target.value}:ss)}))} style={{fontSize:13,padding:'6px 8px',minHeight:40}} />
                      </>
                    ) : (
                      <div style={{fontSize:14,lineHeight:1.5,fontStyle:'italic'}}>{sp.desc||<span className="muted small" style={{fontStyle:'normal'}}>(nessuna descrizione)</span>}</div>
                    )}
                    {/* Copia a un altro PG */}
                    {s.dmMode && (
                      <div className="row" style={{gap:6,marginTop:6}}>
                        <select style={{flex:1,fontSize:11,padding:'4px 6px'}} defaultValue="" onChange={e=>{
                          if(e.target.value){
                            update(prev=>({players:prev.players.map(pl=>
                              pl.id===e.target.value ? {...pl, spells:[...pl.spells, {id:uid('s'),name:sp.name,level:sp.level,school:sp.school||'',desc:sp.desc||'',prepared:false,expanded:false,revealed:true}]} : pl
                            )}));
                          }
                          e.target.value='';
                        }}>
                          <option value="" disabled>Copia a…</option>
                          {s.players.filter(pl=>pl.id!==p.id).map(pl=><option key={pl.id} value={pl.id}>{pl.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        ))}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:10}}>
            <input className="grow" placeholder="Nuovo incantesimo…" value={draftName} onChange={e=>setDraftName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&draftName.trim()){updPlayer((pl:any)=>({...pl,spells:[...pl.spells,{id:uid('s'),name:draftName.trim(),level:parseInt(draftLv),school:'',desc:'',prepared:false,expanded:false}]}));setDraftName('');}}} />
            <select style={{width:64}} value={draftLv} onChange={e=>setDraftLv(e.target.value)}>
              {[0,1,2,3,4,5,6,7,8,9].map(n=><option key={n} value={n}>{n===0?'Trk':'L'+n}</option>)}
            </select>
            <button className="btn btn-primary" onClick={()=>{if(draftName.trim()){updPlayer((pl:any)=>({...pl,spells:[...pl.spells,{id:uid('s'),name:draftName.trim(),level:parseInt(draftLv),school:'',desc:'',prepared:false,expanded:false}]}));setDraftName('');}}}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
