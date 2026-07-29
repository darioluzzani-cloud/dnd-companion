'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';
import { Markdown } from '@/components/shared/textUtils';
import { RevealsView, RevealsEditor, RevealBadge } from '@/components/shared/Reveals';

const REL_NEXT: Record<string,string> = {ally:'enemy',enemy:'neutral',neutral:'ally'};
const REL_LABEL: Record<string,string> = {ally:'Alleato',enemy:'Nemico',neutral:'Neutrale'};
const REL_TABS = [
  {k:'ally',    l:'Alleati',  c:'var(--green)'},
  {k:'enemy',   l:'Nemici',   c:'var(--red)'},
  {k:'neutral', l:'Neutrali', c:'var(--gold)'},
];

// ─── TAB: PNG ────────────────────────────────────────────────
// La griglia è una galleria compatta di riquadri quadrati; la lettura
// avviene in una finestra dedicata, dove il testo dispone di una misura
// di riga leggibile invece di incolonnarsi nella larghezza di una scheda.
export function CharactersTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('ally');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  const [detailId, setDetailId] = useState<string|null>(null);

  const setField = (id:string,f:string,v:any) => update(prev=>({characters:prev.characters.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const setReveals = (id:string,list:any) => setField(id,'reveals',list);

  const byRel = s.characters.filter(c=>c.relation===filter);
  const filtered = s.dmMode ? byRel : byRel.filter(c=>(c as any).revealed!==false);
  const detail: any = detailId ? s.characters.find(c=>c.id===detailId) : null;
  const relColor = (r:string) => REL_TABS.find(t=>t.k===r)?.c || 'var(--gold)';

  return (
    <div>
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:250,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
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
            const hidden = (c as any).revealed===false;
            return (
            <div key={c.id} className="card" style={{padding:0,overflow:'hidden',cursor:'pointer',opacity:hidden&&s.dmMode?.65:1}}
              onClick={()=>setDetailId(c.id)}>
              <div style={{position:'relative',aspectRatio:'1 / 1'}}>
                <div data-slot={'png-'+c.id} style={{width:'100%',height:'100%'}}>
                  <ImageSlot slotId={'png-'+c.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder={c.name.slice(0,2).toUpperCase()} alt={c.name} />
                </div>
                {s.dmMode && hidden && <span className="dm-badge" style={{position:'absolute',top:6,left:6}}>NASCOSTO</span>}
                {s.dmMode && (
                  <div style={{position:'absolute',bottom:6,right:6}} onClick={e=>e.stopPropagation()}>
                    <RevealBadge list={(c as any).reveals} onChange={l=>setReveals(c.id,l)} accent={relColor(c.relation)} />
                  </div>
                )}
              </div>
              <div style={{padding:'8px 10px'}}>
                <div className="h2" style={{fontSize:14}}>{c.name}</div>
                {c.role && <div className="small" style={{color:'var(--gold-dim)',marginTop:1}}>{c.role}</div>}
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

      {/* ── Finestra di dettaglio ── */}
      {detail && (
        <div className="alchemy-overlay" onClick={e=>{if(e.target===e.currentTarget)setDetailId(null);}}>
          <div className="alchemy-popup sheet-popup" style={{maxWidth:560}}>
            <div className="row" style={{justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div className="grow">
                <div className="h2" style={{fontSize:18,color:relColor(detail.relation)}}>{detail.name}</div>
                <div className="row" style={{gap:6,marginTop:4,flexWrap:'wrap',alignItems:'center'}}>
                  <span className="pill" style={{padding:'2px 8px',fontSize:8,color:relColor(detail.relation),borderColor:relColor(detail.relation)}}>{REL_LABEL[detail.relation]}</span>
                  {detail.role && <span className="small" style={{color:'var(--gold-dim)'}}>{detail.role}</span>}
                  {s.dmMode && detail.revealed===false && <span className="dm-badge">NASCOSTO</span>}
                </div>
              </div>
              <button className="btn btn-ghost" style={{fontSize:16,padding:'2px 8px'}} onClick={()=>setDetailId(null)}>✕</button>
            </div>

            <div style={{cursor:'pointer',marginBottom:10}}
              onClick={()=>{const img=document.querySelector(`[data-slot="png-detail-${detail.id}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
              <div data-slot={'png-detail-'+detail.id}>
                <ImageSlot slotId={'png-'+detail.id} campaignId={campaignId} shape="rounded" width="100%" height={200} dmMode={s.dmMode} placeholder={s.dmMode?'📷 Ritratto':''} alt={detail.name} hideIfEmpty={!s.dmMode} />
              </div>
            </div>

            {detail.location && !s.dmMode && <div className="small muted" style={{marginBottom:6}}>📍 {detail.location}</div>}

            {s.dmMode ? (
              <>
                <input value={detail.name} onChange={e=>setField(detail.id,'name',e.target.value)} style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:14,color:'var(--gold)',marginBottom:4,background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',width:'100%'}} />
                <input value={detail.role||''} placeholder="Ruolo" onChange={e=>setField(detail.id,'role',e.target.value)} style={{marginBottom:4,fontSize:12,padding:'4px 8px',width:'100%'}} />
                <input value={detail.location||''} placeholder="Luogo" onChange={e=>setField(detail.id,'location',e.target.value)} style={{marginBottom:4,fontSize:12,padding:'4px 8px',width:'100%'}} />
                <textarea value={detail.note||''} placeholder="Note…" onChange={e=>setField(detail.id,'note',e.target.value)} style={{fontSize:12,padding:'6px 8px',minHeight:80,width:'100%'}} />
                <RevealsEditor list={detail.reveals} onChange={l=>setReveals(detail.id,l)} accent={relColor(detail.relation)} />
                <div className="row" style={{marginTop:10,gap:4,flexWrap:'wrap',alignItems:'center'}}>
                  <button className={'pill relation-'+detail.relation} style={{cursor:'pointer',fontSize:9}}
                    onClick={()=>setField(detail.id,'relation',REL_NEXT[detail.relation]||'neutral')}>{REL_LABEL[detail.relation]}</button>
                  <button className="btn btn-ghost" style={{padding:'2px 7px',fontSize:9}} title={detail.revealed===false?'Mostra ai giocatori':'Nascondi ai giocatori'}
                    onClick={()=>setField(detail.id,'revealed',detail.revealed===false)}>{detail.revealed===false?'◯':'◉'}</button>
                  <ReorderBtns
                    onUp={()=>{const i=s.characters.findIndex(x=>x.id===detail.id);update(prev=>({characters:moveInArray(prev.characters,i,-1)}));}}
                    onDown={()=>{const i=s.characters.findIndex(x=>x.id===detail.id);update(prev=>({characters:moveInArray(prev.characters,i,1)}));}}
                  />
                  <div className="grow" />
                  <button className="btn btn-danger btn-ghost" style={{padding:'2px 7px',fontSize:9}}
                    onClick={()=>{if(confirm('Eliminare?')){update(prev=>({characters:prev.characters.filter(x=>x.id!==detail.id)}));setDetailId(null);}}}>&times;</button>
                </div>
              </>
            ) : (
              <div style={{maxWidth:'62ch'}}>
                {detail.note
                  ? <div style={{fontSize:13,lineHeight:1.65,fontStyle:'italic'}}><Markdown text={detail.note}/></div>
                  : <div className="small muted">(nessuna nota)</div>}
                <RevealsView list={detail.reveals} dmMode={false} accent={relColor(detail.relation)} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
