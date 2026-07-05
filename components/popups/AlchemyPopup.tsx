'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { sfxComplete } from '@/lib/dnd/sounds';
import { U, ITEM_TYPES } from '@/components/shared/common';
import { copyRecipeImage } from '@/components/shared/imageCopy';


export function AlchemyPopup({ s, update, p, updPlayer, campaignId, onClose }: { s:CampaignState; update:U; p:any; updPlayer:any; campaignId:string|null; onClose:()=>void }) {
  const [toolId, setToolId] = useState('');
  const [slots, setSlots] = useState<string[]>(['', '', '']);
  const [mixing, setMixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<null|{success:boolean;recipe?:any}>(null);
  // DM recipe form
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [rTool, setRTool] = useState('');
  const [rIngr, setRIngr] = useState(['', '', '']);
  const [rName, setRName] = useState('');
  const [rType, setRType] = useState('consumabile');
  const [rEffect, setREffect] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rQty, setRQty] = useState(1);
  const [editingId, setEditingId] = useState<string|null>(null);

  const recipes: any[] = (s as any).alchemyRecipes || [];
  const alchemicItems = (p.inventory||[]).filter((i:any) => i.type === 'alchemico' && (i.qty||0) > 0 && (s.dmMode || (i as any).revealed !== false));
  const toolItems = (p.inventory||[]).filter((i:any) => i.type === 'altro' && (s.dmMode || (i as any).revealed !== false));
  const allItems = p.inventory || [];

  const setSlot = (idx:number, val:string) => {
    const next = [...slots];
    next[idx] = val;
    setSlots(next);
  };

  const getAvailableQty = (itemName:string, slotIdx:number) => {
    const item = alchemicItems.find((i:any) => i.name === itemName);
    if (!item) return 0;
    const usedElsewhere = slots.filter((s2,i) => i !== slotIdx && s2 === itemName).length;
    return Math.max(0, (item.qty||0) - usedElsewhere);
  };

  const performMix = async () => {
    const usedNames = slots.filter(s2 => s2 !== '');
    const ingredientCounts: Record<string,number> = {};
    usedNames.forEach(n => { ingredientCounts[n] = (ingredientCounts[n]||0) + 1; });

    const sortedUsed = [...usedNames].sort((a,b) => a.localeCompare(b));
    const tool = allItems.find((i:any) => i.id === toolId);
    const toolName = tool ? tool.name : '';

    const matched = recipes.find((r:any) => {
      const rSorted = [...(r.ingredients||[])].filter(Boolean).sort((a:string,b:string) => a.localeCompare(b));
      if (rSorted.length !== sortedUsed.length) return false;
      if (!rSorted.every((ing:string,idx:number) => ing.toLowerCase().trim() === sortedUsed[idx].toLowerCase().trim())) return false;
      if ((r.tool||'').toLowerCase().trim() !== toolName.toLowerCase().trim()) return false;
      return true;
    });

    const newItemId = uid('i');

    updPlayer((pl:any) => {
      let inv = pl.inventory.map((item:any) => {
        if (item.type === 'alchemico' && ingredientCounts[item.name]) {
          return { ...item, qty: Math.max(0, (item.qty||0) - ingredientCounts[item.name]) };
        }
        return item;
      });
      if (matched) {
        const res = matched.result;
        const existing = inv.find((i:any) => i.name === res.name);
        if (existing) {
          inv = inv.map((i:any) => i.id === existing.id ? { ...i, qty: (i.qty||0) + (res.qty||1), revealed: true } : i);
        } else {
          inv = [...inv, { id:newItemId, name:res.name, type:res.type||'consumabile', qty:res.qty||1,
            effect:res.effect||'', desc:res.desc||'', equipped:false, expanded:false, pu:0, revealed:true }];
        }
      }
      return { ...pl, inventory: inv };
    });

    if (matched) {
      const existing = (p.inventory||[]).find((i:any) => i.name === matched.result.name);
      if (!existing && campaignId) copyRecipeImage(campaignId, matched.id, newItemId);
      setResult({ success:true, recipe:matched });
      sfxComplete();
    } else {
      setResult({ success:false });
    }
    setMixing(false);
  };

  const doMix = () => {
    if (mixing) return;
    const usedNames = slots.filter(s2 => s2 !== '');
    if (usedNames.length === 0 || !toolId) return;
    setMixing(true);
    setProgress(0);
    setResult(null);
    const start = Date.now();
    const duration = 2500;
    const tick = () => {
      const pct = Math.min(100, Math.round(((Date.now()-start)/duration)*100));
      setProgress(pct);
      if (pct < 100) requestAnimationFrame(tick);
      else performMix();
    };
    requestAnimationFrame(tick);
  };

  const resetLab = () => { setSlots(['','','']); setToolId(''); setResult(null); setProgress(0); };

  // DM: add/edit recipe
  const saveRecipe = () => {
    if (!rName.trim() || !rTool.trim()) return;
    const ingredients = rIngr.filter(i => i.trim() !== '');
    if (ingredients.length < 2) return;
    if (editingId) {
      update(prev => ({ alchemyRecipes: ((prev as any).alchemyRecipes||[]).map((r:any) =>
        r.id === editingId ? { ...r, tool:rTool.trim(), ingredients, result:{ name:rName.trim(), type:rType, effect:rEffect, desc:rDesc, qty:rQty||1 } } : r
      ) } as any));
    } else {
      const id = uid('alc');
      update(prev => ({ alchemyRecipes: [...((prev as any).alchemyRecipes||[]), {
        id, tool:rTool.trim(), ingredients, result:{ name:rName.trim(), type:rType, effect:rEffect, desc:rDesc, qty:rQty||1 }
      }] } as any));
    }
    clearRecipeForm();
  };
  const clearRecipeForm = () => { setRTool(''); setRIngr(['','','']); setRName(''); setRType('consumabile'); setREffect(''); setRDesc(''); setRQty(1); setEditingId(null); setShowRecipeForm(false); };
  const editRecipe = (r:any) => { setRTool(r.tool); setRIngr([r.ingredients[0]||'',r.ingredients[1]||'',r.ingredients[2]||'']); setRName(r.result.name); setRType(r.result.type||'consumabile'); setREffect(r.result.effect||''); setRDesc(r.result.desc||''); setRQty(r.result.qty||1); setEditingId(r.id); setShowRecipeForm(true); };
  const delRecipe = (id:string) => { if(confirm('Eliminare questa ricetta?')) update(prev=>({alchemyRecipes:((prev as any).alchemyRecipes||[]).filter((r:any)=>r.id!==id)} as any)); };

  // Collect all known alchemic names for recipe dropdown suggestions
  const allAlchemicNames = [...new Set(([] as string[]).concat(
    alchemicItems.map((i:any) => i.name),
    ...s.players.map(pl => (pl.inventory||[]).filter((i:any)=>i.type==='alchemico').map((i:any)=>i.name))
  ))].sort();

  return (
    <div className="alchemy-overlay" onClick={e=>{if(e.target===e.currentTarget && !mixing) onClose();}}>
      <div className="alchemy-popup" style={{position:'relative',overflow:'hidden'}}>
        {/* Sfondo immagine + gradiente */}
        <div style={{position:'absolute',inset:0,zIndex:0}}>
          <ImageSlot slotId="alchemy-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="Alchemy bg" />
        </div>
        <div style={{position:'absolute',inset:0,zIndex:1,background:'linear-gradient(180deg, rgba(30,22,48,0) 0%, rgba(30,22,48,0.55) 25%, rgba(30,22,48,0.92) 50%, rgba(30,22,48,1) 70%)'}} />

        {/* Contenuto sopra sfondo */}
        <div style={{position:'relative',zIndex:2}}>

        {/* Header */}
        <div className="row" style={{justifyContent:'space-between',marginBottom:14}}>
          <div className="row" style={{gap:8}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5"><path d="M9 3h6v3a6 6 0 01-6 6v0a6 6 0 00-6 6v2a1 1 0 001 1h16a1 1 0 001-1v-2a6 6 0 00-6-6v0a6 6 0 01-6-6V3z"/><path d="M8 3h8" strokeLinecap="round"/></svg>
            <div className="h2" style={{color:'var(--green)',fontSize:17}}>Alchimia</div>
          </div>
          <div className="row" style={{gap:4}}>
            {s.dmMode && (
              <label className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9,cursor:'pointer',color:'var(--green)'}} title="Immagine sfondo">
                📷
                <input type="file" accept="image/*" style={{display:'none'}} onChange={async(e)=>{
                  const file=e.target.files?.[0]; if(!file||!campaignId)return;
                  const ext=(file.name.split('.').pop()||'png').toLowerCase();
                  const folder=campaignId;
                  const {data:ex}=await supabase.storage.from('campaign-images').list(folder,{search:'alchemy-bg'});
                  const old=(ex||[]).filter(f=>f.name.startsWith('alchemy-bg.')).map(f=>`${folder}/${f.name}`);
                  if(old.length) await supabase.storage.from('campaign-images').remove(old);
                  await supabase.storage.from('campaign-images').upload(`${folder}/alchemy-bg.${ext}`,file,{upsert:true,contentType:file.type});
                  window.location.reload();
                }} />
              </label>
            )}
            {!mixing && <button className="btn btn-ghost" style={{fontSize:16,padding:'2px 8px'}} onClick={onClose}>✕</button>}
          </div>
        </div>

        {/* Strumento */}
        <div className="label" style={{fontSize:9,marginBottom:4,color:'var(--green)'}}>Strumento</div>
        <select value={toolId} onChange={e=>setToolId(e.target.value)} disabled={mixing}
          style={{borderColor:'var(--green)',fontSize:13,marginBottom:8}}>
          <option value="">— Seleziona strumento —</option>
          {toolItems.map((it:any) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
        {toolId && (() => { const t = allItems.find((i:any) => i.id === toolId); return t ? (
          <div className="alchemy-tool-card">
            <div style={{width:80,height:80}}>
              <ImageSlot slotId={'item-'+t.id} campaignId={campaignId} shape="rounded" width={80} height={80} dmMode={false} placeholder="🔧" alt={t.name} />
            </div>
            <div style={{fontFamily:'var(--font-display)',fontSize:12,color:'var(--green)',letterSpacing:'.8px',marginTop:4}}>{t.name}</div>
          </div>
        ) : null; })()}

        {/* Ricettario — le ricette scoperte restano ai giocatori */}
        {(() => {
          const unlocked = recipes.filter((r:any) => r.unlocked);
          if (unlocked.length === 0) return null;
          const fill = (r:any) => {
            const wanted: string[] = (r.ingredients||[]).filter(Boolean).slice(0,3);
            const next = ['','',''];
            wanted.forEach((ing:string, i:number) => {
              const item = (p.inventory||[]).find((it:any)=>it.name===ing && (it.qty||0)>0);
              const alreadyPlaced = next.filter(x=>x===ing).length;
              if (item && (item.qty||0) > alreadyPlaced) next[i] = ing;
            });
            setSlots(next);
          };
          return (
            <div className="card" style={{marginBottom:10}}>
              <div className="label" style={{marginBottom:6}}>Ricettario di {p.short||p.name}</div>
              {unlocked.map((r:any) => {
                const missing = (r.ingredients||[]).filter((ing:string)=>ing && !(p.inventory||[]).some((it:any)=>it.name===ing && (it.qty||0)>0));
                return (
                  <div key={r.id} className="row" style={{gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
                    <div className="grow" style={{minWidth:140}}>
                      <div style={{fontSize:13,fontWeight:500,color:'var(--green-light)'}}>{r.result?.name}</div>
                      <div className="small muted" style={{fontSize:11}}>
                        {(r.ingredients||[]).filter(Boolean).join(' + ')} · {r.tool}
                        {missing.length>0 && <span style={{color:'var(--red)'}}> — manca: {missing.join(', ')}</span>}
                      </div>
                    </div>
                    <button className="btn" style={{fontSize:9,padding:'4px 10px',color:'var(--green)',borderColor:'var(--green)',flexShrink:0}}
                      onClick={()=>fill(r)} title="Porta gli ingredienti disponibili nei box di creazione">Prepara</button>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* Ingredienti */}
        <div className="label" style={{fontSize:9,marginBottom:6,marginTop:12,color:'var(--green)'}}>Ingredienti</div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
          {slots.map((slotVal,idx) => {
            const selItem = alchemicItems.find((i:any) => i.name === slotVal);
            return (
              <div key={idx} className="alchemy-slot">
                <select value={slotVal} onChange={e=>setSlot(idx,e.target.value)} disabled={mixing}
                  style={{fontSize:11,padding:'5px 4px',marginBottom:4,borderColor:'var(--green)',background:'var(--bg-deep)'}}>
                  <option value="">Nessuno</option>
                  {alchemicItems.map((it:any) => {
                    const avail = getAvailableQty(it.name, idx);
                    const alreadySelected = slotVal === it.name;
                    if (avail <= 0 && !alreadySelected) return null;
                    return <option key={it.id} value={it.name}>{it.name} ({alreadySelected ? avail : avail})</option>;
                  })}
                </select>
                <div style={{width:48,height:48,margin:'0 auto'}}>
                  {selItem ? (
                    <ImageSlot slotId={'item-'+selItem.id} campaignId={campaignId} shape="rounded" width={48} height={48} dmMode={false} placeholder="⚗" alt={selItem.name} />
                  ) : (
                    <div className="img-empty" style={{width:48,height:48,borderRadius:8,border:'1px dashed var(--border)',fontSize:18}}>⚗</div>
                  )}
                </div>
                {selItem && <div style={{textAlign:'center',fontSize:10,color:'var(--gray-purple)',marginTop:2}}>×{selItem.qty || 0}</div>}
              </div>
            );
          })}
        </div>

        {/* Pulsante Miscela */}
        <button className="alchemy-mix-btn" onClick={doMix}
          disabled={mixing || slots.every(s2=>s2==='') || !toolId}
          style={{opacity:(mixing||slots.every(s2=>s2==='')||!toolId)?0.5:1}}>
          <div className="alchemy-mix-bar" style={{width:progress+'%'}} />
          <span className="alchemy-mix-label">{mixing ? `${progress}%` : '⚗ Miscela'}</span>
        </button>

        {/* Risultato */}
        {result && (
          <div className={`alchemy-result ${result.success?'alchemy-success':'alchemy-fail'}`}>
            {result.success ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <div style={{width:80,height:80}}>
                  <ImageSlot slotId={'recipe-'+result.recipe.id} campaignId={campaignId} shape="rounded" width={80} height={80} dmMode={false} placeholder="✦" alt={result.recipe.result.name} />
                </div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:16,color:'var(--green)',textAlign:'center'}}>✦ {result.recipe.result.name}</div>
                {result.recipe.result.effect && <div style={{fontSize:13,color:'var(--gold)',textAlign:'center'}}>{result.recipe.result.effect}</div>}
                {result.recipe.result.desc && <div style={{fontSize:11,color:'var(--gray-purple)',textAlign:'center',fontStyle:'italic'}}>{result.recipe.result.desc}</div>}
                <div style={{fontSize:11,color:'var(--gray-purple-deep)',textAlign:'center'}}>Aggiunto all'inventario</div>
              </div>
            ) : (
              <div style={{textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:14,color:'var(--red)',fontWeight:600}}>✗ Miscela fallita</div>
                <div style={{fontSize:12,color:'var(--gray-purple)',marginTop:4}}>Gli ingredienti sono stati consumati.</div>
              </div>
            )}
            <button className="btn" style={{marginTop:10,width:'100%',fontSize:10}} onClick={resetLab}>Nuova miscela</button>
          </div>
        )}

        {/* DM: Ricettario */}
        {s.dmMode && (
          <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid var(--border)'}}>
            <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
              <div className="label" style={{color:'var(--green)'}}>Ricettario</div>
              <button className="btn" style={{fontSize:9,color:'var(--green)',borderColor:'var(--green)'}} onClick={()=>{clearRecipeForm();setShowRecipeForm(!showRecipeForm);}}>
                {showRecipeForm ? 'Chiudi' : '+ Nuova ricetta'}
              </button>
            </div>

            {/* Lista ricette esistenti */}
            {recipes.map((r:any) => (
              <div key={r.id} className="card" style={{borderLeft:'3px solid var(--green)',marginBottom:8}}>
                <div className="row" style={{gap:8,alignItems:'flex-start'}}>
                  <div style={{width:44,height:44,flexShrink:0}}>
                    <ImageSlot slotId={'recipe-'+r.id} campaignId={campaignId} shape="rounded" width={44} height={44} dmMode={s.dmMode} placeholder="⚗" alt={r.result.name} />
                  </div>
                  <div className="grow">
                    <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13,color:'var(--green)'}}>{r.result.name}</div>
                    <div style={{fontSize:11,color:'var(--gray-purple)',marginTop:2}}>
                      🔧 {r.tool} · {(r.ingredients||[]).join(' + ')}
                    </div>
                    {r.result.effect && <div style={{fontSize:11,color:'var(--gold)',marginTop:2}}>✦ {r.result.effect}</div>}
                    {r.result.desc && <div style={{fontSize:10,color:'var(--gray-purple)',fontStyle:'italic',marginTop:1}}>{r.result.desc}</div>}
                    <div style={{fontSize:10,color:'var(--gray-purple-deep)',marginTop:2}}>Tipo: {r.result.type} · Qtà: {r.result.qty||1}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <label className="row" style={{gap:3,fontSize:9,color:(r as any).unlocked?'var(--green)':'var(--gray-purple-deep)',cursor:'pointer',marginRight:2}} title="Ricetta scoperta dai giocatori">
                      <input type="checkbox" checked={!!(r as any).unlocked} style={{width:'auto'}}
                        onChange={e=>update(prev=>({alchemyRecipes:((prev as any).alchemyRecipes||[]).map((x:any)=>x.id===r.id?{...x,unlocked:e.target.checked}:x)} as any))} />
                      sbloccata
                    </label>
                    <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9}} onClick={()=>editRecipe(r)}>✎</button>
                    <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}} onClick={()=>delRecipe(r.id)}>✕</button>
                  </div>
                </div>
              </div>
            ))}
            {recipes.length===0 && <div className="small muted" style={{textAlign:'center',marginBottom:8}}>Nessuna ricetta configurata.</div>}

            {/* Form nuova/modifica ricetta */}
            {showRecipeForm && (
              <div className="card" style={{borderLeft:'3px solid var(--green)',background:'var(--bg-deep)'}}>
                <div className="label" style={{fontSize:9,marginBottom:6,color:'var(--green)'}}>{editingId?'Modifica ricetta':'Nuova ricetta'}</div>
                <input value={rTool} placeholder="Strumento richiesto (es. Pestello e mortaio)" onChange={e=>setRTool(e.target.value)}
                  style={{fontSize:12,padding:'5px 8px',marginBottom:4}} />
                <div className="label" style={{fontSize:8,marginBottom:3,marginTop:4}}>Ingredienti (2-3)</div>
                {rIngr.map((ing,idx) => (
                  <div key={idx} className="row" style={{gap:4,marginBottom:3}}>
                    <span className="small muted" style={{fontSize:10,width:10}}>{idx+1}.</span>
                    <input value={ing} placeholder={idx<2?'Ingrediente…':'Ingrediente (opzionale)'}
                      onChange={e=>{const next=[...rIngr];next[idx]=e.target.value;setRIngr(next);}}
                      list="alchemy-names"
                      style={{fontSize:12,padding:'4px 8px',flex:1}} />
                  </div>
                ))}
                <datalist id="alchemy-names">
                  {allAlchemicNames.map(n=><option key={n} value={n} />)}
                </datalist>
                <div className="label" style={{fontSize:8,marginBottom:3,marginTop:8}}>Prodotto</div>
                <input value={rName} placeholder="Nome prodotto" onChange={e=>setRName(e.target.value)}
                  style={{fontSize:12,padding:'5px 8px',marginBottom:4}} />
                <div className="row" style={{gap:4,marginBottom:4}}>
                  <select value={rType} onChange={e=>setRType(e.target.value)} style={{flex:1,fontSize:11,padding:'4px 6px'}}>
                    {ITEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="row" style={{gap:3}}>
                    <span className="small muted" style={{fontSize:10}}>Qtà</span>
                    <input type="number" value={rQty} min={1} onChange={e=>setRQty(parseInt(e.target.value)||1)}
                      style={{width:40,fontSize:11,padding:'3px 4px',textAlign:'center'}} />
                  </div>
                </div>
                <input value={rEffect} placeholder="Effetto (es. Recupera 2d4+2 PF)" onChange={e=>setREffect(e.target.value)}
                  style={{fontSize:12,padding:'5px 8px',marginBottom:4}} />
                <textarea value={rDesc} placeholder="Descrizione…" onChange={e=>setRDesc(e.target.value)}
                  style={{fontSize:12,padding:'5px 8px',minHeight:36,marginBottom:6}} />
                {editingId && (
                  <div style={{marginBottom:6}}>
                    <div className="label" style={{fontSize:8,marginBottom:3}}>Immagine prodotto</div>
                    <div style={{width:56,height:56}}>
                      <ImageSlot slotId={'recipe-'+editingId} campaignId={campaignId} shape="rounded" width={56} height={56} dmMode={true} placeholder="📷" alt={rName} />
                    </div>
                  </div>
                )}
                <div className="row" style={{gap:6}}>
                  <button className="btn btn-primary" style={{flex:1,color:'var(--green)',borderColor:'var(--green)'}} onClick={saveRecipe}>
                    {editingId?'Salva modifiche':'Aggiungi ricetta'}
                  </button>
                  <button className="btn btn-ghost" style={{fontSize:10}} onClick={clearRecipeForm}>Annulla</button>
                </div>
                {!editingId && <div className="small muted" style={{marginTop:4,fontSize:10,fontStyle:'italic'}}>L'immagine del prodotto può essere caricata dopo aver creato la ricetta.</div>}
              </div>
            )}
          </div>
        )}
        </div>{/* chiude z-index:2 content */}
      </div>
    </div>
  );
}
