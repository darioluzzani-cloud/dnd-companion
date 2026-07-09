'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';

const REL_NEXT: Record<string,string> = {ally:'enemy',enemy:'neutral',neutral:'ally'};
const REL_TABS = [
  {k:'ally',    l:'Alleati',  c:'var(--green)'},
  {k:'enemy',   l:'Nemici',   c:'var(--red)'},
  {k:'neutral', l:'Neutrali', c:'var(--gold)'},
];

// ─── TAB: PNG ────────────────────────────────────────────────
// Griglia di card verticali sul modello del mercato: immagine quadrata
// in alto (clic per ingrandire), nome e ruolo sotto, corpo espandibile.
// Filtro a tre relazioni, senza il calderone "tutti". I PNG possono
// essere preparati in anticipo e nascosti ai giocatori (revealed),
// come le voci di lore: i nuovi nascono nascosti.
export function CharactersTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('ally');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  const setField = (id:string,f:string,v:string) => update(prev=>({characters:prev.characters.map(c=>c.id===id?{...c,[f]:v}:c)}));

  const byRel = s.characters.filter(c=>c.relation===filter);
  const filtered = s.dmMode ? byRel : byRel.filter(c=>(c as any).revealed!==false);

  return (
    <div>
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      <div className="frame">
        <div className="label" style={{marginBottom:10}}>Personaggi Non Giocanti</div>
        <div className="row" style={{gap:6,flexWrap:'wrap',marginBottom:12}}>
          {REL_TABS.map(f=>(
            <button key={f.k} className="pill" style={{cursor:'pointer',background:filter===f.k?'var(--bg-active)':'transparent',borderColor:filter===f.k?f.c:'var(--border)',color:f.c}} onClick={()=>setFilter(f.k)}>
              <span style={{width:6,height:6,borderRadius:'50%',background:f.c,display:'inline-block'}} />
              {f.l}
            </button>
          ))}
        </div>

        {filtered.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun PNG in questa categoria.</div>}

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:10}}>
          {filtered.map(c => {
            const isExp = (c as any).expanded;
            const hidden = (c as any).revealed===false;
            const toggleExp = () => update(prev=>({characters:prev.characters.map(cc=>cc.id===c.id?{...cc,expanded:!isExp} as any:cc)}));
            return (
            <div key={c.id} className="card" style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column',opacity:hidden&&s.dmMode?.65:1}}>
              {/* Immagine quadrata — clic per ingrandire */}
              <div style={{position:'relative',aspectRatio:'1 / 1',cursor:'pointer'}}
                onClick={()=>{const img=document.querySelector(`[data-slot="png-${c.id}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
                <div data-slot={'png-'+c.id} style={{width:'100%',height:'100%'}}>
                  <ImageSlot slotId={'png-'+c.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={s.dmMode} placeholder={c.name.slice(0,2).toUpperCase()} alt={c.name} />
                </div>
                {s.dmMode && hidden && <span className="dm-badge" style={{position:'absolute',top:6,left:6}}>NASCOSTO</span>}
              </div>

              <div style={{padding:'8px 10px',flex:1,display:'flex',flexDirection:'column'}}>
                <div style={{cursor:'pointer'}} onClick={toggleExp}>
                  <div className="row" style={{alignItems:'baseline',gap:6}}>
                    <div className="h2 grow" style={{fontSize:14}}>{c.name}</div>
                    <span className="small muted" style={{fontSize:13}}>{isExp?'▾':'▸'}</span>
                  </div>
                  {c.role && <div className="small" style={{color:'var(--gold-dim)',marginTop:1}}>{c.role}</div>}
                </div>

                {isExp && (
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                    {s.dmMode ? (
                      <>
                        <input value={c.name} onChange={e=>setField(c.id,'name',e.target.value)} style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:14,color:'var(--gold)',marginBottom:4,background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',width:'100%'}} />
                        <input value={c.role||''} placeholder="Ruolo" onChange={e=>setField(c.id,'role',e.target.value)} style={{marginBottom:3,fontSize:12,padding:'4px 8px',width:'100%'}} />
                        <input value={c.location||''} placeholder="Luogo" onChange={e=>setField(c.id,'location',e.target.value)} style={{marginBottom:3,fontSize:12,padding:'4px 8px',width:'100%'}} />
                        <textarea value={c.note||''} placeholder="Note…" onChange={e=>setField(c.id,'note',e.target.value)} style={{fontSize:12,padding:'6px 8px',minHeight:60,width:'100%'}} />
                        <div className="row" style={{marginTop:6,gap:4,flexWrap:'wrap',alignItems:'center'}}>
                          <button className={'pill relation-'+c.relation} style={{cursor:'pointer',fontSize:9}}
                            onClick={()=>update(prev=>({characters:prev.characters.map(cc=>cc.id===c.id?{...cc,relation:(REL_NEXT[cc.relation]||'neutral') as any}:cc)}))}>{c.relation==='ally'?'Alleato':c.relation==='enemy'?'Nemico':'Neutrale'}</button>
                          <button className="btn btn-ghost" style={{padding:'2px 7px',fontSize:9}} title={hidden?'Mostra ai giocatori':'Nascondi ai giocatori'}
                            onClick={()=>update(prev=>({characters:prev.characters.map(cc=>cc.id===c.id?{...cc,revealed:hidden} as any:cc)}))}>{hidden?'◯':'◉'}</button>
                          <ReorderBtns
                            onUp={()=>{const idx=s.characters.findIndex(cc=>cc.id===c.id);update(prev=>({characters:moveInArray(prev.characters,idx,-1)}));}}
                            onDown={()=>{const idx=s.characters.findIndex(cc=>cc.id===c.id);update(prev=>({characters:moveInArray(prev.characters,idx,1)}));}}
                          />
                          <div className="grow" />
                          <button className="btn btn-danger btn-ghost" style={{padding:'2px 7px',fontSize:9}}
                            onClick={()=>{if(confirm('Eliminare?'))update(prev=>({characters:prev.characters.filter(cc=>cc.id!==c.id)}));}}>&times;</button>
                        </div>
                      </>
                    ) : (
                      <>
                        {c.location && <div className="small muted" style={{marginBottom:4}}>📍 {c.location}</div>}
                        {c.note ? <div style={{fontSize:12,lineHeight:1.6,fontStyle:'italic'}}>{c.note}</div> : <div className="small muted">(nessuna nota)</div>}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:12}}>
            <input className="grow" placeholder="Nuovo personaggio (nascosto ai giocatori)…" value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&draft.trim()){update(prev=>({characters:[...prev.characters,{id:uid('c'),name:draft.trim(),role:'',location:'',relation:filter as any,note:'',revealed:false}]}));setDraft('');}}} />
            <button className="btn btn-gold" onClick={()=>{if(draft.trim()){update(prev=>({characters:[...prev.characters,{id:uid('c'),name:draft.trim(),role:'',location:'',relation:filter as any,note:'',revealed:false}]}));setDraft('');}}}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
