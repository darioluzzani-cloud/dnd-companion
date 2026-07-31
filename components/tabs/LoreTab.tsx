'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { U, moveInArray, ReorderBtns } from '@/components/shared/common';
import { Markdown } from '@/components/shared/textUtils';
import { RevealsView, RevealsEditor, RevealBadge } from '@/components/shared/Reveals';

const LORE_CATS = ['oggetti','luoghi','culti','fazioni'] as const;

// ─── TAB: LORE ───────────────────────────────────────────────
// Galleria compatta di riquadri quadrati; la lettura avviene in una
// finestra dedicata, con misura di riga controllata.
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
  const [detailId, setDetailId] = useState<string|null>(null);

  const setField = (id:string,f:string,v:any) => update(prev=>({lore:prev.lore.map(ll=>ll.id===id?{...ll,[f]:v}:ll)}));
  const detail: any = detailId ? all.find(l=>l.id===detailId) : null;

  return (
    <div>
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:250,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
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
          {filtered.map(l=>(
            <div key={l.id} className="card" style={{padding:0,overflow:'hidden',cursor:'pointer',opacity:!l.revealed&&s.dmMode?.65:1}}
              onClick={()=>setDetailId(l.id)}>
              <div style={{position:'relative',aspectRatio:'1 / 1'}}>
                <div data-slot={'lore-'+l.id} style={{width:'100%',height:'100%'}}>
                  <ImageSlot slotId={'lore-'+l.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder=" " alt={l.name} />
                </div>
                {s.dmMode && !l.revealed && <span className="dm-badge" style={{position:'absolute',top:6,left:6}}>SEGRETA</span>}
                {s.dmMode && (
                  <div style={{position:'absolute',bottom:6,right:6}} onClick={e=>e.stopPropagation()}>
                    <RevealBadge list={(l as any).reveals} onChange={x=>setField(l.id,'reveals',x)} />
                  </div>
                )}
              </div>
              <div style={{padding:'8px 10px'}}>
                <div style={{fontWeight:500,fontSize:14}}>{l.name}</div>
                {l.subtitle && <div className="small muted" style={{marginTop:1}}>{l.subtitle}</div>}
              </div>
            </div>
          ))}
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

      {/* ── Finestra di dettaglio ── */}
      {detail && (
        <div className="alchemy-overlay" onClick={e=>{if(e.target===e.currentTarget)setDetailId(null);}}>
          <div className="alchemy-popup sheet-popup" style={{maxWidth:560}}>
            <div className="row" style={{justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div className="grow">
                <div className="h2" style={{fontSize:18}}>{detail.name}</div>
                <div className="row" style={{gap:6,marginTop:4,flexWrap:'wrap',alignItems:'center'}}>
                  <span className={'pill lore-'+detail.category} style={{padding:'2px 8px',fontSize:8}}>{detail.category}</span>
                  {detail.subtitle && <span className="small muted">{detail.subtitle}</span>}
                  {s.dmMode && !detail.revealed && <span className="dm-badge">SEGRETA</span>}
                </div>
              </div>
              <button className="btn btn-ghost" style={{fontSize:16,padding:'2px 8px'}} onClick={()=>setDetailId(null)}>✕</button>
            </div>

            <div style={{cursor:'pointer',marginBottom:10}}
              onClick={()=>{const img=document.querySelector(`[data-slot="lore-detail-${detail.id}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
              <div data-slot={'lore-detail-'+detail.id}>
                <ImageSlot slotId={'lore-'+detail.id} campaignId={campaignId} shape="rounded" width="100%" height={200} dmMode={s.dmMode} placeholder={s.dmMode?'📷 Immagine':''} alt={detail.name} hideIfEmpty={!s.dmMode}
                  objectPosition={`center ${detail.imgPos ?? 50}%`} />
              </div>
            </div>

            {s.dmMode && (
              <div className="row" style={{gap:8,alignItems:'center',marginBottom:10}}>
                <span className="label" style={{fontSize:8}}>Inquadratura</span>
                <input type="range" min={0} max={100} value={detail.imgPos ?? 50}
                  onChange={e=>setField(detail.id,'imgPos',parseInt(e.target.value))}
                  style={{flex:1}} title="Sposta il ritaglio verso l'alto o verso il basso" />
                <span className="small muted" style={{fontSize:10,width:32,textAlign:'right'}}>{detail.imgPos ?? 50}%</span>
              </div>
            )}

            {s.dmMode ? (
              <>
                <input value={detail.name} onChange={e=>setField(detail.id,'name',e.target.value)}
                  style={{fontWeight:500,background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',marginBottom:4,fontSize:13,width:'100%'}} />
                <input value={detail.subtitle||''} placeholder="Sottotitolo" onChange={e=>setField(detail.id,'subtitle',e.target.value)}
                  style={{fontSize:12,background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',marginBottom:4,width:'100%'}} />
                <textarea value={detail.text||''} placeholder="Testo della voce…" onChange={e=>setField(detail.id,'text',e.target.value)} style={{fontSize:12,padding:'8px',minHeight:120,width:'100%'}} />
                <RevealsEditor list={detail.reveals} onChange={x=>setField(detail.id,'reveals',x)} />
                <div className="row" style={{marginTop:10,gap:4,alignItems:'center'}}>
                  <button className="btn btn-ghost" style={{padding:'2px 7px',fontSize:9}} title={detail.revealed?'Nascondi ai giocatori':'Mostra ai giocatori'}
                    onClick={()=>setField(detail.id,'revealed',!detail.revealed)}>{detail.revealed?'◉':'◯'}</button>
                  <ReorderBtns
                    onUp={()=>{const i=all.findIndex(x=>x.id===detail.id);update(prev=>({lore:moveInArray(prev.lore,i,-1)}));}}
                    onDown={()=>{const i=all.findIndex(x=>x.id===detail.id);update(prev=>({lore:moveInArray(prev.lore,i,1)}));}}
                  />
                  <div className="grow" />
                  <button className="btn btn-danger btn-ghost" style={{padding:'2px 7px',fontSize:9}}
                    onClick={()=>{if(confirm('Eliminare?')){update(prev=>({lore:prev.lore.filter(x=>x.id!==detail.id)}));setDetailId(null);}}}>&times;</button>
                </div>
              </>
            ) : (
              <div style={{maxWidth:'62ch'}}>
                {detail.text
                  ? <div style={{fontSize:13,lineHeight:1.65,fontStyle:'italic'}}><Markdown text={detail.text}/></div>
                  : <div className="small muted">(testo non ancora redatto)</div>}
                <RevealsView list={detail.reveals} dmMode={false} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
