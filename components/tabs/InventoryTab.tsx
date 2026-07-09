'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { PlayerSelector } from '@/components/shared/PlayerSelector';
import { AlchemyPopup } from '@/components/popups/AlchemyPopup';
import { ArmoryPopup } from '@/components/popups/ArmoryPopup';
import { U, moveInArray, ReorderBtns, computeAC, ITEM_TYPES } from '@/components/shared/common';
import { copyItemImage } from '@/components/shared/imageCopy';

const ITEM_TEMPLATES = [
  {name:'Pozione di cura',type:'consumabile',effect:'Recupera 2d4+2 PF',desc:'Liquido rosso che luccica quando viene agitato.'},
  {name:'Pozione di cura superiore',type:'consumabile',effect:'Recupera 4d4+4 PF',desc:'Liquido rosso brillante, più denso della versione base.'},
  {name:'Pozione di cura maggiore',type:'consumabile',effect:'Recupera 8d4+8 PF',desc:'Liquido cremisi con riflessi dorati.'},
  {name:'Razione giornaliera',type:'consumabile',effect:'Nutrimento per 1 giorno',desc:'Carne secca, frutta disidratata, gallette.'},
  {name:'Torcia',type:'equipaggiamento',effect:'Luce intensa 6m, luce fioca altri 6m. Dura 1 ora.',desc:''},
  {name:'Corda di canapa (15m)',type:'equipaggiamento',effect:'',desc:'Resistente, utile per scalare o legare.'},
  {name:'Arnesi da scasso',type:'equipaggiamento',effect:'Necessari per scassinare serrature (prova Destrezza)',desc:''},
  {name:'Kit da guaritore',type:'equipaggiamento',effect:'10 usi. Stabilizza una creatura a 0 PF.',desc:''},
  {name:'Spada lunga',type:'arma',effect:'1d8 tagliente (versatile 1d10)',desc:''},
  {name:'Spada corta',type:'arma',effect:'1d6 perforante (accuratezza, leggera)',desc:''},
  {name:'Arco lungo',type:'arma',effect:'1d8 perforante (munizioni, portata 45/180m, a due mani, pesante)',desc:''},
  {name:'Pugnale',type:'arma',effect:'1d4 perforante (accuratezza, leggera, lancio 6/18m)',desc:''},
  {name:'Ascia a due mani',type:'arma',effect:'1d12 tagliente (pesante, a due mani)',desc:''},
  {name:'Mazza',type:'arma',effect:'1d6 contundente',desc:''},
  {name:'Balestra leggera',type:'arma',effect:'1d8 perforante (munizioni, portata 24/96m, caricamento, a due mani)',desc:''},
  {name:'Armatura di cuoio',type:'armatura',effect:'CA 11 + mod DES',desc:''},
  {name:'Armatura di cuoio borchiato',type:'armatura',effect:'CA 12 + mod DES',desc:''},
  {name:'Cotta di maglia',type:'armatura',effect:'CA 16 (FOR 13 richiesta, svantaggio Furtività)',desc:''},
  {name:'Scudo',type:'armatura',effect:'+2 CA',desc:''},
  {name:"Monete d'oro",type:'tesoro',effect:'',desc:''},
  {name:"Monete d'argento",type:'tesoro',effect:'',desc:''},
  {name:"Monete di rame",type:'tesoro',effect:'',desc:''},
  {name:'Gemma',type:'tesoro',effect:'',desc:'Valore variabile a seconda del tipo.'},
];


// ─── TAB: INVENTARIO ─────────────────────────────────────────
export function InventoryTab({ s, update, updPlayer, p, campaignId }: { s:CampaignState; update:U; updPlayer:any; p:any; campaignId:string|null }) {
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState('equipaggiamento');
  const [filter, setFilter] = useState('indossato');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  const [showAlchemy, setShowAlchemy] = useState(false);
  const [showArmory, setShowArmory] = useState(false);
  const setItemField = (iid:string, f:string, v:any) => updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===iid?{...i,[f]:v}:i)}));
  const toggleExpand = (iid:string) => updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===iid?{...i,expanded:!i.expanded}:i)}));

  // Sposta oggetto a un altro PG
  const moveItem = (item:any, targetId:string) => {
    const newId = uid('i');
    update(prev => ({
      players: prev.players.map(pl => {
        if (pl.id === p.id) return {...pl, inventory: pl.inventory.filter((i:any)=>i.id!==item.id)};
        if (pl.id === targetId) return {...pl, inventory: [...pl.inventory, {...item, id:newId}]};
        return pl;
      })
    }));
    if (campaignId) copyItemImage(campaignId, item.id, newId);
  };
  // Copia oggetto a un altro PG (duplica nome, effetto, desc, tipo)
  const copyItem = (item:any, targetId:string) => {
    const newId = uid('i');
    update(prev => ({
      players: prev.players.map(pl => {
        if (pl.id === targetId) return {...pl, inventory: [...pl.inventory, {
          ...item, id:newId, qty:1, equipped:false, expanded:false, enhUsed:0
        }]};
        return pl;
      })
    }));
    if (campaignId) copyItemImage(campaignId, item.id, newId);
  };
  // Calcola gradiente per potenziamento
  const getEnhGradient = (it:any) => {
    const enh = it.enhUsed || 0;
    if (enh === 0 && it.type !== 'magico' && it.type !== 'unico') return undefined;
    if (it.type === 'magico') {
      const base = enh > 0 ? .22 + enh * .12 : .22;
      return `linear-gradient(90deg, rgba(80,140,220,${base}) 0%, var(--bg-input) 40%)`;
    }
    if (it.type === 'unico') {
      const base = enh > 0 ? .2 + enh * .12 : .2;
      return `linear-gradient(90deg, rgba(180,50,90,${base}) 0%, var(--bg-input) 40%)`;
    }
    if (enh > 0) {
      const pColor = p.color || '#a489dd';
      const intensity = [0, .18, .3, .45][Math.min(enh, 3)];
      return `linear-gradient(90deg, ${pColor}${Math.round(intensity*255).toString(16).padStart(2,'0')} 0%, var(--bg-input) 40%)`;
    }
    return undefined;
  };

  const allItems = [...(p.inventory||[])].sort((a:any,b:any)=>(b.equipped?1:0)-(a.equipped?1:0));
  const visibleItems = s.dmMode ? allItems : allItems.filter((it:any)=>it.revealed!==false);
  const filtered = filter==='indossato' ? visibleItems.filter((it:any)=>it.equipped) : visibleItems.filter((it:any)=>it.type===filter);

  return (
    <div>
      {/* Overlay immagine ingrandita */}
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      {showAlchemy && <AlchemyPopup s={s} update={update} p={p} updPlayer={updPlayer} campaignId={campaignId} onClose={()=>setShowAlchemy(false)} />}
      {showArmory && <ArmoryPopup s={s} update={update} campaignId={campaignId} onClose={()=>setShowArmory(false)} />}
      <PlayerSelector s={s} update={update} p={p} campaignId={campaignId} />
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div className="label">Inventario</div>
          <div className="row" style={{gap:6}}>
          {s.dmMode && (
            <button className="alchemy-box-btn" onClick={()=>setShowArmory(true)} style={{borderColor:'var(--gold-dim)'}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6l-8 8M6.5 20L4 17.5l3-3M14 4l6 6M4 20l3.5-.5L20 7l-3-3L4.5 16.5 4 20z"/></svg>
              <span>Armeria</span>
            </button>
          )}
          <button className="alchemy-box-btn" onClick={()=>setShowAlchemy(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h6v3a6 6 0 01-6 6v0a6 6 0 00-6 6v2a1 1 0 001 1h16a1 1 0 001-1v-2a6 6 0 00-6-6v0a6 6 0 01-6-6V3z"/><path d="M8 3h8" strokeLinecap="round"/></svg>
            <span>Alchimia</span>
          </button>
          </div>
        </div>
        {/* Filtri per tipo */}
        <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:10}}>
          {['indossato',...ITEM_TYPES].map(t => (
            <button key={t} className="pill" style={{cursor:'pointer',padding:'4px 10px',fontSize:9,
              background:filter===t?'var(--bg-active)':'transparent',
              borderColor:filter===t?'var(--gold)':'var(--border)',
              color:filter===t?'var(--gold)':'var(--gray-purple-deep)'}}
              onClick={()=>setFilter(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun oggetto.</div>}
        {filtered.map((it:any) => (
          <div key={it.id} className="card" style={{
            borderLeft: it.equipped ? '3px solid '+(p.color||'var(--gold)') : '3px solid transparent',
            background: getEnhGradient(it) || (it.type==='magico' ? 'linear-gradient(90deg, rgba(80,140,220,.22) 0%, var(--bg-input) 40%)' :
                        it.type==='unico'  ? 'linear-gradient(90deg, rgba(180,50,90,.2) 0%, var(--bg-input) 40%)' :
                        undefined)
          }}>
            <div className="row" style={{alignItems:'flex-start'}}>
              <button onClick={()=>{
                  if (it.type === 'armatura') {
                    updPlayer((pl:any)=>{
                      const newInv = pl.inventory.map((i:any) => i.id===it.id ? {...i, equipped:!it.equipped} : i);
                      const newPl = {...pl, inventory:newInv};
                      return {...newPl, ac: computeAC(newPl)};
                    });
                  } else {
                    setItemField(it.id,'equipped',!it.equipped);
                  }
                }}
                title={it.equipped?'Rimuovi equipaggiamento':'Equipaggia'}
                style={{width:28,height:28,borderRadius:4,border:'1px solid '+(it.equipped?p.color||'var(--gold)':'var(--border)'),background:it.equipped?(p.color||'var(--gold)')+'22':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginTop:6,marginRight:6,fontSize:14,color:it.equipped?p.color||'var(--gold)':'var(--gray-purple-deep)'}}>
                {it.equipped ? '⚔' : '○'}
              </button>
              <div style={{width:42,height:42,flexShrink:0,cursor:'pointer',overflow:'hidden',borderRadius:6}}
                onClick={e=>{e.stopPropagation();const img=document.querySelector(`[data-slot="item-${it.id}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
                <div data-slot={'item-'+it.id} style={{width:42,height:42}}>
                  <ImageSlot slotId={'item-'+it.id} campaignId={campaignId} shape="rounded" width={42} height={42} dmMode={s.dmMode} placeholder=" " alt={it.name} />
                </div>
              </div>
              <div className="grow" style={{marginLeft:10,cursor:'pointer'}} onClick={()=>toggleExpand(it.id)}>
                {s.dmMode ? (
                  <input value={it.name} onClick={e=>e.stopPropagation()} onChange={e=>setItemField(it.id,'name',e.target.value)}
                    style={{fontWeight:500,background:'transparent',border:'1px solid var(--border)',padding:'3px 8px',marginBottom:3,fontSize:14}} />
                ) : (
                  <div style={{fontWeight:500}}>{it.name}{((it as any).upgrades||[]).length>0 && <span title="Potenziato in fucina" style={{color:'var(--ember)',marginLeft:4,fontSize:12}}>⚒</span>}</div>
                )}
                <div className="small muted">{it.type}</div>
              </div>
              <div className="row" style={{gap:3,flexShrink:0}}>
                <button className="btn" style={{padding:'2px 6px',fontSize:11}} onClick={()=>setItemField(it.id,'qty',Math.max(0,(it.qty||0)-1))}>−</button>
                <input type="number" value={it.qty||0}
                  onChange={e=>setItemField(it.id,'qty',Math.max(0,parseInt(e.target.value)||0))}
                  style={{width:44,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:14,fontWeight:600,color:'var(--text)',padding:'2px 0',borderRadius:4}} />
                <button className="btn" style={{padding:'2px 6px',fontSize:11}} onClick={()=>setItemField(it.id,'qty',(it.qty||0)+1)}>+</button>
              </div>
              {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.filter((i:any)=>i.id!==it.id)}))}>&times;</button>}
              {s.dmMode && (
                <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9,flexShrink:0}}
                  onClick={()=>setItemField(it.id,'revealed',it.revealed===false?true:false)}
                  title={it.revealed===false?'Rivela':'Nascondi'}>{it.revealed===false?'◯':'◉'}</button>
              )}
              <ReorderBtns
                onUp={()=>{const idx=(p.inventory||[]).findIndex((i:any)=>i.id===it.id);updPlayer((pl:any)=>({...pl,inventory:moveInArray(pl.inventory,idx,-1)}));}}
                onDown={()=>{const idx=(p.inventory||[]).findIndex((i:any)=>i.id===it.id);updPlayer((pl:any)=>({...pl,inventory:moveInArray(pl.inventory,idx,1)}));}}
              />
            </div>
            {/* Dettagli espandibili */}
            {it.expanded && (
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                {s.dmMode ? (
                  <>
                    <select value={it.type||'altro'} onChange={e=>setItemField(it.id,'type',e.target.value)} style={{fontSize:12,padding:'3px 6px',marginBottom:4}}>
                      {ITEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    {it.type === 'armatura' && (
                      <div className="row" style={{gap:6,marginBottom:4}}>
                        <div className="row" style={{gap:3,flex:1}}>
                          <span className="label" style={{fontSize:8}}>Tipo</span>
                          <select value={it.armorType||''} onChange={e=>{
                            const val=e.target.value;
                            updPlayer((pl:any)=>{
                              const newInv=pl.inventory.map((i:any)=>i.id===it.id?{...i,armorType:val}:i);
                              const newPl={...pl,inventory:newInv};
                              return it.equipped ? {...newPl,ac:computeAC(newPl)} : newPl;
                            });
                          }} style={{fontSize:11,padding:'2px 4px',flex:1}}>
                            <option value="">—</option>
                            <option value="leggera">Leggera</option>
                            <option value="media">Media</option>
                            <option value="pesante">Pesante</option>
                            <option value="scudo">Scudo</option>
                          </select>
                        </div>
                        <div className="row" style={{gap:3}}>
                          <span className="label" style={{fontSize:8}}>CA</span>
                          <input type="number" value={it.armorCA||0} onChange={e=>{
                            const v=parseInt(e.target.value)||0;
                            updPlayer((pl:any)=>{
                              const newInv=pl.inventory.map((i:any)=>i.id===it.id?{...i,armorCA:v}:i);
                              const newPl={...pl,inventory:newInv};
                              return it.equipped ? {...newPl,ac:computeAC(newPl)} : newPl;
                            });
                          }} style={{width:44,textAlign:'center',fontSize:12,padding:'2px 4px'}} />
                        </div>
                      </div>
                    )}
                    <textarea value={it.effect||''} placeholder="Effetto (es. +1 ai tiri per colpire)" onChange={e=>setItemField(it.id,'effect',e.target.value)} style={{fontSize:13,padding:'6px 8px',minHeight:36,marginBottom:4}} />
                    <textarea value={it.desc||''} placeholder="Descrizione oggetto…" onChange={e=>setItemField(it.id,'desc',e.target.value)} style={{fontSize:13,padding:'6px 8px',minHeight:36}} />
                  </>
                ) : (
                  <>
                    {it.effect && <div style={{fontSize:14,lineHeight:1.5,color:'var(--gold)',marginBottom:4}}>✦ {it.effect}</div>}
                    <div style={{fontSize:14,lineHeight:1.5,fontStyle:'italic'}}>{it.desc||<span className="muted small" style={{fontStyle:'normal'}}>(nessuna descrizione)</span>}</div>
                    {/* Potenziamenti di fucina — si aggiornano da soli al termine del lavoro */}
                    {((it as any).upgrades||[]).length>0 && (
                      <div style={{marginTop:8,padding:'8px 10px',borderRadius:6,background:'var(--bg-deep)',border:'1px solid var(--ember)'}}>
                        <div className="label" style={{fontSize:8,color:'var(--ember)',marginBottom:4}}>⚒ Potenziamenti</div>
                        {((it as any).upgrades||[]).map((u:any,i:number)=>(
                          <div key={i} className="small" style={{lineHeight:1.5,marginBottom:2}}>
                            <span style={{color:'var(--ember)',fontWeight:600}}>{u.name}</span>
                            {u.desc && <span style={{color:'var(--text-card)'}}> — {u.desc}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {/* Punti Usura — solo per arma, armatura, magico e unico */}
                {(it.type==='arma'||it.type==='armatura'||it.type==='magico'||it.type==='unico') && (
                  <div className="row" style={{gap:6,marginTop:6}}>
                    <span className="label" style={{fontSize:9}}>PU</span>
                    <input type="number" value={it.pu??0} onChange={e=>setItemField(it.id,'pu',Math.max(0,parseInt(e.target.value)||0))}
                      style={{width:44,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:13,color:((it.pu??0)>0)?'var(--red)':'var(--gray-purple)',padding:'2px 4px',borderRadius:4}} />
                    <span className="small muted">Punti Usura</span>
                  </div>
                )}
                {/* Cerchi potenziamento — arma, armatura, magico */}
                {(it.type==='arma'||it.type==='armatura'||it.type==='magico'||it.type==='unico') && (
                  <div className="row" style={{gap:8,marginTop:6}}>
                    <span className="label" style={{fontSize:9}}>Potenziamenti</span>
                    {[0,1,2].map(i => {
                      const maxSlots = it.enhSlots ?? 0;
                      const used = it.enhUsed ?? 0;
                      if (i >= maxSlots && !s.dmMode) return null;
                      const isFilled = i < used;
                      return i < maxSlots ? (
                        <button key={i} onClick={()=>setItemField(it.id,'enhUsed',isFilled ? Math.max(0,used-1) : Math.min(maxSlots,used+1))}
                          title={isFilled?'Potenziamento attivo':'Slot libero'}
                          style={{width:24,height:24,padding:0,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <svg width="20" height="20" viewBox="0 0 24 24" style={{transition:'all .15s'}}
                            fill={isFilled?'var(--ember)':'none'} stroke={isFilled?'var(--ember)':'var(--border)'} strokeWidth="1.6" strokeLinejoin="round">
                            <path d="M14 4l6 6-2 2-2-1-6.5 6.5a2.1 2.1 0 11-3-3L13 8l-1-2 2-2z"/>
                            <path d="M3 21l3-3" fill="none"/>
                          </svg>
                        </button>
                      ) : null;
                    })}
                    {s.dmMode && (
                      <div className="row" style={{gap:2,marginLeft:'auto'}}>
                        <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setItemField(it.id,'enhSlots',Math.max(0,(it.enhSlots??0)-1))}>−</button>
                        <span className="small muted">{it.enhSlots??0}/3</span>
                        <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setItemField(it.id,'enhSlots',Math.min(3,(it.enhSlots??0)+1))}>+</button>
                      </div>
                    )}
                  </div>
                )}
                {/* Sposta / Copia a un altro PG */}
                {s.dmMode && (
                  <div className="row" style={{gap:6,marginTop:8,flexWrap:'wrap'}}>
                    <select style={{flex:1,fontSize:11,padding:'4px 6px'}} defaultValue="" onChange={e=>{if(e.target.value){moveItem(it,e.target.value);} e.target.value='';}}>
                      <option value="" disabled>Sposta a…</option>
                      {s.players.filter(pl=>pl.id!==p.id).map(pl=><option key={pl.id} value={pl.id}>{pl.name}</option>)}
                    </select>
                    <select style={{flex:1,fontSize:11,padding:'4px 6px'}} defaultValue="" onChange={e=>{if(e.target.value){copyItem(it,e.target.value);} e.target.value='';}}>
                      <option value="" disabled>Copia a…</option>
                      {s.players.filter(pl=>pl.id!==p.id).map(pl=><option key={pl.id} value={pl.id}>{pl.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {s.dmMode && (
          <div style={{marginTop:10}}>
            {/* Template oggetti comuni */}
            <div className="row" style={{gap:6,marginBottom:6}}>
              <select style={{flex:1,fontSize:12,padding:'5px 6px'}} defaultValue="" onChange={e=>{
                const tpl = ITEM_TEMPLATES.find(t=>t.name===e.target.value);
                if(tpl){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),...tpl,qty:1,expanded:false,equipped:false}]}));}
                e.target.value='';
              }}>
                <option value="" disabled>Inserisci da modello…</option>
                {ITEM_TEMPLATES.map(t=><option key={t.name} value={t.name}>{t.name} ({t.type})</option>)}
              </select>
            </div>
            <div className="row" style={{gap:6,marginBottom:6}}>
              <input className="grow" placeholder="…oppure crea nuovo" value={draftName} onChange={e=>setDraftName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&draftName.trim()){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),name:draftName.trim(),qty:1,type:draftType,desc:'',effect:'',expanded:false,equipped:false,pu:0}]}));setDraftName('');}}} />
              <button className="btn btn-primary" onClick={()=>{if(draftName.trim()){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),name:draftName.trim(),qty:1,type:draftType,desc:'',effect:'',expanded:false,equipped:false,pu:0}]}));setDraftName('');}}}>+</button>
            </div>
            <select value={draftType} onChange={e=>setDraftType(e.target.value)}>
              {ITEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
