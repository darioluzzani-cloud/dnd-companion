'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';

const LORE_CATS = ['oggetti','luoghi','culti','fazioni','tutti'] as const;


// ─── TAB: LORE ───────────────────────────────────────────────
export function LoreTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const filter = s.loreCatFilter || 'tutti';
  const all = s.lore || [];
  const visible = filter==='tutti' ? all : all.filter(l=>l.category===filter);
  const filtered = s.dmMode ? visible : visible.filter(l=>l.revealed);
  const [draftName,setDraftName]=useState('');
  const [draftSub,setDraftSub]=useState('');
  const [draftCat,setDraftCat]=useState<string>('oggetti');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);

  return (
    <div>
      {/* Overlay immagine ingrandita */}
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Categoria</div>
        <div className="row" style={{gap:6,flexWrap:'wrap'}}>
          {LORE_CATS.map(c=>(
            <button key={c} className={'pill lore-'+c} style={{cursor:'pointer',padding:'5px 11px',background:filter===c?'var(--bg-active)':'transparent',boxShadow:filter===c?'0 0 0 1px':'none'}} onClick={()=>update({loreCatFilter:c})}>{c==='tutti'?'Tutti':c.charAt(0).toUpperCase()+c.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="frame">
        {filtered.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessuna voce.</div>}
        {filtered.map(l=>{
          const isCulti = l.category === 'culti';
          const imgW = isCulti ? 56 : 46;
          const imgH = isCulti ? 80 : 46;
          return (
          <div key={l.id} className="card">
            <div className="row" style={{alignItems:'flex-start'}}>
              <div style={{width:imgW,height:imgH,flexShrink:0,cursor:'pointer',overflow:'hidden',borderRadius:isCulti?6:24}}
                onClick={()=>{
                  const imgEl = document.querySelector(`[data-slot="lore-${l.id}"] img`) as HTMLImageElement;
                  if(imgEl?.src) setEnlargedImg(imgEl.src);
                }}>
                <div data-slot={'lore-'+l.id} style={{width:imgW,height:imgH}}>
                  <ImageSlot slotId={'lore-'+l.id} campaignId={campaignId} shape={isCulti?'rect':'circle'} width={imgW} height={imgH} dmMode={s.dmMode} placeholder=" " alt={l.name} />
                </div>
              </div>
              <div className="grow" style={{marginLeft:10,cursor:'pointer'}} onClick={()=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,expanded:!ll.expanded}:ll)}))}>
                {s.dmMode ? (
                  <input value={l.name} onClick={e=>e.stopPropagation()} onChange={e=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,name:e.target.value}:ll)}))}
                    style={{fontWeight:500,background:'transparent',border:'1px solid var(--border)',padding:'3px 8px',marginBottom:3,fontSize:14}} />
                ) : (
                  <div style={{fontWeight:500}}>
                    {l.name}
                    {s.dmMode&&!l.revealed && <span className="dm-badge">SEGRETA</span>}
                  </div>
                )}
                {s.dmMode ? (
                  <input value={l.subtitle||''} placeholder="Sottotitolo" onClick={e=>e.stopPropagation()} onChange={e=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,subtitle:e.target.value}:ll)}))}
                    style={{fontSize:13,background:'transparent',border:'1px solid var(--border)',padding:'3px 8px',marginBottom:3}} />
                ) : (
                  l.subtitle && <div className="small muted">{l.subtitle}</div>
                )}
                {!l.revealed && !s.dmMode ? null : <div className={'pill lore-'+l.category} style={{marginTop:4}}>{l.category}</div>}
                {s.dmMode && !l.revealed && <span className="dm-badge" style={{marginLeft:0,marginTop:4}}>SEGRETA</span>}
              </div>
              {s.dmMode && (
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <button className="btn btn-ghost" style={{padding:'3px 7px',fontSize:9}} onClick={()=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,revealed:!ll.revealed}:ll)}))}>{l.revealed?'◉':'◯'}</button>
                  <button className="btn btn-danger btn-ghost" style={{padding:'3px 7px',fontSize:9}} onClick={()=>{if(confirm('Eliminare?'))update(prev=>({lore:prev.lore.filter(ll=>ll.id!==l.id)}));}}>&times;</button>
                </div>
              )}
              <ReorderBtns
                onUp={()=>{const idx=s.lore.findIndex(ll=>ll.id===l.id);update(prev=>({lore:moveInArray(prev.lore,idx,-1)}));}}
                onDown={()=>{const idx=s.lore.findIndex(ll=>ll.id===l.id);update(prev=>({lore:moveInArray(prev.lore,idx,1)}));}}
              />
            </div>
            {l.expanded && (
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                {s.dmMode ? (
                  <textarea value={l.text||''} placeholder="Testo della voce…" onChange={e=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,text:e.target.value}:ll)}))} style={{fontSize:14,padding:'8px',minHeight:80}} />
                ) : (
                  <div style={{fontSize:14,whiteSpace:'pre-wrap',lineHeight:1.6,fontStyle:'italic'}}>{l.text||<span className="muted small" style={{fontStyle:'normal'}}>(testo non ancora redatto)</span>}</div>
                )}
              </div>
            )}
          </div>
        )})}
        {s.dmMode && (
          <div style={{marginTop:10}}>
            <input placeholder="Nome voce…" value={draftName} onChange={e=>setDraftName(e.target.value)} style={{marginBottom:6}} />
            <input placeholder="Sottotitolo (opz.)" value={draftSub} onChange={e=>setDraftSub(e.target.value)} style={{marginBottom:6}} />
            <div className="row" style={{gap:6,marginBottom:6}}>
              {LORE_CATS.filter(c=>c!=='tutti').map(c=>(
                <button key={c} className={'pill lore-'+c} style={{cursor:'pointer',padding:'4px 10px',background:draftCat===c?'var(--bg-active)':'transparent'}} onClick={()=>setDraftCat(c)}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>
              ))}
            </div>
            <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>{if(draftName.trim()){update(prev=>({lore:[...prev.lore,{id:uid('lo'),name:draftName.trim(),subtitle:draftSub.trim(),category:draftCat as any,text:'',revealed:false,expanded:false}]}));setDraftName('');setDraftSub('');}}}>Aggiungi voce</button>
          </div>
        )}
      </div>
    </div>
  );
}
