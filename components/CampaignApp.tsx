'use client';
import { useCampaignState } from '@/hooks/useCampaignState';
import { ImageSlot } from '@/components/ImageSlot';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { getSlotTotals, CasterType } from '@/lib/dnd/spell-slots';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { CampaignState, uid } from '@/lib/types';
import { useState, useMemo, useCallback, ReactNode } from 'react';

const TABS = [
  {id:'quests',label:'Quest',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>},
  {id:'characters',label:'NPC',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>},
  {id:'lore',label:'Lore',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>},
  {id:'spells',label:'Magie',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>},
  {id:'inventory',label:'Bottino',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>},
  {id:'combat',label:'Battaglia',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 18L18 6M6 6l12 12"/></svg>},
];
const LORE_CATS = ['oggetti','luoghi','culti','tutti'] as const;
const ITEM_TYPES = ['equipaggiamento','arma','armatura','magico','consumabile','tesoro','quest','altro'];
const REL_NEXT: Record<string,string> = {ally:'enemy',enemy:'neutral',neutral:'ally'};

// Helper: sposta un elemento su/giù in un array
function moveInArray<T>(arr: T[], idx: number, dir: -1|1): T[] {
  const next = idx + dir;
  if (next < 0 || next >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[next]] = [copy[next], copy[idx]];
  return copy;
}

// Pulsanti riordino
function ReorderBtns({ onUp, onDown }: { onUp:()=>void; onDown:()=>void }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:1,flexShrink:0,marginLeft:4}}>
      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10,lineHeight:1}} onClick={e=>{e.stopPropagation();onUp();}}>▲</button>
      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10,lineHeight:1}} onClick={e=>{e.stopPropagation();onDown();}}>▼</button>
    </div>
  );
}

// Sottoclassi note che cambiano il caster type
const SUBCLASS_CASTER: Record<string, Record<string, CasterType>> = {
  'Ladro':     { 'Mistificatore Arcano': 'third' },
  'Guerriero': { 'Cavaliere Mistico': 'third' },
  'Rogue':     { 'Arcane Trickster': 'third' },
  'Fighter':   { 'Eldritch Knight': 'third' },
};

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
        <div className="grow">
          {s.dmMode ? (
            <input value={s.campaign} onChange={e=>update({campaign:e.target.value})}
              style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:20,color:'var(--gold)',background:'transparent',border:'1px solid var(--border)',padding:'4px 10px',width:'100%',letterSpacing:'1px'}} />
          ) : (
            <div className="campaign-title">{s.campaign}</div>
          )}
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
          <div key={t.id} className={'tab'+(s.tab===t.id?' active':'')} onClick={()=>update({tab:t.id})}>
            {t.icon}
            {t.label}
          </div>
        ))}
      </div>

      {/* === TAB CONTENT === */}
      {s.tab === 'quests' && <QuestsTab s={s} update={update} updScen={updScen} sc={activeScen} />}
      {s.tab === 'characters' && <CharactersTab s={s} update={update} campaignId={campaignId} />}
      {s.tab === 'spells' && <SpellsTab s={s} update={update} updPlayer={updPlayer} p={activePlayer} campaignId={campaignId} />}
      {s.tab === 'inventory' && <InventoryTab s={s} update={update} updPlayer={updPlayer} p={activePlayer} campaignId={campaignId} />}
      {s.tab === 'combat' && <CombatTab s={s} update={update} campaignId={campaignId} />}
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
  const [editing, setEditing] = useState(false);
  const setP = (f:string,v:any) => update(prev=>({players:prev.players.map(pl=>pl.id===p.id?{...pl,[f]:v}:pl)}));
  return (
    <div className="frame">
      {/* Player tabs */}
      <div className="row" style={{gap:6,marginBottom:12}}>
        {s.players.map(pl => (
          <div key={pl.id} className={'player-tab'+(pl.id===s.activePlayer?' active':'')} onClick={()=>update({activePlayer:pl.id})}
            style={pl.id===s.activePlayer?{borderColor:pl.color}:undefined}>
            <div className="dot" style={{background:pl.color}} />
            <div>{pl.short||pl.name}</div>
          </div>
        ))}
      </div>
      {/* Player card */}
      <div className="card">
        <div className="row" style={{gap:10,alignItems:'flex-start'}}>
          <div style={{width:64,height:64,flexShrink:0}}>
            <ImageSlot slotId={'portrait-'+p.id} campaignId={campaignId} shape="circle" dmMode={s.dmMode} placeholder={p.short.slice(0,2).toUpperCase()} alt={p.name} />
          </div>
          <div className="grow">
            <div className="row" style={{justifyContent:'space-between',marginBottom:4}}>
              {editing ? (
                <input value={p.name} onChange={e=>{setP('name',e.target.value);setP('short',e.target.value);}}
                  style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:16,color:p.color,background:'transparent',border:'1px solid var(--border)',padding:'2px 8px',flex:1,marginRight:8}} />
              ) : (
                <div className="h2" style={{color:p.color,fontSize:16}}>{p.name}</div>
              )}
              <div className="row" style={{gap:6}}>
                <button className="btn btn-ghost" style={{padding:'4px 6px',fontSize:12}} onClick={()=>setEditing(!editing)} title="Modifica">✎</button>
                <div className="pill" style={{padding:'4px 10px',color:p.color,borderColor:p.color,fontWeight:600}}>Lv {info.level}</div>
              </div>
            </div>
            {editing ? (
              <div style={{marginBottom:6}}>
                <div className="row" style={{gap:4,marginBottom:4}}>
                  <input value={p.cls} placeholder="Classe" onChange={e=>setP('cls',e.target.value)} style={{fontSize:13,padding:'3px 8px',flex:1}} />
                  <select value={p.caster||'none'} onChange={e=>setP('caster',e.target.value)} style={{width:80,fontSize:12,padding:'3px 6px'}}>
                    <option value="full">Full</option><option value="half">Half</option><option value="third">Third</option><option value="none">None</option>
                  </select>
                </div>
                <input value={(p as any).subclass||''} placeholder="Sottoclasse (es. Mistificatore Arcano)"
                  onChange={e=>{
                    const sub=e.target.value;
                    setP('subclass' as any, sub);
                    // Auto-detect caster type from subclass
                    const lookup = SUBCLASS_CASTER[p.cls];
                    if(lookup && lookup[sub]) setP('caster', lookup[sub]);
                  }}
                  style={{fontSize:13,padding:'3px 8px',marginBottom:4}} />
                <div className="row" style={{gap:4}}>
                  <input value={p.species||''} placeholder="Specie" onChange={e=>setP('species',e.target.value)} style={{fontSize:13,padding:'3px 8px',flex:1}} />
                  <input type="color" value={p.color||'#a489dd'} onChange={e=>setP('color',e.target.value)} style={{width:28,height:28,padding:0,border:'none',cursor:'pointer'}} />
                </div>
              </div>
            ) : (
              <div className="small muted">{p.cls}{(p as any).subclass ? ' — '+(p as any).subclass : ''}</div>
            )}
            {/* HP — editabile da chiunque */}
            <div className="row" style={{gap:8,marginTop:6}}>
              <div className="pill" style={{padding:'4px 10px',gap:4}}>
                <span style={{color:'var(--red)'}}>♥</span>
                <input type="number" value={p.hp??p.maxHp??0} onChange={e=>setP('hp',parseInt(e.target.value)||0)}
                  style={{width:32,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:14,fontWeight:600,color:'var(--text)',padding:0}} />
                <span className="muted">/</span>
                <input type="number" value={p.maxHp??0} onChange={e=>{const v=parseInt(e.target.value)||0;setP('maxHp',v);if((p.hp??0)>v)setP('hp',v);}}
                  style={{width:32,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:14,fontWeight:600,color:'var(--text)',padding:0}} />
                <span className="small muted">PF</span>
              </div>
              {p.species && !editing && <div className="pill" style={{padding:'4px 10px',color:'var(--purple-light)'}}>◆ {p.species}</div>}
            </div>
          </div>
        </div>
        {/* XP bar — colore del giocatore */}
        <div className="xp-bar" style={{marginTop:10}}><div style={{height:'100%',borderRadius:'3px',transition:'width .35s',width:info.pct+'%',background:`linear-gradient(90deg, ${p.color}88, ${p.color})`}} /></div>
        <div className="row" style={{marginTop:4,justifyContent:'space-between'}}>
          <div className="row" style={{gap:4}}>
            <input type="number" value={p.xp||0} onChange={e=>setP('xp',parseInt(e.target.value)||0)}
              style={{width:60,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:12,color:'var(--text)',padding:'2px 4px',borderRadius:4}} />
            <span className="small muted">/ {info.next} PE</span>
          </div>
          <div className="row" style={{gap:4}}>
            <button className="btn" style={{padding:'2px 8px',fontSize:10}} onClick={()=>setP('xp',(p.xp||0)+100)}>+100</button>
            <button className="btn" style={{padding:'2px 8px',fontSize:10}} onClick={()=>setP('xp',(p.xp||0)+500)}>+500</button>
          </div>
        </div>
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
          {s.dmMode ? (
            <input value={sc?.name||''} onChange={e=>updScen(x=>({...x,name:e.target.value}))}
              className="grow" style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,color:'var(--gold)',background:'transparent',border:'1px solid var(--border)',padding:'4px 10px'}} />
          ) : (
            <div className="h2 grow">{sc?.name}</div>
          )}
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
                {s.dmMode ? (
                  <input value={q.title} onChange={e=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,title:e.target.value}:qq)}))}
                    style={{fontWeight:500,textDecoration:q.done?'line-through':'none',background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',fontSize:14}} />
                ) : (
                  <div style={{fontWeight:500,textDecoration:q.done?'line-through':'none'}}>{q.title}</div>
                )}
                  {s.dmMode&&!q.revealed && <span className="dm-badge">SEGRETA</span>}
                {q.desc && !s.dmMode && <div className="small muted" style={{marginTop:3}}>{q.desc}</div>}
                {s.dmMode && <textarea value={q.desc||''} placeholder="Descrizione…" style={{marginTop:4,fontSize:13,padding:'6px 8px',minHeight:36}}
                  onChange={e=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,desc:e.target.value}:qq)}))} />}
              </div>
              {s.dmMode && (
                <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'center'}}>
                  <button className="btn btn-ghost" style={{padding:'3px 7px',fontSize:9}}
                    onClick={()=>updScen(x=>({...x,quests:x.quests.map((qq:any)=>qq.id===q.id?{...qq,revealed:!qq.revealed}:qq)}))}>{q.revealed?'◉':'◯'}</button>
                  <button className="btn btn-danger btn-ghost" style={{padding:'3px 7px',fontSize:9}}
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
  const [filter, setFilter] = useState('tutti');
  const setField = (id:string,f:string,v:string) => update(prev=>({characters:prev.characters.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const filtered = filter==='tutti' ? s.characters : s.characters.filter(c=>c.relation===filter);

  return (
    <div>
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
              <div style={{width:48,height:48,flexShrink:0}}>
                <ImageSlot slotId={'png-'+c.id} campaignId={campaignId} shape="circle" dmMode={s.dmMode} placeholder={c.name.slice(0,2).toUpperCase()} alt={c.name} />
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
                    {c.note && <div style={{fontSize:14,lineHeight:1.6}}>{c.note}</div>}
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
        <div className="row" style={{justifyContent:'space-between',marginBottom:8}}>
          <div className="label">Slot · {p.short||p.name}</div>
          <button className="btn" style={{fontSize:10}} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{}}))}>Riposo lungo</button>
        </div>
        {Object.keys(slots).length===0
          ? <div className="small muted" style={{fontStyle:'italic'}}>Nessuno slot incantesimo.</div>
          : Object.entries(slots).map(([lv,max]) => {
              const u = used[lv]||0;
              const boxes = [];
              for (let i=0; i<max; i++) {
                const isUsed = i < u;
                boxes.push(
                  <button key={i} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{...pl.slotsUsed,[lv]: isUsed ? Math.max(0,(pl.slotsUsed?.[lv]||0)-1) : (pl.slotsUsed?.[lv]||0)+1 }}))}
                    style={{width:24,height:24,borderRadius:4,border:'1px solid '+(isUsed?p.color||'var(--gold)':'var(--border)'),
                      background:isUsed?(p.color||'var(--gold)'):'transparent',cursor:'pointer',transition:'all .15s'}} />
                );
              }
              return (
                <div key={lv} className="row" style={{gap:8,marginBottom:6}}>
                  <div className="label" style={{width:40,textAlign:'right',fontSize:10}}>Liv {lv}</div>
                  <div className="row" style={{gap:4,flexWrap:'wrap'}}>{boxes}</div>
                  <div className="small muted" style={{marginLeft:'auto',whiteSpace:'nowrap'}}>{max-u} / {max}</div>
                </div>
              );
            })
        }
      </div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Repertorio · tocca per i dettagli</div>
        {Object.keys(byLevel).map(n=>parseInt(n)).sort((a,b)=>a-b).map(lv => (
          <div key={lv} style={{marginBottom:10}}>
            <div className="h3" style={{margin:'4px 0 6px'}}>{lv===0?'Trucchi':'Livello '+lv}</div>
            {byLevel[lv].map((sp:any,spIdx:number) => {
              const allSpells = p.spells||[];
              const globalIdx = allSpells.findIndex((x:any)=>x.id===sp.id);
              return (
              <div key={sp.id} className="card" style={{borderLeft:sp.prepared?`3px solid ${p.color||'var(--gold)'}`:'3px solid transparent'}}>
                <div className="row">
                  <button onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,expanded:!ss.expanded}:ss)}))}
                    style={{width:28,height:28,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--bg-deep)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14,color:'var(--gray-purple)',cursor:'pointer'}}>
                    {sp.expanded ? '−' : '+'}
                  </button>
                  <div className="grow" style={{marginLeft:8,cursor:'pointer'}} onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,expanded:!ss.expanded}:ss)}))}>
                    <div style={{fontWeight:600,fontFamily:'var(--font-display)',fontSize:14,letterSpacing:'.3px'}}>{sp.name}</div>
                    {sp.school && <div className="small muted" style={{fontSize:12}}>{sp.school}</div>}
                  </div>
                  <div className="pill" style={{padding:'3px 8px',fontSize:9,color:lv===0?'var(--purple)':'var(--gold)',borderColor:lv===0?'var(--purple)':'var(--gold)'}}>
                    {lv===0 ? 'Trucco' : 'Liv '+lv}
                  </div>
                  <ReorderBtns
                    onUp={()=>updPlayer((pl:any)=>({...pl,spells:moveInArray(pl.spells,globalIdx,-1)}))}
                    onDown={()=>updPlayer((pl:any)=>({...pl,spells:moveInArray(pl.spells,globalIdx,1)}))}
                  />
                </div>
                {sp.expanded && (
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                    <div className="row" style={{gap:6,marginBottom:6}}>
                      <button className={'pill'} style={{cursor:'pointer',padding:'4px 10px',
                        background:sp.prepared?(p.color||'var(--gold)'):'transparent',
                        color:sp.prepared?'var(--bg-deep)':'var(--gray-purple)',
                        borderColor:p.color||'var(--gold)'}}
                        onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,prepared:!ss.prepared}:ss)}))}>
                        {sp.prepared ? '✓ Preparato' : 'Preparare'}
                      </button>
                      {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'2px 8px',fontSize:9,marginLeft:'auto'}} onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.filter((ss:any)=>ss.id!==sp.id)}))}>&times; Rimuovi</button>}
                    </div>
                    {s.dmMode ? (
                      <>
                        <input value={sp.school||''} placeholder="Scuola" onChange={e=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,school:e.target.value}:ss)}))} style={{marginBottom:4,fontSize:13,padding:'4px 8px'}} />
                        <textarea value={sp.desc||''} placeholder="Descrizione…" onChange={e=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,desc:e.target.value}:ss)}))} style={{fontSize:13,padding:'6px 8px',minHeight:40}} />
                      </>
                    ) : (
                      <div style={{fontSize:14,lineHeight:1.5}}>{sp.desc||<span className="muted small">(nessuna descrizione)</span>}</div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
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
                {s.dmMode ? (
                  <>
                    <input value={it.name} onChange={e=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===it.id?{...i,name:e.target.value}:i)}))}
                      style={{fontWeight:500,background:'transparent',border:'1px solid var(--border)',padding:'3px 8px',marginBottom:3,fontSize:14}} />
                    <select value={it.type||'altro'} onChange={e=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===it.id?{...i,type:e.target.value}:i)}))} style={{fontSize:12,padding:'3px 6px'}}>
                      {ITEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <div style={{fontWeight:500}}>{it.name}</div>
                    <div className="small muted">{it.type}</div>
                  </>
                )}
              </div>
              <div className="row" style={{gap:4,flexShrink:0}}>
                <button className="btn" style={{padding:'2px 8px'}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===it.id?{...i,qty:Math.max(0,(i.qty||0)-1)}:i)}))}>−</button>
                <div style={{minWidth:24,textAlign:'center',fontFamily:'var(--font-display)'}}>{it.qty||0}</div>
                <button className="btn" style={{padding:'2px 8px'}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===it.id?{...i,qty:(i.qty||0)+1}:i)}))}>+</button>
              </div>
              {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.filter((i:any)=>i.id!==it.id)}))}>&times;</button>}
              <ReorderBtns
                onUp={()=>{const idx=(p.inventory||[]).findIndex((i:any)=>i.id===it.id);updPlayer((pl:any)=>({...pl,inventory:moveInArray(pl.inventory,idx,-1)}));}}
                onDown={()=>{const idx=(p.inventory||[]).findIndex((i:any)=>i.id===it.id);updPlayer((pl:any)=>({...pl,inventory:moveInArray(pl.inventory,idx,1)}));}}
              />
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
function CombatTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
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

  // Importa i PG come combattenti
  const addPlayers = () => {
    const existing = new Set((s.combatants||[]).map(c=>c.id));
    const newCombatants = s.players.filter(p=>!existing.has('pc-'+p.id)).map(p=>({
      id:'pc-'+p.id, name:p.name, init:p.init||10, hp:p.hp??p.maxHp??30, maxHp:p.maxHp??30, side:'ally' as const, conditions:[]
    }));
    if(newCombatants.length) update(prev=>({combatants:[...prev.combatants,...newCombatants]}));
  };

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
        <div className="row" style={{justifyContent:'space-between',marginBottom:8}}>
          <div className="label">Ordine di Iniziativa</div>
          {s.dmMode && <button className="btn" style={{fontSize:10}} onClick={addPlayers}>+ PG</button>}
        </div>
        {sorted.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun combattente.</div>}
        {sorted.map((k,i) => {
          const isCurrent = i===(idx%sorted.length);
          const pct = Math.round(((k.hp||0)/(k.maxHp||1))*100);
          return (
            <div key={k.id} className={'card'+(isCurrent?' turn-indicator':'')}>
              <div className="row">
                {/* Ritratto PG se disponibile */}
                {k.id.startsWith('pc-') && (
                  <div style={{width:40,height:40,flexShrink:0,marginRight:4}}>
                    <ImageSlot slotId={'portrait-'+k.id.replace('pc-','')} campaignId={campaignId} shape="circle" dmMode={false} placeholder={k.name.slice(0,2).toUpperCase()} alt={k.name} />
                  </div>
                )}
                <div className="init-circle" title="Iniziativa">
                  {s.dmMode ? (
                    <input type="number" value={k.init||0} onChange={e=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,init:parseInt(e.target.value)||0}:c)}))}
                      style={{width:32,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:16,color:'var(--gold)',padding:0}} />
                  ) : k.init||0}
                </div>
                <div className="grow" style={{marginLeft:8}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    {s.dmMode ? (
                      <input value={k.name} onChange={e=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,name:e.target.value}:c)}))}
                        style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,background:'transparent',border:'1px solid var(--border)',padding:'2px 8px',flex:1,marginRight:8}} />
                    ) : (
                      <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15}}>{k.name}</div>
                    )}
                    {s.dmMode ? (
                      <div className="row" style={{gap:2}}>
                        <span style={{fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)'}}>{k.hp}/</span>
                        <input type="number" value={k.maxHp||0} onChange={e=>{const v=parseInt(e.target.value)||1;update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,maxHp:v,hp:Math.min(c.hp,v)}:c)}));}}
                          style={{width:40,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)',padding:'2px 4px'}} />
                      </div>
                    ) : (
                      <div style={{fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)'}}>{k.hp}/{k.maxHp}</div>
                    )}
                  </div>
                  <div className="hp-bar" style={{margin:'6px 0'}}><div className="hp-fill" style={{width:pct+'%'}} /></div>
                  <div className="row" style={{gap:4}}>
                    <button className="hp-btn hp-btn-neg" onClick={()=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,hp:Math.max(0,c.hp-5)}:c)}))}>-5</button>
                    <button className="hp-btn hp-btn-neg" onClick={()=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,hp:Math.max(0,c.hp-1)}:c)}))}>-1</button>
                    <button className="hp-btn hp-btn-pos" onClick={()=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,hp:Math.min(c.maxHp,c.hp+1)}:c)}))}>+1</button>
                    <button className="hp-btn hp-btn-pos" onClick={()=>update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,hp:Math.min(c.maxHp,c.hp+5)}:c)}))}>+5</button>
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
                  <div style={{fontSize:14,whiteSpace:'pre-wrap',lineHeight:1.6}}>{l.text||<span className="muted small">(testo non ancora redatto)</span>}</div>
                )}
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
