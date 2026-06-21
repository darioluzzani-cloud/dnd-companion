'use client';
import { useCampaignState } from '@/hooks/useCampaignState';
import { ImageSlot } from '@/components/ImageSlot';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { getSlotTotals, CasterType } from '@/lib/dnd/spell-slots';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { CampaignState, uid } from '@/lib/types';
import { useState, useMemo, useCallback } from 'react';

const TABS = [
  {id:'quests',label:'Quest'},{id:'characters',label:'PNG'},{id:'spells',label:'Magie'},
  {id:'inventory',label:'Inv.'},{id:'combat',label:'Lotta'},{id:'lore',label:'Lore'},
];
const LORE_CATS = ['oggetti','luoghi','culti','tutti'] as const;
const ITEM_TYPES = ['equipaggiamento','arma','armatura','magico','consumabile','tesoro','quest','altro'];
const REL_NEXT: Record<string,string> = {ally:'enemy',enemy:'neutral',neutral:'ally'};

export function CampaignApp({ slug }: { slug: string }) {
  const { state: s, update, loading, error, campaignId } = useCampaignState(slug);

  const activePlayer = useMemo(() => s.players.find(p => p.id === s.activePlayer) || s.players[0], [s.players, s.activePlayer]);
  const activeScen = useMemo(() => s.scenarios.find(sc => sc.id === s.activeScenario) || s.scenarios[0], [s.scenarios, s.activeScenario]);

  const updPlayer = useCallback((fn: (p: typeof activePlayer) => typeof activePlayer) => {
    update(prev => ({ players: prev.players.map(p => p.id === prev.activePlayer ? fn(p) : p) }));
  }, [update]);

  const updScen = useCallback((fn: (sc: typeof activeScen) => typeof activeScen) => {
    update(prev => ({ scenarios: prev.scenarios.map(sc => sc.id === prev.activeScenario ? fn(sc) : sc) }));
  }, [update]);

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <div className="small">Caricamento campagna…</div>
    </div>
  );
  if (error) return (
    <div className="loading-screen">
      <div className="h2 danger">Errore</div>
      <div className="small">{error}</div>
    </div>
  );

  return (
    <div className="app-wrap">
      {/* === HEADER === */}
      <div className="topbar">
        <div>
          <div className="campaign-title">{s.campaign}</div>
          <div className="campaign-sub">Compagno di Sessione</div>
        </div>
        <div className="row">
          <button
            className="btn"
            style={s.dmMode ? {background:'var(--gold)',color:'var(--bg-deep)',borderColor:'var(--gold)'} : undefined}
            onClick={() => update({dmMode:!s.dmMode})}
          >{s.dmMode ? 'DM' : 'PG'}</button>
        </div>
      </div>

      {/* === TAB BAR === */}
      <div className="tab-bar">
        {TABS.map(t => (
          <div key={t.id} className={'tab'+(s.tab===t.id?' active':'')} onClick={()=>update({tab:t.id})}>{t.label}</div>
        ))}
      </div>

      {/* === TAB CONTENT === */}
      {s.tab === 'quests' && <QuestsTab s={s} update={update} updScen={updScen} sc={activeScen} />}
      {s.tab === 'characters' && <CharactersTab s={s} update={update} campaignId={campaignId} />}
      {s.tab === 'spells' && <SpellsTab s={s} update={update} updPlayer={updPlayer} p={activePlayer} campaignId={campaignId} />}
      {s.tab === 'inventory' && <InventoryTab s={s} update={update} updPlayer={updPlayer} p={activePlayer} campaignId={campaignId} />}
      {s.tab === 'combat' && <CombatTab s={s} update={update} />}
      {s.tab === 'lore' && <LoreTab s={s} update={update} campaignId={campaignId} />}

      {/* === BACKUP (DM only) === */}
      {s.dmMode && (
        <div className="frame" style={{marginTop:18}}>
          <div className="label" style={{marginBottom:8}}>Backup</div>
          <div className="row" style={{flexWrap:'wrap',gap:6}}>
            <button className="btn" onClick={() => {
              const blob = new Blob([JSON.stringify(s,null,2)],{type:'application/json'});
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = 'velmora-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
            }}>Esporta</button>
            <label className="btn" style={{cursor:'pointer'}}>
              Importa
              <input type="file" accept="application/json" style={{display:'none'}} onChange={e => {
                const file = e.target.files?.[0]; if (!file) return;
                const fr = new FileReader();
                fr.onload = () => { try { const d=JSON.parse(fr.result as string); if(confirm('Sovrascrivere?')) update(d); } catch{alert('File non valido');} };
                fr.readAsText(file); e.target.value='';
              }} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
type U = (p: Partial<CampaignState> | ((s:CampaignState)=>Partial<CampaignState>)) => void;

function PlayerSelector({ s, update, p, campaignId }: { s:CampaignState; update:U; p: CampaignState['players'][0]; campaignId:string|null }) {
  const info = getLevelInfo(p.xp||0);
  return (
    <div className="frame">
      <div className="row" style={{gap:8,marginBottom:10}}>
        <div style={{width:56,height:56,flexShrink:0}}>
          <ImageSlot slotId={'portrait-'+p.id} campaignId={campaignId} shape="circle" dmMode={s.dmMode} placeholder={p.short.slice(0,2).toUpperCase()} alt={p.name} />
        </div>
        <div className="grow">
          <div className="h2" style={{color:p.color}}>{p.name}</div>
          <div className="small muted">{p.cls} · Liv. {info.level}</div>
          <div className="xp-bar" style={{marginTop:4}}><div className="xp-fill" style={{width:info.pct+'%'}} /></div>
          <div className="small muted" style={{marginTop:2}}>{info.text}</div>
        </div>
      </div>
      <div className="row" style={{flexWrap:'wrap',gap:6}}>
        {s.players.map(pl => (
          <button key={pl.id} className={'btn'+(pl.id===s.activePlayer?' btn-primary':'')} onClick={()=>update({activePlayer:pl.id})}
            style={pl.id===s.activePlayer?{borderColor:pl.color}:undefined}>{pl.short||pl.name}</button>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: QUEST ──────────────────────────────────────────────
function QuestsTab({ s, update, updScen, sc }: { s:CampaignState; update:U; updScen:(fn:(sc:any)=>any)=>void; sc:any }) {
  const sub = s.questSubTab || 'main';
  const quests = (sc?.quests||[]).filter((q:any)=>q.type===sub);
  const visible = s.dmMode ? quests : quests.filter((q:any)=>q.revealed);
  const [draft, setDraft] = useState('');

  return (
    <div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Scenari</div>
        <div className="row" style={{flexWrap:'wrap',gap:6,marginBottom:10}}>
          {s.scenarios.map(sc2 => (
            <button key={sc2.id} className={'btn'+(sc2.id===s.activeScenario?' btn-primary':'')} onClick={()=>update({activeScenario:sc2.id})}>{sc2.name}</button>
          ))}
        </div>
      </div>
      <div className="frame">
        <div className="row" style={{marginBottom:8}}>
          <div className="h2 grow">{sc?.name}</div>
          <div className={'pill scen-'+(sc?.status||'futuro')}>{sc?.status}</div>
        </div>
        {s.dmMode && (
          <div className="row" style={{gap:6,marginBottom:10}}>
            {(['futuro','corso','concluso'] as const).map(st => (
              <button key={st} className={'btn'+(sc?.status===st?' btn-primary':'')} onClick={()=>updScen(x=>({...x,status:st}))}>{st}</button>
            ))}
          </div>
        )}
        <div className="row" style={{gap:6,marginBottom:10}}>
          <button className={'btn'+(sub==='main'?' btn-primary':'')} onClick={()=>update({questSubTab:'main'})}>Principali</button>
          <button className={'btn'+(sub==='side'?' btn-primary':'')} onClick={()=>update({questSubTab:'side'})}>Secondarie</button>
        </div>
        {visible.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessuna quest.</div>}
        {visible.map((q:any) => (
          <div key={q.id} className="card">
            <div className="row" style={{alignItems:'flex-start'}}>
              <button onClick={()=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,done:!qq.done}:qq)}))}
                style={{width:20,height:20,borderRadius:4,marginTop:2,border:'1px solid '+(q.done?'var(--green)':'var(--border)'),
                  background:q.done?'var(--green)':'var(--bg-deep)',color:'var(--bg-deep)',fontSize:13,lineHeight:1,flexShrink:0}}>
                {q.done?'✓':''}
              </button>
              <div className="grow" style={{marginLeft:8}}>
                <div style={{fontWeight:500,textDecoration:q.done?'line-through':'none'}}>
                  {q.title}
                  {s.dmMode&&!q.revealed && <span className="dm-badge">SEGRETA</span>}
                </div>
                {q.desc && <div className="small muted" style={{marginTop:3}}>{q.desc}</div>}
              </div>
              {s.dmMode && (
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <button className="btn btn-ghost" style={{padding:'3px 7px',fontSize:9}}
                    onClick={()=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,revealed:!qq.revealed}:qq)}))}>{q.revealed?'◉':'◯'}</button>
                  <button className="btn btn-danger btn-ghost" style={{padding:'3px 7px',fontSize:9}}
                    onClick={()=>updScen(x=>({...x,quests:x.quests.filter((qq:any)=>qq.id!==q.id)}))}>&times;</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:10}}>
            <input className="grow" placeholder="Nuova quest…" value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&draft.trim()){updScen(x=>({...x,quests:[...x.quests,{id:uid('q'),type:sub,title:draft.trim(),desc:'',done:false,revealed:false}]}));setDraft('');}}} />
            <button className="btn btn-primary" onClick={()=>{if(draft.trim()){updScen(x=>({...x,quests:[...x.quests,{id:uid('q'),type:sub,title:draft.trim(),desc:'',done:false,revealed:false}]}));setDraft('');}}}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: PNG ────────────────────────────────────────────────
function CharactersTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <div className="frame">
        <div className="label" style={{marginBottom:10}}>Personaggi Non Giocanti</div>
        {s.characters.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun PNG.</div>}
        {s.characters.map(c => (
          <div key={c.id} className="card">
            <div className="row" style={{alignItems:'flex-start'}}>
              <div style={{width:54,height:54,flexShrink:0}}>
                <ImageSlot slotId={'png-'+c.id} campaignId={campaignId} shape="circle" dmMode={s.dmMode} placeholder={c.name.slice(0,2).toUpperCase()} alt={c.name} />
              </div>
              <div className="grow" style={{marginLeft:10}}>
                <div className="h2">{c.name}</div>
                {c.role && <div className="small muted">{c.role}</div>}
                {c.location && <div className="small muted">{c.location}</div>}
                {c.note && <div style={{fontSize:13,marginTop:4}}>{c.note}</div>}
                <div className="row" style={{marginTop:6,gap:6}}>
                  <button className={'pill relation-'+c.relation} style={{cursor:'pointer'}}
                    onClick={()=>update(prev=>({characters:prev.characters.map(cc=>cc.id===c.id?{...cc,relation:(REL_NEXT[cc.relation]||'neutral') as any}:cc)}))}>{c.relation==='ally'?'Alleato':c.relation==='enemy'?'Nemico':'Neutrale'}</button>
                  {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'3px 8px',fontSize:9,marginLeft:'auto'}}
                    onClick={()=>{if(confirm('Eliminare?'))update(prev=>({characters:prev.characters.filter(cc=>cc.id!==c.id)}));}}>Elimina</button>}
                </div>
              </div>
            </div>
          </div>
        ))}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:10}}>
            <input className="grow" placeholder="Nuovo PNG…" value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&draft.trim()){update(prev=>({characters:[...prev.characters,{id:uid('c'),name:draft.trim(),role:'',location:'',relation:'neutral',note:''}]}));setDraft('');}}} />
            <button className="btn btn-primary" onClick={()=>{if(draft.trim()){update(prev=>({characters:[...prev.characters,{id:uid('c'),name:draft.trim(),role:'',location:'',relation:'neutral',note:''}]}));setDraft('');}}}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: MAGIE ──────────────────────────────────────────────
function SpellsTab({ s, update, updPlayer, p, campaignId }: { s:CampaignState; update:U; updPlayer:any; p:any; campaignId:string|null }) {
  const info = getLevelInfo(p.xp||0);
  const slots = getSlotTotals((p.caster||'none') as CasterType, info.level);
  const used = p.slotsUsed || {};
  const byLevel: Record<number, any[]> = {};
  (p.spells||[]).forEach((sp:any) => { (byLevel[sp.level]=byLevel[sp.level]||[]).push(sp); });
  const [draftName, setDraftName] = useState('');
  const [draftLv, setDraftLv] = useState('1');

  return (
    <div>
      <PlayerSelector s={s} update={update} p={p} campaignId={campaignId} />
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Slot Incantesimi</div>
        {Object.keys(slots).length===0
          ? <div className="small muted">Nessuno slot per questa classe/livello.</div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:8}}>
              {Object.entries(slots).map(([lv,max]) => {
                const u = used[lv]||0;
                return (
                  <div key={lv} className="card" style={{margin:0,padding:8}}>
                    <div className="label" style={{fontSize:9}}>Liv. {lv}</div>
                    <div style={{fontFamily:'var(--font-display)',fontSize:18,color:'var(--gold)',textAlign:'center'}}>{max-u}/{max}</div>
                    <div className="row" style={{gap:4,justifyContent:'center',marginTop:4}}>
                      <button className="btn" style={{padding:'2px 8px',fontSize:11}} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{...pl.slotsUsed,[lv]:Math.max(0,(pl.slotsUsed?.[lv]||0)-1)}}))}>+</button>
                      <button className="btn" style={{padding:'2px 8px',fontSize:11}} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{...pl.slotsUsed,[lv]:Math.min(max,(pl.slotsUsed?.[lv]||0)+1)}}))}>−</button>
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Incantesimi</div>
        {Object.keys(byLevel).map(n=>parseInt(n)).sort((a,b)=>a-b).map(lv => (
          <div key={lv} style={{marginBottom:10}}>
            <div className="h3" style={{margin:'4px 0 6px'}}>{lv===0?'Trucchi':'Livello '+lv}</div>
            {byLevel[lv].map((sp:any) => (
              <div key={sp.id} className="card">
                <div className="row">
                  <button onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,prepared:!ss.prepared}:ss)}))}
                    style={{width:18,height:18,borderRadius:'50%',border:'1px solid '+(sp.prepared?'var(--gold)':'var(--border)'),background:sp.prepared?'var(--gold)':'transparent',flexShrink:0}} />
                  <div className="grow" style={{marginLeft:8,cursor:'pointer'}} onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,expanded:!ss.expanded}:ss)}))}>
                    <div style={{fontWeight:500}}>{sp.name}</div>
                    {sp.school && <div className="small muted">{sp.school}</div>}
                  </div>
                  {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}} onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.filter((ss:any)=>ss.id!==sp.id)}))}>&times;</button>}
                </div>
                {sp.expanded && <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid var(--border)'}}><div style={{fontSize:13}}>{sp.desc||<span className="muted small">(nessuna descrizione)</span>}</div></div>}
              </div>
            ))}
          </div>
        ))}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:10}}>
            <input className="grow" placeholder="Nuovo incantesimo…" value={draftName} onChange={e=>setDraftName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&draftName.trim()){updPlayer((pl:any)=>({...pl,spells:[...pl.spells,{id:uid('s'),name:draftName.trim(),level:parseInt(draftLv),school:'',desc:'',prepared:false,expanded:false}]}));setDraftName('');}}} />
            <select style={{width:64}} value={draftLv} onChange={e=>setDraftLv(e.target.value)}>
              {[0,1,2,3,4,5,6,7,8,9].map(n=><option key={n} value={n}>{n===0?'Trk':'L'+n}</option>)}
            </select>
            <button className="btn btn-primary" onClick={()=>{if(draftName.trim()){updPlayer((pl:any)=>({...pl,spells:[...pl.spells,{id:uid('s'),name:draftName.trim(),level:parseInt(draftLv),school:'',desc:'',prepared:false,expanded:false}]}));setDraftName('');}}}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: INVENTARIO ─────────────────────────────────────────
function InventoryTab({ s, update, updPlayer, p, campaignId }: { s:CampaignState; update:U; updPlayer:any; p:any; campaignId:string|null }) {
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState('equipaggiamento');
  return (
    <div>
      <PlayerSelector s={s} update={update} p={p} campaignId={campaignId} />
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Inventario</div>
        {(p.inventory||[]).length===0 && <div className="card muted small" style={{textAlign:'center'}}>Inventario vuoto.</div>}
        {(p.inventory||[]).map((it:any) => (
          <div key={it.id} className="card">
            <div className="row" style={{alignItems:'flex-start'}}>
              <div style={{width:42,height:42,flexShrink:0}}>
                <ImageSlot slotId={'item-'+it.id} campaignId={campaignId} shape="rounded" dmMode={s.dmMode} placeholder=" " alt={it.name} />
              </div>
              <div className="grow" style={{marginLeft:10}}>
                <div style={{fontWeight:500}}>{it.name}</div>
                <div className="small muted">{it.type}</div>
              </div>
              <div className="row" style={{gap:4,flexShrink:0}}>
                <button className="btn" style={{padding:'2px 8px'}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===it.id?{...i,qty:Math.max(0,(i.qty||0)-1)}:i)}))}>−</button>
                <div style={{minWidth:24,textAlign:'center',fontFamily:'var(--font-display)'}}>{it.qty||0}</div>
                <button className="btn" style={{padding:'2px 8px'}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===it.id?{...i,qty:(i.qty||0)+1}:i)}))}>+</button>
              </div>
              {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.filter((i:any)=>i.id!==it.id)}))}>&times;</button>}
            </div>
          </div>
        ))}
        {s.dmMode && (
          <div style={{marginTop:10}}>
            <div className="row" style={{gap:6,marginBottom:6}}>
              <input className="grow" placeholder="Nuovo oggetto…" value={draftName} onChange={e=>setDraftName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&draftName.trim()){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),name:draftName.trim(),qty:1,type:draftType}]}));setDraftName('');}}} />
              <button className="btn btn-primary" onClick={()=>{if(draftName.trim()){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),name:draftName.trim(),qty:1,type:draftType}]}));setDraftName('');}}}>+</button>
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

// ─── TAB: COMBATTIMENTO ──────────────────────────────────────
function CombatTab({ s, update }: { s:CampaignState; update:U }) {
  const sorted = [...(s.combatants||[])].sort((a,b)=>(b.init||0)-(a.init||0));
  const idx = s.turnIndex||0;
  const current = sorted[idx % (sorted.length||1)];
  const [name,setName]=useState('');
  const [init,setInit]=useState('');
  const [hp,setHp]=useState('');
  const [dice,setDice]=useState(20);
  const [lastRoll,setLastRoll]=useState<{die:number;value:number;t:number}|null>(null);

  const nextTurn=()=>{let n=idx+1,r=s.round;if(n>=sorted.length){n=0;r++;}update({turnIndex:n,round:r});};
  const prevTurn=()=>{let n=idx-1,r=s.round;if(n<0){n=sorted.length-1;r=Math.max(1,r-1);}update({turnIndex:n,round:r});};

  return (
    <div>
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
          <div>
            <div className="label">Round</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:22,color:'var(--gold)'}}>{s.round}</div>
          </div>
          <div className="row" style={{gap:6}}>
            <button className="btn" onClick={prevTurn}>◀</button>
            <button className="btn btn-primary" onClick={nextTurn}>Succ.</button>
            <button className="btn btn-danger btn-ghost" onClick={()=>{if(confirm('Reset?'))update({round:1,turnIndex:0});}}>Reset</button>
          </div>
        </div>
        {current && <div className="small"><span className="muted">Turno:</span> <strong style={{color:'var(--gold)'}}>{current.name}</strong></div>}
      </div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Iniziativa</div>
        {sorted.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun combattente.</div>}
        {sorted.map((k,i) => {
          const isCurrent = i===(idx%sorted.length);
          const pct = Math.round(((k.hp||0)/(k.maxHp||1))*100);
          return (
            <div key={k.id} className={'card'+(isCurrent?' turn-indicator':'')}>
              <div className="row">
                <div style={{width:32,height:32,borderRadius:'50%',background:'var(--bg-deep)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',color:'var(--gold)',flexShrink:0}}>{k.init||0}</div>
                <div className="grow" style={{marginLeft:8}}>
                  <div style={{fontWeight:500}}>{k.name}</div>
                  <div className="row" style={{gap:6,alignItems:'center'}}>
                    <button className="btn" style={{padding:'2px 8px',color:'var(--pink)'}} onClick={()=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,hp:Math.max(0,c.hp-1)}:c)}))}>−</button>
                    <div style={{minWidth:60,textAlign:'center',fontFamily:'var(--font-display)'}}>{k.hp}/{k.maxHp}</div>
                    <button className="btn" style={{padding:'2px 8px',color:'var(--green-light)'}} onClick={()=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,hp:Math.min(c.maxHp,c.hp+1)}:c)}))}>+</button>
                    <div className="grow hp-bar"><div className="hp-fill" style={{width:pct+'%'}} /></div>
                  </div>
                  {/* Condizioni */}
                  {(k.conditions||[]).length>0 && (
                    <div className="row" style={{gap:4,marginTop:4,flexWrap:'wrap'}}>
                      {k.conditions!.map(cid => { const c=CONDITIONS.find(x=>x.id===cid); return c?<span key={cid} className="pill" style={{fontSize:8,padding:'2px 6px',color:c.color,borderColor:c.color}}>{c.label}</span>:null; })}
                    </div>
                  )}
                  {s.dmMode && (
                    <div className="row" style={{gap:4,marginTop:6,flexWrap:'wrap'}}>
                      {CONDITIONS.map(c => {
                        const active=(k.conditions||[]).includes(c.id);
                        return <button key={c.id} className="pill" style={{fontSize:7,padding:'2px 5px',cursor:'pointer',opacity:active?1:.4,color:c.color,borderColor:c.color}}
                          onClick={()=>update(prev=>({combatants:prev.combatants.map(x=>x.id===k.id?{...x,conditions:active?(x.conditions||[]).filter(cc=>cc!==c.id):[...(x.conditions||[]),c.id]}:x)}))}>{c.label}</button>;
                      })}
                      <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9,marginLeft:'auto'}}
                        onClick={()=>{if(confirm('Rimuovere?'))update(prev=>({combatants:prev.combatants.filter(x=>x.id!==k.id)}));}}>&times;</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {s.dmMode && (
          <div style={{marginTop:10}}>
            <div className="row" style={{gap:6}}>
              <input placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} style={{flex:1}} />
              <input placeholder="Init" value={init} onChange={e=>setInit(e.target.value)} style={{width:52}} />
              <input placeholder="PF" value={hp} onChange={e=>setHp(e.target.value)} style={{width:52}} />
              <button className="btn btn-primary" onClick={()=>{if(name.trim()){update(prev=>({combatants:[...prev.combatants,{id:uid('k'),name:name.trim(),init:parseInt(init)||10,hp:parseInt(hp)||10,maxHp:parseInt(hp)||10,side:'enemy'}]}));setName('');setInit('');setHp('');}}}>+</button>
            </div>
          </div>
        )}
      </div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Dado</div>
        <div className="row" style={{gap:6,flexWrap:'wrap',marginBottom:8}}>
          {[4,6,8,10,12,20,100].map(n=>(
            <button key={n} className={'btn'+(dice===n?' btn-primary':'')} onClick={()=>setDice(n)}>d{n}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>{const r=Math.floor(Math.random()*dice)+1;setLastRoll({die:dice,value:r,t:Date.now()});}}>Tira d{dice}</button>
        {lastRoll && (
          <div className="dice-display roll-anim" key={lastRoll.t} style={{marginTop:10}}>
            <div className="small muted" style={{fontFamily:'var(--font-body)',fontSize:10}}>d{lastRoll.die}</div>
            <div>{lastRoll.value}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: LORE ───────────────────────────────────────────────
function LoreTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const filter = s.loreCatFilter || 'tutti';
  const all = s.lore || [];
  const visible = filter==='tutti' ? all : all.filter(l=>l.category===filter);
  const filtered = s.dmMode ? visible : visible.filter(l=>l.revealed);
  const [draftName,setDraftName]=useState('');
  const [draftSub,setDraftSub]=useState('');
  const [draftCat,setDraftCat]=useState<string>('oggetti');

  return (
    <div>
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
        {filtered.map(l=>(
          <div key={l.id} className="card">
            <div className="row" style={{alignItems:'flex-start'}}>
              <div style={{width:46,height:46,flexShrink:0}}>
                <ImageSlot slotId={'lore-'+l.id} campaignId={campaignId} shape="rounded" dmMode={s.dmMode} placeholder=" " alt={l.name} />
              </div>
              <div className="grow" style={{marginLeft:10,cursor:'pointer'}} onClick={()=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,expanded:!ll.expanded}:ll)}))}>
                <div style={{fontWeight:500}}>
                  {l.name}
                  {s.dmMode&&!l.revealed && <span className="dm-badge">SEGRETA</span>}
                </div>
                {l.subtitle && <div className="small muted">{l.subtitle}</div>}
                <div className={'pill lore-'+l.category} style={{marginTop:4}}>{l.category}</div>
              </div>
              {s.dmMode && (
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <button className="btn btn-ghost" style={{padding:'3px 7px',fontSize:9}} onClick={()=>update(prev=>({lore:prev.lore.map(ll=>ll.id===l.id?{...ll,revealed:!ll.revealed}:ll)}))}>{l.revealed?'◉':'◯'}</button>
                  <button className="btn btn-danger btn-ghost" style={{padding:'3px 7px',fontSize:9}} onClick={()=>{if(confirm('Eliminare?'))update(prev=>({lore:prev.lore.filter(ll=>ll.id!==l.id)}));}}>&times;</button>
                </div>
              )}
            </div>
            {l.expanded && (
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                <div style={{fontSize:13,whiteSpace:'pre-wrap'}}>{l.text||<span className="muted small">(testo non ancora redatto)</span>}</div>
              </div>
            )}
          </div>
        ))}
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
