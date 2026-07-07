'use client';
import { useState, useEffect } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { ImageSlot, registerStorageFile, getFolderIndex } from '@/components/ImageSlot';
import { sfxReveal, sfxComplete } from '@/lib/dnd/sounds';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';

// ─── TAB: QUEST ──────────────────────────────────────────────
// Ogni scenario è un box ripiegabile sul modello della Fucina di Durna:
// l'apertura è locale (accordion, un solo box aperto per dispositivo),
// mentre cliccare la testata imposta anche activeScenario, condiviso via
// Supabase — l'oro segnala a tutto il tavolo lo scenario in gioco, mentre
// l'apertura resta la consultazione privata del singolo commensale.
export function QuestsTab({ s, update, updScen, sc, campaignId }: { s:CampaignState; update:U; updScen:(fn:(sc:any)=>any)=>void; sc:any; campaignId:string|null }) {
  const sub = s.questSubTab || 'main';
  const visibleScenarios = s.dmMode ? s.scenarios : s.scenarios.filter((sc2:any)=>sc2.revealed!==false);
  // Apertura locale: di default segue lo scenario attivo condiviso, così
  // all'avvio il box in gioco appare già aperto senza propagare nulla.
  const [openScen, setOpenScen] = useState<string>(s.activeScenario || '');
  const [draft, setDraft] = useState('');
  const [newScenName, setNewScenName] = useState('');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  // Censimento degli slot immagine presenti nel bucket: consente di sapere,
  // per ogni scenario, se esiste la variante 'aperto' oltre a quella 'chiuso',
  // e quindi di scegliere il fallback quando una delle due manca. Sfrutta lo
  // stesso indice condiviso di ImageSlot: nessuna chiamata di rete aggiuntiva.
  const imgFolder = campaignId || '_default';
  const [existingSlots, setExistingSlots] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { const idx = await getFolderIndex(imgFolder); if (!cancelled) setExistingSlots(new Set(idx.keys())); }
      catch { /* indice non disponibile: si ricade sui default naturali */ }
    })();
    return () => { cancelled = true; };
  }, [imgFolder]);

  // Aprire un box: accordion locale (chiude gli altri) + promozione a
  // scenario attivo sul canale condiviso. Ri-cliccare la testata di un box
  // già aperto lo richiude, senza toccare activeScenario.
  const openBox = (id:string) => {
    if (openScen === id) { setOpenScen(''); return; }
    setOpenScen(id);
    if (s.activeScenario !== id) update({ activeScenario:id });
  };

  // CRUD scenari
  const addScenario = () => {
    if (!newScenName.trim()) return;
    const id = uid('sc');
    update(prev => ({
      scenarios: [...prev.scenarios, {id, name:newScenName.trim(), status:'futuro' as const, quests:[], revealed:true} as any],
      activeScenario: id,
    }));
    setOpenScen(id);
    setNewScenName('');
  };
  const delScenario = (id:string) => {
    if (!confirm('Eliminare questo scenario e tutte le sue quest?')) return;
    update(prev => ({
      scenarios: prev.scenarios.filter(sc2=>sc2.id!==id),
      activeScenario: prev.scenarios.find(sc2=>sc2.id!==id)?.id || '',
    }));
    if (openScen === id) setOpenScen('');
  };
  const toggleScenReveal = (id:string) => {
    update(prev => ({scenarios: prev.scenarios.map(sc2=>sc2.id===id?{...sc2,revealed:(sc2 as any).revealed===false?true:false} as any:sc2)}));
  };
  const moveScen = (id:string, dir:-1|1) => {
    const idx = s.scenarios.findIndex(sc2=>sc2.id===id);
    update(prev => ({scenarios: moveInArray(prev.scenarios, idx, dir)}));
  };

  return (
    <div>
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}

      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Scenari</div>

        {visibleScenarios.map(sc2 => {
          const isActive = sc2.id === s.activeScenario;
          const isOpen = sc2.id === openScen;
          const concluso = sc2.status === 'concluso';
          // updThisScen àncora l'editing all'id di QUESTO box, non allo
          // scenario attivo: robusto anche se un altro dispositivo cambia
          // activeScenario mentre il box resta aperto localmente.
          const updThisScen = (fn:(x:any)=>any) => update(prev => ({scenarios: prev.scenarios.map(x=>x.id===sc2.id?fn(x):x)}));
          // Due varianti d'immagine: 'chiuso' (orizzontale) e 'aperto'
          // (verticale). Si mostra quella dello stato corrente; se assente,
          // si ripiega sull'altra. Finché l'indice non è caricato, si usa lo
          // slot naturale dello stato, per non produrre un lampo di fallback.
          const closedSlot = 'scenario-'+sc2.id;
          const openSlot = 'scenario-'+sc2.id+'-open';
          const hasClosed = existingSlots.has(closedSlot);
          const hasOpen = existingSlots.has(openSlot);
          const shownSlot = isOpen
            ? (hasOpen ? openSlot : (hasClosed ? closedSlot : openSlot))
            : (hasClosed ? closedSlot : (hasOpen ? openSlot : closedSlot));
          const uploadSlot = isOpen ? openSlot : closedSlot;
          const scQuests = (sc2 as any).quests || [];
          const subQuests = scQuests.filter((q:any)=>q.type===sub);
          const visibleQuests = s.dmMode ? subQuests : subQuests.filter((q:any)=>q.revealed);

          return (
          <div key={sc2.id} className={isActive ? (concluso ? 'pulse-green' : 'pulse-gold') : undefined}
            style={{position:'relative',overflow:'hidden',borderRadius:8,marginBottom:8,
              border:isActive?(concluso?'1px solid var(--green)':'1px solid var(--gold)'):'1px solid var(--border)',
              minHeight:isOpen?undefined:72,transition:'all .2s'}}>

            {/* Immagine di sfondo — slot unico, letto sia da chiuso sia da aperto */}
            <div style={{position:'absolute',inset:0,zIndex:0}}>
              <div data-slot={shownSlot} style={{width:'100%',height:'100%'}}>
                <ImageSlot key={shownSlot+(isOpen?'-o':'-c')} slotId={shownSlot} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt={sc2.name} />
              </div>
            </div>

            {/* Gradiente — verticale disteso da aperto (scuro in basso, sul
                modello Fucina, ed esteso a coprire tutta l'area per la
                leggibilità del pannello DM); orizzontale da chiuso, colorato
                se attivo (oro / verde), scuro se inattivo. */}
            <div style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',transition:'background .3s',background:isOpen
              ? (isActive
                ? (concluso
                  ? 'linear-gradient(180deg, rgba(18,30,24,0) 0%, rgba(18,30,24,.55) 22%, rgba(18,30,24,.92) 42%, rgba(18,30,24,.97) 60%, rgba(18,30,24,.99) 100%)'
                  : 'linear-gradient(180deg, rgba(28,24,14,0) 0%, rgba(28,24,14,.55) 22%, rgba(28,24,14,.92) 42%, rgba(28,24,14,.97) 60%, rgba(28,24,14,.99) 100%)')
                : 'linear-gradient(180deg, rgba(11,8,20,0) 0%, rgba(11,8,20,.55) 22%, rgba(11,8,20,.92) 42%, rgba(11,8,20,.97) 60%, rgba(11,8,20,.99) 100%)')
              : (isActive
                ? (concluso
                  ? 'linear-gradient(90deg, rgba(98,185,138,.8) 0%, rgba(98,185,138,.3) 45%, rgba(98,185,138,0) 100%)'
                  : 'linear-gradient(90deg, rgba(216,180,92,.8) 0%, rgba(216,180,92,.3) 45%, rgba(216,180,92,0) 100%)')
                : 'linear-gradient(90deg, rgba(11,8,20,.92) 0%, rgba(11,8,20,.4) 50%, rgba(11,8,20,0) 100%)')}} />

            <div style={{position:'relative',zIndex:2,padding:isOpen?16:'14px 16px'}}>

              {/* Testata — cliccabile: apre/chiude il box e promuove ad attivo */}
              <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>openBox(sc2.id)}>
                <div className="grow">
                  <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:600,letterSpacing:'.5px',transition:'color .2s',
                    color:(isActive && !isOpen)?'var(--bg-deep)':'var(--text)'}}>{sc2.name}</div>
                  {s.dmMode && (sc2 as any).revealed===false && <span className="dm-badge" style={{marginTop:4}}>NASCOSTO</span>}
                </div>
                <div className={'pill scen-'+sc2.status} style={{padding:'3px 8px',fontSize:8,flexShrink:0,background:(isActive && !isOpen)?'rgba(11,8,20,.5)':'rgba(11,8,20,.6)'}}>{sc2.status}</div>
                {s.dmMode && (
                  <div className="row" style={{gap:2}} onClick={e=>e.stopPropagation()}>
                    <ReorderBtns onUp={()=>moveScen(sc2.id,-1)} onDown={()=>moveScen(sc2.id,1)} />
                    <label className="btn btn-ghost" style={{padding:'2px 5px',fontSize:9,cursor:'pointer'}} title={isOpen?'Immagine box aperto (verticale)':'Immagine box chiuso (orizzontale)'}>
                      {isOpen?'📷▯':'📷▭'}
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={async(e)=>{
                        const file=e.target.files?.[0]; if(!file||!campaignId)return;
                        const ext=(file.name.split('.').pop()||'png').toLowerCase();
                        const slotId=uploadSlot;
                        const folder=campaignId;
                        try{
                          const{data:ex}=await supabase.storage.from('campaign-images').list(folder,{search:slotId});
                          const rm=(ex||[]).filter((f:any)=>f.name.startsWith(slotId+'.')).map((f:any)=>`${folder}/${f.name}`);
                          if(rm.length) await supabase.storage.from('campaign-images').remove(rm);
                          const vName=`${slotId}.${Date.now().toString(36)}.${ext}`;
                          await supabase.storage.from('campaign-images').upload(`${folder}/${vName}`,file,{upsert:true,cacheControl:'31536000',contentType:file.type});
                          await registerStorageFile(campaignId, vName);
                          window.location.reload();
                        }catch(err:any){alert('Errore: '+(err.message||err));}
                        e.target.value='';
                      }} />
                    </label>
                    <button className="btn btn-ghost" style={{padding:'2px 5px',fontSize:9}}
                      onClick={()=>toggleScenReveal(sc2.id)} title={(sc2 as any).revealed===false?'Mostra':'Nascondi'}>
                      {(sc2 as any).revealed===false?'◯':'◉'}
                    </button>
                    <button className="btn btn-danger btn-ghost" style={{padding:'2px 5px',fontSize:9}}
                      onClick={()=>delScenario(sc2.id)}>&times;</button>
                  </div>
                )}
                <span style={{fontSize:14,color:isActive?(concluso?'var(--green)':'var(--gold)'):'var(--gray-purple)',transition:'transform .2s',transform:isOpen?'rotate(180deg)':'',marginLeft:4}}>▾</span>
              </div>

              {/* ── Corpo del box, visibile solo da aperto ── */}
              {isOpen && (
                <div style={{marginTop:12}} onClick={e=>e.stopPropagation()}>

                  {/* Presentazione / editing nome e stato */}
                  {s.dmMode ? (
                    <div className="card">
                      <input value={sc2.name||''} onChange={e=>updThisScen(x=>({...x,name:e.target.value}))}
                        className="grow" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,color:'var(--gold)',background:'transparent',border:'1px solid var(--border)',padding:'4px 10px',width:'100%',marginBottom:6}} />
                      <div className="row" style={{gap:6,marginBottom:6}}>
                        {(['futuro','corso','concluso'] as const).map(st => (
                          <button key={st} className={'btn'+(sc2.status===st?' btn-primary':'')} onClick={()=>updThisScen(x=>({...x,status:st}))}>{st}</button>
                        ))}
                      </div>
                      <textarea value={(sc2 as any).scenDesc||''} placeholder="Breve presentazione dello scenario (visibile ai giocatori)…"
                        onChange={e=>updThisScen(x=>({...x,scenDesc:e.target.value}))}
                        style={{fontSize:12,padding:'6px 8px',minHeight:32,width:'100%',marginBottom:6}} />
                      <textarea value={(sc2 as any).dmNotes||''} placeholder="Note DM (non visibili ai giocatori)…"
                        onChange={e=>updThisScen(x=>({...x,dmNotes:e.target.value}))}
                        style={{fontSize:13,padding:'6px 8px',minHeight:36,borderColor:'var(--gold)',borderStyle:'dashed',width:'100%'}} />
                    </div>
                  ) : (
                    (sc2 as any).scenDesc && <div className="card" style={{fontSize:12,fontStyle:'italic',color:'var(--text)',lineHeight:1.5,opacity:.95}}>{(sc2 as any).scenDesc}</div>
                  )}

                  {/* Sottomenù Principali / Secondarie */}
                  <div className="row" style={{gap:6,marginBottom:10,marginTop:2}}>
                    <button className={'btn'+(sub==='main'?' btn-primary':'')} onClick={()=>update({questSubTab:'main'})}>Principali</button>
                    <button className={'btn'+(sub==='side'?' btn-primary':'')} onClick={()=>update({questSubTab:'side'})}>Secondarie</button>
                  </div>

                  {visibleQuests.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessuna quest.</div>}

                  {visibleQuests.map((q:any) => (
                    <div key={q.id} className="card">
                      <div className="row" style={{alignItems:'flex-start'}}>
                        <button onClick={()=>{const wasDone=scQuests.find((qq:any)=>qq.id===q.id)?.done;if(!wasDone)sfxComplete();updThisScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,done:!qq.done}:qq)}));}}
                          style={{width:20,height:20,borderRadius:4,marginTop:2,border:'1px solid '+(q.done?'var(--green)':'var(--border)'),
                            background:q.done?'var(--green)':'var(--bg-deep)',color:'var(--bg-deep)',fontSize:13,lineHeight:1,flexShrink:0}}>
                          {q.done?'✓':''}
                        </button>
                        <div className="grow" style={{marginLeft:8}}>
                          {s.dmMode ? (
                            <input value={q.title} onChange={e=>updThisScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,title:e.target.value}:qq)}))}
                              style={{fontWeight:500,textDecoration:q.done?'line-through':'none',background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',fontSize:14}} />
                          ) : (
                            <div style={{fontWeight:500,textDecoration:q.done?'line-through':'none'}}>{q.title}</div>
                          )}
                          <div className="row" style={{gap:4,marginTop:3,flexWrap:'wrap'}}>
                            {s.dmMode&&!q.revealed && <span className="dm-badge">SEGRETA</span>}
                            {q.longTerm && <span className="pill" style={{padding:'2px 7px',fontSize:8,color:'var(--blue)',borderColor:'var(--blue)'}}>LUNGO TERMINE</span>}
                          </div>
                          {q.desc && !s.dmMode && <div className="small muted" style={{marginTop:3,fontStyle:'italic'}}>{q.desc}</div>}
                          {s.dmMode && <textarea value={q.desc||''} placeholder="Descrizione (visibile ai giocatori)…" style={{marginTop:4,fontSize:13,padding:'6px 8px',minHeight:36}}
                            onChange={e=>updThisScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,desc:e.target.value}:qq)}))} />}
                          {s.dmMode && <textarea value={q.dmNote||''} placeholder="Note DM (non visibili ai giocatori)…"
                            style={{marginTop:3,fontSize:12,padding:'5px 8px',minHeight:30,borderColor:'var(--gold)',borderStyle:'dashed'}}
                            onChange={e=>updThisScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,dmNote:e.target.value}:qq)}))} />}
                          <div style={{marginTop:6,cursor:'pointer',maxWidth:200}} onClick={e=>{
                            e.stopPropagation();
                            const img=document.querySelector(`[data-slot="quest-${q.id}"] img`) as HTMLImageElement;
                            if(img?.src)setEnlargedImg(img.src);
                          }}>
                            <div data-slot={'quest-'+q.id}>
                              <ImageSlot slotId={'quest-'+q.id} campaignId={campaignId} shape="rounded" width={200} height={112} dmMode={s.dmMode} placeholder={s.dmMode?'📷 Immagine quest':''} alt={q.title} hideIfEmpty />
                            </div>
                          </div>
                        </div>
                        {s.dmMode && (
                          <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                            <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9}}
                              onClick={()=>{const wasRevealed=scQuests.find((qq:any)=>qq.id===q.id)?.revealed;if(!wasRevealed)sfxReveal();updThisScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,revealed:!qq.revealed}:qq)}));}}>{q.revealed?'◉':'◯'}</button>
                            <button className={'btn btn-ghost'} style={{padding:'2px 6px',fontSize:8,color:q.longTerm?'var(--blue)':'var(--gray-purple-deep)'}}
                              onClick={()=>updThisScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,longTerm:!qq.longTerm}:qq)}))}
                              title="Lungo termine">⟳</button>
                            <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}}
                              onClick={()=>updThisScen(x=>({...x,quests:x.quests.filter((qq:any)=>qq.id!==q.id)}))}>&times;</button>
                          </div>
                        )}
                        <ReorderBtns
                          onUp={()=>{const idx=scQuests.findIndex((qq:any)=>qq.id===q.id);updThisScen(x=>({...x,quests:moveInArray(x.quests,idx,-1)}));}}
                          onDown={()=>{const idx=scQuests.findIndex((qq:any)=>qq.id===q.id);updThisScen(x=>({...x,quests:moveInArray(x.quests,idx,1)}));}}
                        />
                      </div>
                    </div>
                  ))}

                  {s.dmMode && (
                    <div className="row" style={{gap:6,marginTop:10}}>
                      <input className="grow" placeholder="Nuova quest…" value={draft} onChange={e=>setDraft(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'&&draft.trim()){updThisScen(x=>({...x,quests:[...x.quests,{id:uid('q'),type:sub,title:draft.trim(),desc:'',dmNote:'',done:false,revealed:false,longTerm:false}]}));setDraft('');}}} />
                      <button className="btn btn-primary" onClick={()=>{if(draft.trim()){updThisScen(x=>({...x,quests:[...x.quests,{id:uid('q'),type:sub,title:draft.trim(),desc:'',dmNote:'',done:false,revealed:false,longTerm:false}]}));setDraft('');}}}>+</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          );
        })}

        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:8}}>
            <input className="grow" placeholder="Nuovo scenario…" value={newScenName} onChange={e=>setNewScenName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')addScenario();}} />
            <button className="btn btn-primary" onClick={addScenario}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
