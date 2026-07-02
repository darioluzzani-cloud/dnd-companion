'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';

const REL_NEXT: Record<string,string> = {ally:'enemy',enemy:'neutral',neutral:'ally'};


// ─── TAB: PNG ────────────────────────────────────────────────
export function CharactersTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('tutti');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  const setField = (id:string,f:string,v:string) => update(prev=>({characters:prev.characters.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const filtered = filter==='tutti' ? s.characters : s.characters.filter(c=>c.relation===filter);

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
          {[{k:'tutti',l:'Tutti',c:'var(--purple)'},{k:'ally',l:'Alleati',c:'var(--green)'},{k:'enemy',l:'Nemici',c:'var(--red)'},{k:'neutral',l:'Neutrali',c:'var(--gold)'}].map(f=>(
            <button key={f.k} className="pill" style={{cursor:'pointer',background:filter===f.k?'var(--bg-active)':'transparent',borderColor:filter===f.k?f.c:'var(--border)',color:f.c}} onClick={()=>setFilter(f.k)}>
              <span style={{width:6,height:6,borderRadius:'50%',background:f.c,display:'inline-block'}} />
              {f.l}
            </button>
          ))}
        </div>
        {filtered.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun PNG.</div>}
        {filtered.map(c => {
          const isExp = (c as any).expanded;
          const toggleExp = () => update(prev=>({characters:prev.characters.map(cc=>cc.id===c.id?{...cc,expanded:!isExp} as any:cc)}));
          return (
          <div key={c.id} className="card" style={{cursor:'pointer'}}>
            {/* Header compatto — sempre visibile */}
            <div className="row" onClick={toggleExp}>
              <div style={{width:48,height:48,flexShrink:0,cursor:'pointer',overflow:'hidden',borderRadius:24}}
                onClick={e=>{e.stopPropagation();const img=document.querySelector(`[data-slot="png-${c.id}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
                <div data-slot={'png-'+c.id} style={{width:48,height:48}}>
                  <ImageSlot slotId={'png-'+c.id} campaignId={campaignId} shape="circle" width={48} height={48} dmMode={s.dmMode} placeholder={c.name.slice(0,2).toUpperCase()} alt={c.name} />
                </div>
              </div>
              <div className="grow" style={{marginLeft:10}}>
                <div className="h2">{c.name}</div>
                {c.role && <div className="small" style={{color:'var(--gold-dim)'}}>{c.role}</div>}
              </div>
              <button className={'pill relation-'+c.relation} style={{cursor:'pointer'}}
                onClick={e=>{e.stopPropagation();update(prev=>({characters:prev.characters.map(cc=>cc.id===c.id?{...cc,relation:(REL_NEXT[cc.relation]||'neutral') as any}:cc)}));}}>{c.relation==='ally'?'Alleato':c.relation==='enemy'?'Nemico':'Neutrale'}</button>
              <span className="small muted" style={{marginLeft:4,fontSize:16}}>{isExp ? '▾' : '▸'}</span>
              <ReorderBtns
                onUp={()=>{const idx=s.characters.findIndex(cc=>cc.id===c.id);update(prev=>({characters:moveInArray(prev.characters,idx,-1)}));}}
                onDown={()=>{const idx=s.characters.findIndex(cc=>cc.id===c.id);update(prev=>({characters:moveInArray(prev.characters,idx,1)}));}}
              />
            </div>

            {/* Corpo espanso */}
            {isExp && (
              <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                {s.dmMode ? (
                  <>
                    <input value={c.name} onChange={e=>setField(c.id,'name',e.target.value)} style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,color:'var(--gold)',marginBottom:4,background:'transparent',border:'1px solid var(--border)',padding:'4px 8px'}} />
                    <input value={c.role||''} placeholder="Ruolo" onChange={e=>setField(c.id,'role',e.target.value)} style={{marginBottom:3,fontSize:13,padding:'4px 8px'}} />
                    <input value={c.location||''} placeholder="Luogo" onChange={e=>setField(c.id,'location',e.target.value)} style={{marginBottom:3,fontSize:13,padding:'4px 8px'}} />
                    <textarea value={c.note||''} placeholder="Note…" onChange={e=>setField(c.id,'note',e.target.value)} style={{fontSize:13,padding:'6px 8px',minHeight:50}} />
                  </>
                ) : (
                  <>
                    {c.location && <div className="small muted" style={{marginBottom:4}}>📍 {c.location}</div>}
                    {c.note && <div style={{fontSize:14,lineHeight:1.6,fontStyle:'italic'}}>{c.note}</div>}
                  </>
                )}
                {s.dmMode && (
                  <div className="row" style={{marginTop:8,justifyContent:'flex-end'}}>
                    <button className="btn btn-danger btn-ghost" style={{padding:'4px 10px',fontSize:10}}
                      onClick={()=>{if(confirm('Eliminare?'))update(prev=>({characters:prev.characters.filter(cc=>cc.id!==c.id)}));}}>Elimina</button>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:12}}>
            <input className="grow" placeholder="Nuovo personaggio…" value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&draft.trim()){update(prev=>({characters:[...prev.characters,{id:uid('c'),name:draft.trim(),role:'',location:'',relation:'neutral',note:''}]}));setDraft('');}}} />
            <button className="btn btn-gold" onClick={()=>{if(draft.trim()){update(prev=>({characters:[...prev.characters,{id:uid('c'),name:draft.trim(),role:'',location:'',relation:'neutral',note:''}]}));setDraft('');}}}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
