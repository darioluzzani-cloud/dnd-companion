'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { ImageSlot } from '@/components/ImageSlot';
import { sfxReveal, sfxComplete } from '@/lib/dnd/sounds';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';

// ─── TAB: QUEST ──────────────────────────────────────────────
export function QuestsTab({ s, update, updScen, sc, campaignId }: { s:CampaignState; update:U; updScen:(fn:(sc:any)=>any)=>void; sc:any; campaignId:string|null }) {
  const sub = s.questSubTab || 'main';
  const quests = (sc?.quests||[]).filter((q:any)=>q.type===sub);
  // Visibilità: in PG mode nascondi quest non rivelate E scenari nascosti
  const visible = s.dmMode ? quests : quests.filter((q:any)=>q.revealed);
  const visibleScenarios = s.dmMode ? s.scenarios : s.scenarios.filter((sc2:any)=>sc2.revealed!==false);
  const [draft, setDraft] = useState('');
  const [newScenName, setNewScenName] = useState('');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);

  // CRUD scenari
  const addScenario = () => {
    if (!newScenName.trim()) return;
    const id = uid('sc');
    update(prev => ({
      scenarios: [...prev.scenarios, {id, name:newScenName.trim(), status:'futuro' as const, quests:[], revealed:true} as any],
      activeScenario: id,
    }));
    setNewScenName('');
  };
  const delScenario = (id:string) => {
    if (!confirm('Eliminare questo scenario e tutte le sue quest?')) return;
    update(prev => ({
      scenarios: prev.scenarios.filter(sc2=>sc2.id!==id),
      activeScenario: prev.scenarios.find(sc2=>sc2.id!==id)?.id || '',
    }));
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
      {/* === Lista scenari con CRUD === */}
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Scenari</div>
        {visibleScenarios.map(sc2 => {
          const isActive = sc2.id === s.activeScenario;
          return (
          <div key={sc2.id} className={isActive ? 'pulse-gold' : undefined} style={{position:'relative',overflow:'hidden',borderRadius:8,marginBottom:8,
            border:isActive?'1px solid var(--gold)':'1px solid var(--border)',
            cursor:'pointer',minHeight:72,transition:'all .2s'}}
            onClick={()=>update({activeScenario:sc2.id})}>
            {/* Immagine di sfondo */}
            <div style={{position:'absolute',inset:0,zIndex:0}}>
              <div data-slot={'scenario-'+sc2.id} style={{width:'100%',height:'100%'}}>
                <ImageSlot slotId={'scenario-'+sc2.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={s.dmMode} placeholder="" alt={sc2.name} />
              </div>
            </div>
            {/* Gradiente — oro quando attivo, scuro quando no */}
            <div style={{position:'absolute',inset:0,zIndex:1,background:isActive
              ? 'linear-gradient(90deg, rgba(216,180,92,.8) 0%, rgba(216,180,92,.3) 45%, rgba(216,180,92,0) 100%)'
              : 'linear-gradient(90deg, rgba(11,8,20,.92) 0%, rgba(11,8,20,.4) 50%, rgba(11,8,20,0) 100%)',
              transition:'background .3s'}} />
            {/* Contenuto sopra */}
            <div style={{position:'relative',zIndex:2,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div className="grow">
                <div style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:600,color:isActive?'var(--bg-deep)':'var(--text)',letterSpacing:'.5px',transition:'color .2s'}}>{sc2.name}</div>
                {s.dmMode && (sc2 as any).revealed===false && <span className="dm-badge" style={{marginTop:4}}>NASCOSTO</span>}
              </div>
              <div className={'pill scen-'+sc2.status} style={{padding:'3px 8px',fontSize:8,flexShrink:0,background:isActive?'rgba(11,8,20,.5)':'rgba(11,8,20,.6)'}}>{sc2.status}</div>
              {s.dmMode && (
                <div className="row" style={{gap:2}} onClick={e=>e.stopPropagation()}>
                  <ReorderBtns onUp={()=>moveScen(sc2.id,-1)} onDown={()=>moveScen(sc2.id,1)} />
                  <label className="btn btn-ghost" style={{padding:'2px 5px',fontSize:9,cursor:'pointer'}} title="Immagine sfondo">
                    📷
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={async(e)=>{
                      const file=e.target.files?.[0]; if(!file||!campaignId)return;
                      const ext=(file.name.split('.').pop()||'png').toLowerCase();
                      const slotId='scenario-'+sc2.id;
                      const folder=campaignId;
                      try{
                        const{data:ex}=await supabase.storage.from('campaign-images').list(folder,{search:slotId});
                        const rm=(ex||[]).filter((f:any)=>f.name.startsWith(slotId+'.')).map((f:any)=>`${folder}/${f.name}`);
                        if(rm.length) await supabase.storage.from('campaign-images').remove(rm);
                        await supabase.storage.from('campaign-images').upload(`${folder}/${slotId}.${ext}`,file,{upsert:true,contentType:file.type});
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
            </div>
              {/* Descrizione scenario — visibile quando attivo */}
              {isActive && (
                <div style={{marginTop:8}} onClick={e=>e.stopPropagation()}>
                  {s.dmMode ? (
                    <textarea value={(sc2 as any).scenDesc||''} placeholder="Breve presentazione dello scenario…"
                      onChange={e=>update(prev=>({scenarios:prev.scenarios.map(s2=>s2.id===sc2.id?{...s2,scenDesc:e.target.value} as any:s2)}))}
                      style={{fontSize:12,padding:'6px 8px',minHeight:32,background:'rgba(11,8,20,.4)',borderColor:'var(--gold-dim)',color:'var(--text)',width:'100%'}} />
                  ) : (
                    (sc2 as any).scenDesc && <div style={{fontSize:12,fontStyle:'italic',color:'var(--text)',lineHeight:1.5,opacity:.9}}>{(sc2 as any).scenDesc}</div>
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

      {/* === Scenario attivo === */}
      {sc && (
      <div className="frame">
        <div className="row" style={{marginBottom:8}}>
          {s.dmMode ? (
            <input value={sc.name||''} onChange={e=>updScen(x=>({...x,name:e.target.value}))}
              className="grow" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,color:'var(--gold)',background:'transparent',border:'1px solid var(--border)',padding:'4px 10px'}} />
          ) : (
            <div className="h2 grow">{sc.name}</div>
          )}
          <div className={'pill scen-'+(sc.status||'futuro')}>{sc.status}</div>
        </div>
        {s.dmMode && (
          <>
            <div className="row" style={{gap:6,marginBottom:6}}>
              {(['futuro','corso','concluso'] as const).map(st => (
                <button key={st} className={'btn'+(sc.status===st?' btn-primary':'')} onClick={()=>updScen(x=>({...x,status:st}))}>{st}</button>
              ))}
            </div>
            {/* Note DM — visibili solo in DM mode */}
            <textarea value={sc.dmNotes||''} placeholder="Note DM (non visibili ai giocatori)…"
              onChange={e=>updScen(x=>({...x,dmNotes:e.target.value}))}
              style={{fontSize:13,padding:'6px 8px',minHeight:36,marginBottom:8,borderColor:'var(--gold)',borderStyle:'dashed'}} />
          </>
        )}
        <div className="row" style={{gap:6,marginBottom:10}}>
          <button className={'btn'+(sub==='main'?' btn-primary':'')} onClick={()=>update({questSubTab:'main'})}>Principali</button>
          <button className={'btn'+(sub==='side'?' btn-primary':'')} onClick={()=>update({questSubTab:'side'})}>Secondarie</button>
        </div>
        {visible.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessuna quest.</div>}
        {visible.map((q:any) => (
          <div key={q.id} className="card">
            <div className="row" style={{alignItems:'flex-start'}}>
              <button onClick={()=>{const wasDone=(sc?.quests||[]).find((qq:any)=>qq.id===q.id)?.done;if(!wasDone)sfxComplete();updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,done:!qq.done}:qq)}));}}
                style={{width:20,height:20,borderRadius:4,marginTop:2,border:'1px solid '+(q.done?'var(--green)':'var(--border)'),
                  background:q.done?'var(--green)':'var(--bg-deep)',color:'var(--bg-deep)',fontSize:13,lineHeight:1,flexShrink:0}}>
                {q.done?'✓':''}
              </button>
              <div className="grow" style={{marginLeft:8}}>
                {s.dmMode ? (
                  <input value={q.title} onChange={e=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,title:e.target.value}:qq)}))}
                    style={{fontWeight:500,textDecoration:q.done?'line-through':'none',background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',fontSize:14}} />
                ) : (
                  <div style={{fontWeight:500,textDecoration:q.done?'line-through':'none'}}>{q.title}</div>
                )}
                <div className="row" style={{gap:4,marginTop:3,flexWrap:'wrap'}}>
                  {s.dmMode&&!q.revealed && <span className="dm-badge">SEGRETA</span>}
                  {q.longTerm && <span className="pill" style={{padding:'2px 7px',fontSize:8,color:'var(--blue)',borderColor:'var(--blue)'}}>LUNGO TERMINE</span>}
                </div>
                {/* Descrizione giocatori */}
                {q.desc && !s.dmMode && <div className="small muted" style={{marginTop:3,fontStyle:'italic'}}>{q.desc}</div>}
                {s.dmMode && <textarea value={q.desc||''} placeholder="Descrizione (visibile ai giocatori)…" style={{marginTop:4,fontSize:13,padding:'6px 8px',minHeight:36}}
                  onChange={e=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,desc:e.target.value}:qq)}))} />}
                {/* Note DM sulla quest */}
                {s.dmMode && <textarea value={q.dmNote||''} placeholder="Note DM (non visibili ai giocatori)…"
                  style={{marginTop:3,fontSize:12,padding:'5px 8px',minHeight:30,borderColor:'var(--gold)',borderStyle:'dashed'}}
                  onChange={e=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,dmNote:e.target.value}:qq)}))} />}
                {/* Immagine quest */}
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
                    onClick={()=>{const wasRevealed=(sc?.quests||[]).find((qq:any)=>qq.id===q.id)?.revealed;if(!wasRevealed)sfxReveal();updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,revealed:!qq.revealed}:qq)}));}}>{q.revealed?'◉':'◯'}</button>
                  <button className={'btn btn-ghost'} style={{padding:'2px 6px',fontSize:8,color:q.longTerm?'var(--blue)':'var(--gray-purple-deep)'}}
                    onClick={()=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,longTerm:!qq.longTerm}:qq)}))}
                    title="Lungo termine">⟳</button>
                  <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}}
                    onClick={()=>updScen(x=>({...x,quests:x.quests.filter((qq:any)=>qq.id!==q.id)}))}>&times;</button>
                </div>
              )}
              <ReorderBtns
                onUp={()=>{const idx=(sc?.quests||[]).findIndex((qq:any)=>qq.id===q.id);updScen(x=>({...x,quests:moveInArray(x.quests,idx,-1)}));}}
                onDown={()=>{const idx=(sc?.quests||[]).findIndex((qq:any)=>qq.id===q.id);updScen(x=>({...x,quests:moveInArray(x.quests,idx,1)}));}}
              />
            </div>
          </div>
        ))}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:10}}>
            <input className="grow" placeholder="Nuova quest…" value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&draft.trim()){updScen(x=>({...x,quests:[...x.quests,{id:uid('q'),type:sub,title:draft.trim(),desc:'',dmNote:'',done:false,revealed:false,longTerm:false}]}));setDraft('');}}} />
            <button className="btn btn-primary" onClick={()=>{if(draft.trim()){updScen(x=>({...x,quests:[...x.quests,{id:uid('q'),type:sub,title:draft.trim(),desc:'',dmNote:'',done:false,revealed:false,longTerm:false}]}));setDraft('');}}}>+</button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
