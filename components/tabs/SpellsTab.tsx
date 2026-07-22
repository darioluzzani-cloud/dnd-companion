'use client';
import { useState } from 'react';
import { Markdown } from '@/components/shared/textUtils';
import { CampaignState, uid } from '@/lib/types';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { getSlotTotals, CasterType } from '@/lib/dnd/spell-slots';
import { PlayerSelector } from '@/components/shared/PlayerSelector';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';


// ─── TAB: MAGIE ──────────────────────────────────────────────
export function SpellsTab({ s, update, updPlayer, p, campaignId }: { s:CampaignState; update:U; updPlayer:any; p:any; campaignId:string|null }) {
  const [openSpells, setOpenSpells] = useState<Set<string>>(new Set());
  const toggleSpell = (sid:string) => setOpenSpells(prev=>{const n=new Set(prev);n.has(sid)?n.delete(sid):n.add(sid);return n;});
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
  const [editingSpell, setEditingSpell] = useState<string|null>(null);
  const [draftLv, setDraftLv] = useState('1');
  const slotLabel = (p as any).slotLabel || 'Slot';
  const setCustomSlot = (lv:string, max:number) => updPlayer((pl:any)=>({...pl, customSlots:{...(pl.customSlots||{}), [lv]:{...(pl.customSlots?.[lv]||{}), max}}}));
  const setSlotLevelLabel = (lv:string, label:string) => updPlayer((pl:any)=>({...pl, customSlots:{...(pl.customSlots||{}), [lv]:{...(pl.customSlots?.[lv]||{}), label}}}));

  return (
    <div>
      <PlayerSelector s={s} update={update} p={p} campaignId={campaignId} />
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:6}}>
          {s.dmMode ? (
            <input value={slotLabel} onChange={e=>updPlayer((pl:any)=>({...pl,slotLabel:e.target.value}))}
              style={{fontFamily:'var(--font-display)',fontSize:11,letterSpacing:'2px',textTransform:'uppercase',color:'var(--gray-purple)',background:'transparent',border:'1px solid var(--border)',padding:'2px 8px',width:160}} />
          ) : (
            <div className="label">{slotLabel} · {p.short||p.name}</div>
          )}
          {/* CD incantatore e attacco con incantesimi — derivati, con malus indebolimento (5e 2024) */}
          {(() => {
            const abs2 = (p as any).abilities || {};
            const modOf = (k:string) => Math.floor((((abs2[k] ?? 10)) - 10) / 2);
            const guess = (() => {
              const c = (p.cls||'').toLowerCase();
              if (c.includes('warlock') || c.includes('stregon') || c.includes('bard') || c.includes('paladin')) return 'cha';
              if (c.includes('chieric') || c.includes('druid') || c.includes('ranger')) return 'wis';
              if (c.includes('mago') || c.includes('artefic')) return 'int';
              // ripiego: la migliore delle tre caratteristiche mentali
              return (['int','wis','cha'] as const).reduce((a,b)=>modOf(b)>modOf(a)?b:a, 'int' as string);
            })();
            const spellAb: string = (p as any).spellAbility || guess;
            const pb = 2 + Math.floor((info.level - 1) / 4);
            const exh = (p as any).exhaustion || 0;
            const cd = 8 + pb + modOf(spellAb) - exh;
            const atk = pb + modOf(spellAb) - exh;
            const abLabel: Record<string,string> = { int:'INT', wis:'SAG', cha:'CAR' };
            const penalized = exh > 0;
            return (
              <div className="row" style={{gap:6,flexShrink:0}}>
                <div className="pill" style={{padding:'4px 10px',gap:6,
                    color: penalized ? '#e0a040' : 'var(--gold)',
                    borderColor: penalized ? '#e0a040' : 'var(--gold-dim)'}}
                  title={penalized
                    ? `CD ${8+pb+modOf(spellAb)} base − ${exh} da indebolimento · caratteristica: ${abLabel[spellAb]||spellAb}`
                    : `8 + competenza (${pb}) + mod. ${abLabel[spellAb]||spellAb} (${modOf(spellAb)>=0?'+':''}${modOf(spellAb)})`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2l2.4 5.6L20 9l-4.4 3.9L17 19l-5-3-5 3 1.4-6.1L4 9l5.6-1.4z"/></svg>
                  <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:12}}>CD {cd}</span>
                  <span style={{fontSize:10,opacity:.85}}>· Att {atk>=0?'+':''}{atk}</span>
                </div>
                {s.dmMode && (
                  <select value={spellAb} onChange={e=>updPlayer((pl:any)=>({...pl,spellAbility:e.target.value}))}
                    title="Caratteristica da incantatore" style={{width:62,fontSize:11,padding:'2px 4px'}}>
                    <option value="int">INT</option>
                    <option value="wis">SAG</option>
                    <option value="cha">CAR</option>
                  </select>
                )}
              </div>
            );
          })()}
        </div>
        {Object.keys(slots).filter(lv=>slots[lv]>0).length===0 && !s.dmMode
          ? <div className="small muted" style={{fontStyle:'italic'}}>Nessuno slot incantesimo.</div>
          : Object.entries(slots).filter(([,max])=>max>0||s.dmMode).map(([lv,max]) => {
              const u = used[lv]||0;
              const avail = Math.max(0, max - u);
              const lvLabel = customSlots[lv]?.label || ('Liv '+lv);
              const boxes = [];
              for (let i=0; i<max; i++) {
                const isAvail = i < avail;  // pieno = disponibile; gli slot si consumano da destra
                boxes.push(
                  <button key={i} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{...pl.slotsUsed,[lv]: isAvail ? (pl.slotsUsed?.[lv]||0)+1 : Math.max(0,(pl.slotsUsed?.[lv]||0)-1) }}))}
                    style={{width:24,height:24,borderRadius:4,border:'1px solid '+(isAvail?p.color||'var(--gold)':'var(--border)'),
                      background:isAvail?(p.color||'var(--gold)'):'transparent',cursor:'pointer',transition:'all .15s'}} />
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
                  <div className="small muted" style={{marginLeft:'auto',whiteSpace:'nowrap'}}>{avail} / {max}</div>
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
            <div className="h3" style={{margin:'4px 0 6px'}}>{lv===0?'Trucchetti':'Livello '+lv}</div>
            {byLevel[lv].map((sp:any,spIdx:number) => {
              const allSpells = p.spells||[];
              const globalIdx = allSpells.findIndex((x:any)=>x.id===sp.id);
              return (
              <div key={sp.id} className="card" style={{borderLeft:sp.prepared?`3px solid ${p.color||'var(--gold)'}`:'3px solid transparent'}}>
                <div className="row">
                  <button onClick={()=>toggleSpell(sp.id)}
                    style={{width:30,height:30,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--bg-deep)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',transition:'all .15s',color:openSpells.has(sp.id)?p.color||'var(--gold)':'var(--gray-purple-deep)'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4 5.6 21.2 8 14 2 9.2h7.6z"/></svg>
                  </button>
                  <div className="grow" style={{marginLeft:8,cursor:'pointer'}} onClick={()=>toggleSpell(sp.id)}>
                    <div style={{fontWeight:600,fontFamily:'var(--font-display)',fontSize:14,letterSpacing:'.3px'}}>{sp.name}</div>
                    {sp.school && <div className="small muted" style={{fontSize:12}}>{sp.school}</div>}
                  </div>
                  <div className="pill" style={{padding:'3px 8px',fontSize:9,color:lv===0?'var(--purple)':'var(--gold)',borderColor:lv===0?'var(--purple)':'var(--gold)'}}>
                    {lv===0 ? 'Trucchetto' : 'Liv '+lv}
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
                {openSpells.has(sp.id) && (
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                    {/* Modifica testi — aperta a tutti i giocatori */}
                    {editingSpell === sp.id ? (
                      <div style={{marginBottom:8}}>
                        <input value={sp.name} onChange={e=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,name:e.target.value}:ss)}))}
                          style={{fontSize:13,marginBottom:4}} placeholder="Nome" />
                        <textarea value={sp.desc} onChange={e=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,desc:e.target.value}:ss)}))}
                          style={{minHeight:56,fontSize:13,marginBottom:4}} placeholder="Descrizione" />
                        <button className="btn" style={{fontSize:10}} onClick={()=>setEditingSpell(null)}>Fine</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost" style={{padding:'1px 6px',fontSize:10,float:'right'}} title="Correggi testo"
                        onClick={()=>setEditingSpell(sp.id)}>✎</button>
                    )}
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
                      <div style={{fontSize:14,lineHeight:1.5,fontStyle:'italic'}}>{sp.desc?<Markdown text={sp.desc}/>:<span className="muted small" style={{fontStyle:'normal'}}>(nessuna descrizione)</span>}</div>
                    )}
                    {/* Copia a un altro PG */}
                    {s.dmMode && (
                      <div className="row" style={{gap:6,marginTop:6}}>
                        <select style={{flex:1,fontSize:11,padding:'4px 6px'}} defaultValue="" onChange={e=>{
                          // Catturo l'id PRIMA di accodare l'aggiornamento: l'azzeramento del
                          // menù avviene subito, l'updater gira dopo — leggere e.target.value
                          // al suo interno troverebbe la stringa vuota (era il bug della copia).
                          const targetId = e.target.value;
                          if(targetId){
                            update(prev=>({players:prev.players.map(pl=>
                              pl.id===targetId ? {...pl, spells:[...pl.spells, {id:uid('s'),name:sp.name,level:sp.level,school:sp.school||'',desc:sp.desc||'',prepared:false,expanded:false,revealed:true}]} : pl
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
