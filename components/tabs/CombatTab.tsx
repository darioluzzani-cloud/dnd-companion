'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { NumberInput } from '@/components/shared/textUtils';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { sfxDice } from '@/lib/dnd/sounds';
import { rollDice } from '@/components/shared/DiceOverlay';
import { U } from '@/components/shared/common';
import { BestiaryPopup } from '@/components/popups/BestiaryPopup';


// ─── TAB: COMBATTIMENTO ──────────────────────────────────────
export function CombatTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const combatScen = (s as any).combatScenario || s.activeScenario || '';
  const setCombatScen = (id:string) => update({combatScenario:id} as any);
  const allCombatants = (s.combatants||[]).filter((k:any)=>!k.scenarioId || k.scenarioId===combatScen);
  const sorted = [...allCombatants].sort((a,b)=>(b.init||0)-(a.init||0));
  const visibleCombatants = s.dmMode ? sorted : sorted.filter(k=>(k as any).revealed!==false);
  // Il ciclo turni esclude SEMPRE i nascosti — sono "preparati ma non in campo"
  const turnList = sorted.filter(k=>(k as any).revealed!==false);
  const idx = s.turnIndex||0;
  const current = turnList[idx % (turnList.length||1)];
  const [name,setName]=useState('');
  const [init,setInit]=useState('');
  const [hp,setHp]=useState('');
  const [dice,setDice]=useState(20);
  const [lastRoll,setLastRoll]=useState<{die:number;value:number;t:number}|null>(null);
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);

  // HP change con sync bidirezionale combattente ↔ giocatore/companion
  const changeHp = (kId:string, delta:number) => {
    update(prev => {
      const newCombatants = prev.combatants.map(c => {
        if (c.id !== kId) return c;
        const hp = Math.max(0, Math.min(c.maxHp, c.hp + delta));
        const next: any = {...c, hp};
        if (hp > 0 && next.ds) delete next.ds; // sopra lo zero i TS contro morte si azzerano
        return next;
      });
      let newPlayers = prev.players;
      // Sync verso player se è un PG
      if (kId.startsWith('pc-')) {
        const pId = kId.replace('pc-','');
        const comb = newCombatants.find(c=>c.id===kId);
        if (comb) {
          newPlayers = prev.players.map(p => p.id===pId ? {...p, hp: comb.hp, maxHp: comb.maxHp} : p);
        }
      }
      // Sync verso companion se è un companion
      if (kId.startsWith('comp-')) {
        const pId = kId.replace('comp-','');
        const comb = newCombatants.find(c=>c.id===kId);
        if (comb) {
          newPlayers = prev.players.map(p => p.id===pId && (p as any).companion
            ? {...p, companion: {...(p as any).companion, hp: comb.hp, maxHp: comb.maxHp}} as any
            : p);
        }
      }
      return { combatants: newCombatants, players: newPlayers };
    });
  };

  const nextTurn=()=>{let n=idx+1,r=s.round;if(n>=turnList.length){n=0;r++;}update({turnIndex:n,round:r});};
  const prevTurn=()=>{let n=idx-1,r=s.round;if(n<0){n=turnList.length-1;r=Math.max(1,r-1);}update({turnIndex:n,round:r});};

  // Importa i PG come combattenti (companion mostrato dentro la card del padrone)
  const [showBestiary, setShowBestiary] = useState(false);

  const addPlayers = () => {
    const existing = new Set((s.combatants||[]).map(c=>c.id));
    const newCombatants: any[] = [];
    s.players.forEach(p => {
      if (!existing.has('pc-'+p.id)) {
        const dexMod = Math.floor((((p as any).abilities?.dex ?? 10) - 10) / 2);
        const ov = (p as any).initOverride;
        const initMod = (ov !== undefined && ov !== null && ov !== '') ? Number(ov) : dexMod + ((p as any).initBonus || 0);
        const initRoll = Math.floor(Math.random()*20) + 1 + initMod;
        newCombatants.push({
          id:'pc-'+p.id, name:p.name, init:initRoll, hp:p.hp??p.maxHp??30, maxHp:p.maxHp??30, side:'ally' as const, conditions:[], scenarioId:combatScen
        });
      }
    });
    if(newCombatants.length) { sfxDice(); update(prev=>({combatants:[...prev.combatants,...newCombatants]})); }
  };

  return (
    <div>
      {/* Overlay immagine ingrandita */}
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      {/* Selettore scenario */}
      <div className="frame">
        <div className="label" style={{marginBottom:6}}>Scenario</div>
        <div className="row" style={{gap:5,flexWrap:'wrap'}}>
          {(s.dmMode ? s.scenarios : s.scenarios.filter((sc:any) => sc.revealed !== false)).map(sc => (
            <button key={sc.id} className={'btn'+(combatScen===sc.id?' btn-primary':'')}
              style={{fontSize:10}} onClick={()=>setCombatScen(sc.id)}>{sc.name}</button>
          ))}
        </div>
      </div>
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
          <div>
            <div className="label">Round</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:22,color:'var(--gold)'}}>{s.round}</div>
          </div>
          <div className="row" style={{gap:6}}>
            <button className="btn" onClick={prevTurn}>◀</button>
            <button className="btn btn-primary" onClick={nextTurn}>Succ.</button>
            <button className="btn btn-danger btn-ghost" onClick={()=>{if(confirm('Reset?'))update({round:1,turnIndex:0});}}>Reset</button>
          </div>
        </div>
        {current && <div className="small"><span className="muted">Turno:</span> <strong style={{color:'var(--gold)'}}>{current.name}</strong></div>}
      </div>
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:8}}>
          <div className="label">Ordine di Iniziativa</div>
          {s.dmMode && <button className="btn" style={{fontSize:10}} onClick={addPlayers}>+ PG</button>}
          {s.dmMode && (
            <button className="tool-box-btn" style={{color:'var(--red)',fontSize:9,padding:'6px 12px'}} onClick={()=>setShowBestiary(true)} title="Registro dei nemici">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2c-1.5 3-4 4-7 4 0 7 3 12 7 16 4-4 7-9 7-16-3 0-5.5-1-7-4z"/><path d="M9 10h.01M15 10h.01M9.5 14c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1"/></svg>
              <span>Bestiario</span>
            </button>
          )}
        </div>
        {visibleCombatants.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun combattente.</div>}
        {visibleCombatants.map((k,i) => {
          const isCurrent = turnList.indexOf(k)===(idx%turnList.length);
          // Nascosto: per il DM una riga compatta, fuori dal rumore ma sotto controllo
          if (s.dmMode && (k as any).revealed === false) {
            return (
              <div key={k.id} className="row" style={{padding:'5px 12px',marginBottom:4,borderRadius:6,border:'1px dashed var(--border)',opacity:.55,gap:8}}>
                <span className="small" style={{fontStyle:'italic',flex:1}}>{k.name}</span>
                <span className="small muted">{k.hp}/{k.maxHp} PF</span>
                <button className="btn btn-ghost" style={{padding:'1px 6px',fontSize:10}} title="Rivela in battaglia"
                  onClick={()=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,revealed:true}:c)}))}>◯</button>
                <button className="btn btn-danger btn-ghost" style={{padding:'1px 6px',fontSize:10}} title="Rimuovi"
                  onClick={()=>{if(confirm('Rimuovere '+k.name+'?'))update(prev=>({combatants:prev.combatants.filter(c=>c.id!==k.id)}));}}>&times;</button>
              </div>
            );
          }
          const pct = Math.round(((k.hp||0)/(k.maxHp||1))*100);
          return (
            <div key={k.id} className={(k.side==='enemy' && k.hp===0 ? 'enemy-dead ' : k.side==='enemy' && k.hp>0 && k.hp<=Math.max(1,Math.ceil(k.maxHp*0.05)) ? 'enemy-critical ' : '') + ('card'+(isCurrent?' turn-indicator':''))}>
              <div className="row">
                {/* Ritratto rettangolare verticale — per tutti i combattenti */}
                <div style={{width:44,height:60,flexShrink:0,marginRight:4,overflow:'hidden',borderRadius:6,cursor:'pointer'}}
                  onClick={e=>{e.stopPropagation();const slotId=(k as any).imgSlot||(k.id.startsWith('pc-')?'portrait-'+k.id.replace('pc-',''):k.id.startsWith('comp-')?'companion-'+k.id.replace('comp-',''):'combat-'+k.id);const img=document.querySelector(`[data-slot="${slotId}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
                  {(() => {
                    const slotId=(k as any).imgSlot||(k.id.startsWith('pc-')?'portrait-'+k.id.replace('pc-',''):k.id.startsWith('comp-')?'companion-'+k.id.replace('comp-',''):'combat-'+k.id);
                    return <div data-slot={slotId} style={{width:44,height:60}}><ImageSlot slotId={slotId} campaignId={campaignId} shape="rect" width={44} height={60} dmMode={s.dmMode} placeholder={k.name.slice(0,2).toUpperCase()} alt={k.name} /></div>;
                  })()}
                </div>
                {s.dmMode && k.id.startsWith('pc-') && (() => {
                  const owner = s.players.find(pl => pl.id === k.id.replace('pc-',''));
                  if (!owner) return null;
                  return (
                    <button className="btn btn-ghost" style={{padding:'2px 4px',fontSize:11}} title="Ritira iniziativa (d20 + mod.)"
                      onClick={()=>{
                        const dexMod = Math.floor((((owner as any).abilities?.dex ?? 10) - 10) / 2);
                        const r = rollDice(20, 'Iniziativa') + dexMod + ((owner as any).initBonus || 0);
                        update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,init:r}:c)}));
                      }}>⟳</button>
                  );
                })()}
                <div className="init-circle" title="Iniziativa">
                  {s.dmMode ? (
                    <NumberInput value={k.init||0} onChange={n=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,init:n}:c)}))}
                      style={{width:32,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:16,color:'var(--gold)',padding:0}} />
                  ) : k.init||0}
                </div>
                <div className="grow" style={{marginLeft:8}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    {s.dmMode ? (
                      <input value={k.name} onChange={e=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,name:e.target.value}:c)}))}
                        style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,background:'transparent',border:'1px solid var(--border)',padding:'2px 8px',flex:1,marginRight:8}} />
                    ) : (
                      <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15}}>{k.name}</div>
                    )}
                    {(k.side==='ally'||s.dmMode) ? (
                      s.dmMode ? (
                        <div className="row" style={{gap:2}}>
                          <span style={{fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)'}}>{k.hp}/</span>
                          <NumberInput value={k.maxHp||0} onChange={v=>{update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,maxHp:v,hp:Math.min(c.hp,v)}:c)}));}}
                            style={{width:40,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)',padding:'2px 4px'}} />
                        </div>
                      ) : (
                        <div style={{fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)'}}>{k.hp}/{k.maxHp}</div>
                      )
                    ) : (
                      <div className="pill" style={{fontSize:9,padding:'2px 8px',color:'var(--red)',borderColor:'var(--pink-border)'}}>Nemico</div>
                    )}
                  </div>
                  {(k.side==='ally'||s.dmMode) && <>
                  <div className="hp-bar" style={{margin:'6px 0'}}><div className="hp-fill" style={{width:pct+'%',background:`hsl(${Math.round(pct*1.2)},65%,55%)`}} /></div>
                  <div className="row" style={{gap:4}}>
                    <button className="hp-btn hp-btn-neg" onClick={()=>changeHp(k.id,-5)}>-5</button>
                    <button className="hp-btn hp-btn-neg" onClick={()=>changeHp(k.id,-1)}>-1</button>
                    <button className="hp-btn hp-btn-pos" onClick={()=>changeHp(k.id,1)}>+1</button>
                    <button className="hp-btn hp-btn-pos" onClick={()=>changeHp(k.id,5)}>+5</button>
                  </div>
                  {k.id.startsWith('pc-') && (k.hp||0) === 0 && (() => {
                    const ds = (k as any).ds || { s: 0, f: 0 };
                    const setDs = (ns:number, nf:number) => update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?({...c, ds:{s:ns,f:nf}} as any):c)}));
                    const dead = ds.f >= 3, stable = ds.s >= 3;
                    return (
                      <div style={{marginTop:8,padding:'8px 10px',borderRadius:6,background:'var(--bg-deep)',
                        border:'1px solid '+(dead?'var(--red)':stable?'var(--green)':'var(--border)')}}>
                        <div className="row" style={{justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
                          <div className="label" style={{fontSize:8}}>TS contro morte</div>
                          {dead
                            ? <span style={{color:'var(--red)',fontFamily:'var(--font-display)',fontSize:11,fontWeight:700,letterSpacing:'1px'}}>MORTO</span>
                            : stable
                              ? <span style={{color:'var(--green)',fontSize:11,fontWeight:600}}>Stabilizzato</span>
                              : null}
                        </div>
                        <div className="row" style={{gap:16,marginTop:6}}>
                          <div className="row" style={{gap:4}}>
                            <span className="small" style={{color:'var(--green)',fontWeight:600}}>✓</span>
                            {[0,1,2].map(i => (
                              <button key={i} onClick={()=>setDs(ds.s===i+1?i:i+1, ds.f)}
                                style={{width:16,height:16,borderRadius:'50%',cursor:'pointer',transition:'all .15s',
                                  border:'1px solid '+(i<ds.s?'var(--green)':'var(--border)'),
                                  background:i<ds.s?'var(--green)':'transparent'}} />
                            ))}
                          </div>
                          <div className="row" style={{gap:4}}>
                            <span className="small" style={{color:'var(--red)',fontWeight:600}}>✗</span>
                            {[0,1,2].map(i => (
                              <button key={i} onClick={()=>setDs(ds.s, ds.f===i+1?i:i+1)}
                                style={{width:16,height:16,borderRadius:'50%',cursor:'pointer',transition:'all .15s',
                                  border:'1px solid '+(i<ds.f?'var(--red)':'var(--border)'),
                                  background:i<ds.f?'var(--red)':'transparent'}} />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  </>}
                  {/* Companion inline — nel turno del padrone */}
                  {k.id.startsWith('pc-') && (() => {
                    const owner = s.players.find(pl=>pl.id===k.id.replace('pc-',''));
                    const comp = owner && (owner as any).companion;
                    if (!comp || !comp.name) return null;
                    const compPct = comp.maxHp > 0 ? Math.round((comp.hp/comp.maxHp)*100) : 0;
                    return (
                      <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                        <div className="row" style={{gap:6}}>
                          <div style={{width:28,height:28,flexShrink:0}}>
                            <ImageSlot slotId={'companion-'+k.id.replace('pc-','')} campaignId={campaignId} shape="circle" dmMode={false} placeholder="🐾" alt={comp.name} />
                          </div>
                          <div className="grow">
                            <div style={{fontFamily:'var(--font-display)',fontSize:12,fontWeight:600,color:'var(--green)'}}>{comp.name}</div>
                            <div className="row" style={{gap:4}}>
                              <span style={{fontSize:11,color:'var(--red)'}}>♥</span>
                              <span style={{fontFamily:'var(--font-display)',fontSize:12}}>{comp.hp}/{comp.maxHp}</span>
                              <div className="hp-bar" style={{flex:1,height:4}}><div className="hp-fill" style={{width:compPct+'%',background:`hsl(${Math.round(compPct*1.2)},65%,55%)`}} /></div>
                            </div>
                          </div>
                          <div className="row" style={{gap:2}}>
                            <button className="hp-btn hp-btn-neg" style={{padding:'3px 6px',fontSize:10}} onClick={()=>{
                              update(prev=>({players:prev.players.map(p=>p.id===k.id.replace('pc-','')?{...p,companion:{...(p as any).companion,hp:Math.max(0,((p as any).companion?.hp??0)-1)}} as any:p)}));
                            }}>-1</button>
                            <button className="hp-btn hp-btn-pos" style={{padding:'3px 6px',fontSize:10}} onClick={()=>{
                              update(prev=>({players:prev.players.map(p=>p.id===k.id.replace('pc-','')?{...p,companion:{...(p as any).companion,hp:Math.min((p as any).companion?.maxHp??0,((p as any).companion?.hp??0)+1)}} as any:p)}));
                            }}>+1</button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Condizioni */}
                  {(k.conditions||[]).length>0 && (
                    <div className="row" style={{gap:4,marginTop:4,flexWrap:'wrap'}}>
                      {k.conditions!.map(cid => { const c=CONDITIONS.find(x=>x.id===cid); return c?<span key={cid} className="pill" style={{fontSize:8,padding:'2px 6px',color:c.color,borderColor:c.color}}>{c.label}</span>:null; })}
                    </div>
                  )}
                  {s.dmMode && (
                    <div className="row" style={{gap:4,marginTop:6,flexWrap:'wrap'}}>
                      {CONDITIONS.map(c => {
                        const active=(k.conditions||[]).includes(c.id);
                        return <button key={c.id} className="pill" style={{fontSize:7,padding:'2px 5px',cursor:'pointer',opacity:active?1:.4,color:c.color,borderColor:c.color}}
                          onClick={()=>update(prev=>({combatants:prev.combatants.map(x=>x.id===k.id?{...x,conditions:active?(x.conditions||[]).filter(cc=>cc!==c.id):[...(x.conditions||[]),c.id]}:x)}))}>{c.label}</button>;
                      })}
                      <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9}}
                        onClick={()=>update(prev=>({combatants:prev.combatants.map(x=>x.id===k.id?{...x,revealed:(x as any).revealed===false?true:false} as any:x)}))}
                        title={(k as any).revealed===false?'Rivela':'Nascondi'}>{(k as any).revealed===false?'◯':'◉'}</button>
                      <button className="pill" style={{fontSize:8,padding:'2px 7px',cursor:'pointer',
                        color:k.side==='ally'?'var(--green)':'var(--red)',
                        borderColor:k.side==='ally'?'var(--green)':'var(--pink-border)'}}
                        onClick={()=>update(prev=>({combatants:prev.combatants.map(x=>x.id===k.id?{...x,side:x.side==='ally'?'enemy':'ally'}:x)}))}
                        title="Cambia fazione">{k.side==='ally'?'Alleato':'Nemico'}</button>
                      <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9,marginLeft:'auto'}}
                        onClick={()=>{if(confirm('Rimuovere?'))update(prev=>({combatants:prev.combatants.filter(x=>x.id!==k.id)}));}}>&times;</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {s.dmMode && (
          <div style={{marginTop:10}}>
            <div className="row" style={{gap:6}}>
              <input placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} style={{flex:1}} />
              <input placeholder="Init" value={init} onChange={e=>setInit(e.target.value)} style={{width:52}} />
              <input placeholder="PF" value={hp} onChange={e=>setHp(e.target.value)} style={{width:52}} />
              <button className="btn btn-primary" onClick={()=>{if(name.trim()){update(prev=>({combatants:[...prev.combatants,{id:uid('k'),name:name.trim(),init:parseInt(init)||10,hp:parseInt(hp)||10,maxHp:parseInt(hp)||10,side:'enemy',scenarioId:combatScen} as any]}));setName('');setInit('');setHp('');}}}>+</button>
            </div>
          </div>
        )}
      </div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Dado</div>
        <div className="row" style={{gap:6,flexWrap:'wrap',marginBottom:8}}>
          {[4,6,8,10,12,20,100].map(n=>(
            <button key={n} className={'btn'+(dice===n?' btn-primary':'')} onClick={()=>setDice(n)}>d{n}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>{const r=rollDice(dice);setLastRoll({die:dice,value:r,t:Date.now()});}}>Tira d{dice}</button>
        {lastRoll && (
          <div className="dice-display roll-anim" key={lastRoll.t} style={{marginTop:10}}>
            <div className="small muted" style={{fontFamily:'var(--font-body)',fontSize:10}}>d{lastRoll.die}</div>
            <div>{lastRoll.value}</div>
          </div>
        )}
      </div>
      {showBestiary && <BestiaryPopup s={s} update={update} campaignId={campaignId} combatScen={combatScen} onClose={()=>setShowBestiary(false)} />}
    </div>
  );
}
