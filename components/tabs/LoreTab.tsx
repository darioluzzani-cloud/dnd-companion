'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';

const LORE_CATS = ['oggetti','luoghi','culti','fazioni'] as const;

// ─── TAB: LORE ───────────────────────────────────────────────
// Griglia di card verticali sul modello del mercato: immagine quadrata
// in alto (clic per ingrandire), nome e sottotitolo, testo espandibile.
// Filtro alle sole quattro categorie, senza il calderone "tutti".
export function LoreTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const stored = s.loreCatFilter;
  const filter = (LORE_CATS as readonly string[]).includes(stored) ? stored : 'oggetti';
  const all = s.lore || [];
  const visible = all.filter(l=>l.category===filter);
  const filtered = s.dmMode ? visible : visible.filter(l=>l.revealed);
  const [draftName,setDraftName]=useState('');
  const [draftSub,setDraftSub]=useState('');
  const [draftCat,setDraftCat]=useState<string>('oggetti');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  return (
    <div>
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Categoria</div>
        <div className="row" style={{gap:6,flexWrap:'wrap'}}>
          {LORE_CATS.map(c=>(
            <button key={c} className={'pill lore-'+c} style={{cursor:'pointer',padding:'5px 11px',background:filter===c?'var(--bg-active)':'transparent',boxShadow:filter===c?'0 0 0 1px':'none'}} onClick={()=>update({loreCatFilter:c})}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="frame">
        {filtered.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessuna voce in questa categoria.</div>}

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:10}}>
          {filtered.map(l=>{
            const isExp = expandedCards.has(l.id);
            return (
            <div key={l.id} className="card" style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column',opacity:!l.revealed&&s.dmMode?.65:1}}>
              {/* Immagine quadrata — clic per ingrandire */}
              <div style={{position:'relative',aspectRatio:'1 / 1',cursor:'pointer'}}
                onClick={()=>{const imgEl=document.querySelector(`[data-slot="lore-${l.id}"] img`) as HTMLImageElement;if(imgEl?.src)setEnlargedImg(imgEl.src);}}>
                <div data-slot={'lore-'+l.id} style={{width:'100%',height:'100%'}}>
                  <ImageSlot slotId={'lore-'+l.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={s.dmMode} placeholder=" " alt={l.name} />
                </div>
                {s.dmMode && !l.revealed && <span className="dm-badge" style={{position:'absolute',top:6,left:6}}>SEGRETA</span>}
              </div>

              <div style={{padding:'8px 10px',flex:1,display:'flex',flexDirection:'column'}}>
                <div style={{cursor:'pointer'}} onClick={()=>setExpandedCards(prev=>{const n=new Set(prev);n.has(l.id)?n.delete(l.id):n.add(l.id);return n;})}>
                  <div className="row" style={{alignItems:'baseline',gap:6}}>
                    <div className="grow" style={{fontWeight:500,fontSize:14}}>{l.name}</div>
                    <span className="small muted" style={{fontSize:13}}>{isExp?'▾':'▸'}</span>
                  </div>
                  {l.subtitle && <div className="small muted" style={{marginTop:1}}>{l.subtitle}</div>}
                </div>

                {isExp && (
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                    {s.dmMode ? (
                      <>
                        <input value={l.name} onChange={e=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,name:e.target.value}:ll)}))}
                          style={{fontWeight:500,background:'transparent',border:'1px solid var(--border)',padding:'3px 8px',marginBottom:3,fontSize:13,width:'100%'}} />
                        <input value={l.subtitle||''} placeholder="Sottotitolo" onChange={e=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,subtitle:e.target.value}:ll)}))}
                          style={{fontSize:12,background:'transparent',border:'1px solid var(--border)',padding:'3px 8px',marginBottom:3,width:'100%'}} />
                        <textarea value={l.text||''} placeholder="Testo della voce…" onChange={e=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,text:e.target.value}:ll)}))} style={{fontSize:12,padding:'8px',minHeight:80,width:'100%'}} />
                        <div className="row" style={{marginTop:6,gap:4,alignItems:'center'}}>
                          <button className="btn btn-ghost" style={{padding:'2px 7px',fontSize:9}} title={l.revealed?'Nascondi ai giocatori':'Mostra ai giocatori'}
                            onClick={()=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,revealed:!ll.revealed}:ll)}))}>{l.revealed?'◉':'◯'}</button>
                          <ReorderBtns
                            onUp={()=>{const idx=s.lore.findIndex(ll=>ll.id===l.id);update(prev=>({lore:moveInArray(prev.lore,idx,-1)}));}}
                            onDown={()=>{const idx=s.lore.findIndex(ll=>ll.id===l.id);update(prev=>({lore:moveInArray(prev.lore,idx,1)}));}}
                          />
                          <div className="grow" />
                          <button className="btn btn-danger btn-ghost" style={{padding:'2px 7px',fontSize:9}} onClick={()=>{if(confirm('Eliminare?'))update(prev=>({lore:prev.lore.filter(ll=>ll.id!==l.id)}));}}>&times;</button>
                        </div>
                      </>
                    ) : (
                      <div style={{fontSize:12,whiteSpace:'pre-wrap',lineHeight:1.6,fontStyle:'italic'}}>{l.text||<span className="muted small" style={{fontStyle:'normal'}}>(testo non ancora redatto)</span>}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>

        {s.dmMode && (
          <div style={{marginTop:12}}>
            <input placeholder="Nome voce…" value={draftName} onChange={e=>setDraftName(e.target.value)} style={{marginBottom:6}} />
            <input placeholder="Sottotitolo (opz.)" value={draftSub} onChange={e=>setDraftSub(e.target.value)} style={{marginBottom:6}} />
            <div className="row" style={{gap:6,marginBottom:6,flexWrap:'wrap'}}>
              {LORE_CATS.map(c=>(
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
