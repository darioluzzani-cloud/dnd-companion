'use client';
import { useCampaignState } from '@/hooks/useCampaignState';
import { ImageSlot } from '@/components/ImageSlot';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { getSlotTotals, CasterType } from '@/lib/dnd/spell-slots';
import { CONDITIONS } from '@/lib/dnd/conditions';
import { CampaignState, uid } from '@/lib/types';
import { sfxDice, sfxReveal, sfxComplete } from '@/lib/dnd/sounds';
import { useState, useMemo, useCallback, ReactNode } from 'react';

const TABS = [
  {id:'quests',label:'Quest',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>},
  {id:'characters',label:'NPC',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>},
  {id:'lore',label:'Lore',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>},
  {id:'spells',label:'Magie',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>},
  {id:'inventory',label:'Inventario',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>},
  {id:'combat',label:'Battaglia',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 18L18 6M6 6l12 12"/></svg>},
  {id:'base',label:'Base',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>},
];
const LORE_CATS = ['oggetti','luoghi','culti','tutti'] as const;
const ITEM_TYPES = ['equipaggiamento','arma','armatura','magico','unico','consumabile','tesoro','quest','altro'];
const ITEM_TEMPLATES = [
  {name:'Pozione di cura',type:'consumabile',effect:'Recupera 2d4+2 PF',desc:'Liquido rosso che luccica quando viene agitato.'},
  {name:'Pozione di cura superiore',type:'consumabile',effect:'Recupera 4d4+4 PF',desc:'Liquido rosso brillante, più denso della versione base.'},
  {name:'Pozione di cura maggiore',type:'consumabile',effect:'Recupera 8d4+8 PF',desc:'Liquido cremisi con riflessi dorati.'},
  {name:'Razione giornaliera',type:'consumabile',effect:'Nutrimento per 1 giorno',desc:'Carne secca, frutta disidratata, gallette.'},
  {name:'Torcia',type:'equipaggiamento',effect:'Luce intensa 6m, luce fioca altri 6m. Dura 1 ora.',desc:''},
  {name:'Corda di canapa (15m)',type:'equipaggiamento',effect:'',desc:'Resistente, utile per scalare o legare.'},
  {name:'Arnesi da scasso',type:'equipaggiamento',effect:'Necessari per scassinare serrature (prova Destrezza)',desc:''},
  {name:'Kit da guaritore',type:'equipaggiamento',effect:'10 usi. Stabilizza una creatura a 0 PF.',desc:''},
  {name:'Spada lunga',type:'arma',effect:'1d8 tagliente (versatile 1d10)',desc:''},
  {name:'Spada corta',type:'arma',effect:'1d6 perforante (accuratezza, leggera)',desc:''},
  {name:'Arco lungo',type:'arma',effect:'1d8 perforante (munizioni, portata 45/180m, a due mani, pesante)',desc:''},
  {name:'Pugnale',type:'arma',effect:'1d4 perforante (accuratezza, leggera, lancio 6/18m)',desc:''},
  {name:'Ascia a due mani',type:'arma',effect:'1d12 tagliente (pesante, a due mani)',desc:''},
  {name:'Mazza',type:'arma',effect:'1d6 contundente',desc:''},
  {name:'Balestra leggera',type:'arma',effect:'1d8 perforante (munizioni, portata 24/96m, caricamento, a due mani)',desc:''},
  {name:'Armatura di cuoio',type:'armatura',effect:'CA 11 + mod DES',desc:''},
  {name:'Armatura di cuoio borchiato',type:'armatura',effect:'CA 12 + mod DES',desc:''},
  {name:'Cotta di maglia',type:'armatura',effect:'CA 16 (FOR 13 richiesta, svantaggio Furtività)',desc:''},
  {name:'Scudo',type:'armatura',effect:'+2 CA',desc:''},
  {name:"Monete d'oro",type:'tesoro',effect:'',desc:''},
  {name:"Monete d'argento",type:'tesoro',effect:'',desc:''},
  {name:"Monete di rame",type:'tesoro',effect:'',desc:''},
  {name:'Gemma',type:'tesoro',effect:'',desc:'Valore variabile a seconda del tipo.'},
];
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
      {s.tab === 'base' && <BaseTab s={s} update={update} campaignId={campaignId} />}

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
          <div style={{width:72,height:88,flexShrink:0}}>
            <ImageSlot slotId={'portrait-'+p.id} campaignId={campaignId} shape="rounded" dmMode={s.dmMode} placeholder={p.short.slice(0,2).toUpperCase()} alt={p.name} />
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
            <div className="row" style={{gap:6,marginTop:6,flexWrap:'wrap',alignItems:'center'}}>
              <div className="pill" style={{padding:'4px 8px',gap:4,flexShrink:0}}>
                <span style={{color:'var(--red)'}}>♥</span>
                <input type="number" value={p.hp??p.maxHp??0} onChange={e=>{const v=parseInt(e.target.value)||0;update(prev=>({players:prev.players.map(pl=>pl.id===p.id?{...pl,hp:v}:pl),combatants:prev.combatants.map(c=>c.id==='pc-'+p.id?{...c,hp:v}:c)}));}}
                  style={{width:30,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:13,fontWeight:600,color:'var(--text)',padding:0}} />
                <span className="muted">/</span>
                <input type="number" value={p.maxHp??0} onChange={e=>{const v=parseInt(e.target.value)||0;update(prev=>({players:prev.players.map(pl=>pl.id===p.id?{...pl,maxHp:v,hp:Math.min(pl.hp??0,v)}:pl),combatants:prev.combatants.map(c=>c.id==='pc-'+p.id?{...c,maxHp:v,hp:Math.min(c.hp,v)}:c)}));}}
                  style={{width:30,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:13,fontWeight:600,color:'var(--text)',padding:0}} />
                <span className="small muted" style={{fontSize:11}}>PF</span>
              </div>
              {p.species && !editing && <div className="pill" style={{padding:'4px 8px',color:'var(--purple-light)',flexShrink:0,fontSize:11}}>◆ {p.species}</div>}
            </div>
          </div>
        </div>
        {/* Companion */}
        {((p as any).companion || s.dmMode) && (
          <div className="card" style={{marginTop:10,padding:10}}>
            <div className="row" style={{gap:8}}>
              <div style={{width:40,height:40,flexShrink:0}}>
                <ImageSlot slotId={'companion-'+p.id} campaignId={campaignId} shape="circle" dmMode={s.dmMode} placeholder="🐾" alt={(p as any).companion?.name||'Companion'} />
              </div>
              <div className="grow">
                <input value={(p as any).companion?.name||''} placeholder="Nome companion"
                  onChange={e=>setP('companion' as any, {...((p as any).companion||{hp:10,maxHp:10}), name:e.target.value})}
                  style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:13,color:'var(--green)',background:'transparent',border:'1px solid var(--border)',padding:'2px 8px',marginBottom:3}} />
                <div className="row" style={{gap:4}}>
                  <span style={{color:'var(--red)',fontSize:12}}>♥</span>
                  <input type="number" value={(p as any).companion?.hp??0}
                    onChange={e=>{const v=parseInt(e.target.value)||0;const comp={...((p as any).companion||{name:'',maxHp:10}),hp:v};setP('companion' as any,comp);
                      // Sync verso combattente
                      update(prev=>({combatants:prev.combatants.map(c=>c.id==='comp-'+p.id?{...c,hp:v}:c)}));
                    }}
                    style={{width:30,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:13,fontWeight:600,color:'var(--text)',padding:0}} />
                  <span className="muted" style={{fontSize:12}}>/</span>
                  <input type="number" value={(p as any).companion?.maxHp??0}
                    onChange={e=>{const v=parseInt(e.target.value)||0;const comp={...((p as any).companion||{name:'',hp:0}),maxHp:v};if(comp.hp>v)comp.hp=v;setP('companion' as any,comp);
                      update(prev=>({combatants:prev.combatants.map(c=>c.id==='comp-'+p.id?{...c,maxHp:v,hp:Math.min(c.hp,v)}:c)}));
                    }}
                    style={{width:30,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:13,fontWeight:600,color:'var(--text)',padding:0}} />
                  <span className="small muted">PF</span>
                  {(() => {
                    const comp = (p as any).companion;
                    const pct = comp && comp.maxHp > 0 ? Math.round((comp.hp/comp.maxHp)*100) : 0;
                    return <div className="hp-bar" style={{flex:1}}><div className="hp-fill" style={{width:pct+'%',background:`hsl(${Math.round(pct*1.2)},65%,55%)`}} /></div>;
                  })()}
                </div>
              </div>
              {s.dmMode && !(p as any).companion && (
                <button className="btn" style={{fontSize:9}} onClick={()=>setP('companion' as any, {name:'',hp:10,maxHp:10})}>+ Companion</button>
              )}
            </div>
          </div>
        )}

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

        {/* Punteggi Caratteristica — 6x1, punteggio sopra, modificatore sotto */}
        {(() => {
          const abs = (p as any).abilities || {str:10,dex:10,con:10,int:10,wis:10,cha:10};
          const stats = [
            {k:'str',l:'FOR'},{k:'dex',l:'DES'},{k:'con',l:'COS'},
            {k:'int',l:'INT'},{k:'wis',l:'SAG'},{k:'cha',l:'CAR'}
          ];
          const mod = (v:number) => { const m=Math.floor((v-10)/2); return m>=0?'+'+m:''+m; };
          const setAb = (k:string,v:number) => setP('abilities' as any, {...abs, [k]:v});
          return (
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4,marginTop:10}}>
              {stats.map(s => {
                const val = abs[s.k] ?? 10;
                const m = Math.floor((val-10)/2);
                const modColor = m > 0 ? 'var(--green)' : m < 0 ? 'var(--red)' : 'var(--gray-purple)';
                return (
                  <div key={s.k} style={{
                    textAlign:'center',
                    background:'linear-gradient(180deg, #1a1230 0%, var(--bg-deep) 100%)',
                    border:'1px solid var(--border)',
                    borderTop:`2px solid ${p.color||'var(--gold)'}44`,
                    borderRadius:6,
                    padding:'4px 2px 5px',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  }}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:7,letterSpacing:'1px',color:'var(--gray-purple)',textTransform:'uppercase',marginBottom:1,width:'100%',textAlign:'center'}}>{s.l}</div>
                    <input type="number" value={val} onChange={e=>setAb(s.k,parseInt(e.target.value)||0)}
                      style={{width:'100%',maxWidth:40,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:15,fontWeight:600,color:'var(--text)',padding:0,lineHeight:1.1,display:'block',margin:'0 auto'}} />
                    <div style={{fontFamily:'var(--font-display)',fontSize:11,fontWeight:700,color:modColor,marginTop:1,width:'100%',textAlign:'center'}}>{mod(val)}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── TAB: QUEST ──────────────────────────────────────────────
function QuestsTab({ s, update, updScen, sc }: { s:CampaignState; update:U; updScen:(fn:(sc:any)=>any)=>void; sc:any }) {
  const sub = s.questSubTab || 'main';
  const quests = (sc?.quests||[]).filter((q:any)=>q.type===sub);
  // Visibilità: in PG mode nascondi quest non rivelate E scenari nascosti
  const visible = s.dmMode ? quests : quests.filter((q:any)=>q.revealed);
  const visibleScenarios = s.dmMode ? s.scenarios : s.scenarios.filter((sc2:any)=>sc2.revealed!==false);
  const [draft, setDraft] = useState('');
  const [newScenName, setNewScenName] = useState('');

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
      {/* === Lista scenari con CRUD === */}
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Scenari</div>
        {visibleScenarios.map(sc2 => (
          <div key={sc2.id} className="row" style={{gap:4,marginBottom:4}}>
            <button className={'btn grow'+(sc2.id===s.activeScenario?' btn-primary':'')}
              style={{textAlign:'left'}} onClick={()=>update({activeScenario:sc2.id})}>
              {sc2.name}
              {s.dmMode && (sc2 as any).revealed===false && <span className="dm-badge" style={{marginLeft:6}}>NASCOSTO</span>}
            </button>
            <div className={'pill scen-'+sc2.status} style={{padding:'3px 8px',fontSize:8,flexShrink:0}}>{sc2.status}</div>
            {s.dmMode && (
              <>
                <ReorderBtns onUp={()=>moveScen(sc2.id,-1)} onDown={()=>moveScen(sc2.id,1)} />
                <button className="btn btn-ghost" style={{padding:'2px 5px',fontSize:9}}
                  onClick={()=>toggleScenReveal(sc2.id)} title={(sc2 as any).revealed===false?'Mostra':'Nascondi'}>
                  {(sc2 as any).revealed===false?'◯':'◉'}
                </button>
                <button className="btn btn-danger btn-ghost" style={{padding:'2px 5px',fontSize:9}}
                  onClick={()=>delScenario(sc2.id)}>&times;</button>
              </>
            )}
          </div>
        ))}
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

// ─── TAB: MAGIE ──────────────────────────────────────────────
function SpellsTab({ s, update, updPlayer, p, campaignId }: { s:CampaignState; update:U; updPlayer:any; p:any; campaignId:string|null }) {
  const info = getLevelInfo(p.xp||0);
  const autoSlots = getSlotTotals((p.caster||'none') as CasterType, info.level);
  // customSlots sovrascrive i valori auto se presente
  const customSlots = (p as any).customSlots || {};
  const mergedSlots: Record<string, number> = {...autoSlots};
  Object.entries(customSlots).forEach(([lv, v]: [string, any]) => { if (typeof v?.max === 'number') mergedSlots[lv] = v.max; });
  const slots = mergedSlots;
  const used = p.slotsUsed || {};
  const byLevel: Record<number, any[]> = {};
  const visibleSpells = s.dmMode ? (p.spells||[]) : (p.spells||[]).filter((sp:any) => sp.revealed !== false);
  visibleSpells.forEach((sp:any) => { (byLevel[sp.level]=byLevel[sp.level]||[]).push(sp); });
  const [draftName, setDraftName] = useState('');
  const [draftLv, setDraftLv] = useState('1');
  const slotLabel = (p as any).slotLabel || 'Slot';
  const setCustomSlot = (lv:string, max:number) => updPlayer((pl:any)=>({...pl, customSlots:{...(pl.customSlots||{}), [lv]:{...(pl.customSlots?.[lv]||{}), max}}}));
  const setSlotLevelLabel = (lv:string, label:string) => updPlayer((pl:any)=>({...pl, customSlots:{...(pl.customSlots||{}), [lv]:{...(pl.customSlots?.[lv]||{}), label}}}));

  return (
    <div>
      <PlayerSelector s={s} update={update} p={p} campaignId={campaignId} />
      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:8}}>
          {s.dmMode ? (
            <input value={slotLabel} onChange={e=>updPlayer((pl:any)=>({...pl,slotLabel:e.target.value}))}
              style={{fontFamily:'var(--font-display)',fontSize:11,letterSpacing:'2px',textTransform:'uppercase',color:'var(--gray-purple)',background:'transparent',border:'1px solid var(--border)',padding:'2px 8px',width:160}} />
          ) : (
            <div className="label">{slotLabel} · {p.short||p.name}</div>
          )}
          <button className="btn" style={{fontSize:10}} onClick={()=>updPlayer((pl:any)=>({...pl,slotsUsed:{}}))}>Riposo lungo</button>
        </div>
        {Object.keys(slots).filter(lv=>slots[lv]>0).length===0 && !s.dmMode
          ? <div className="small muted" style={{fontStyle:'italic'}}>Nessuno slot incantesimo.</div>
          : Object.entries(slots).filter(([,max])=>max>0||s.dmMode).map(([lv,max]) => {
              const u = used[lv]||0;
              const lvLabel = customSlots[lv]?.label || ('Liv '+lv);
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
                  {s.dmMode ? (
                    <input value={lvLabel} onChange={e=>setSlotLevelLabel(lv,e.target.value)}
                      style={{width:50,fontSize:10,padding:'2px 4px',background:'transparent',border:'1px solid var(--border)',color:'var(--gray-purple)',textAlign:'right'}} />
                  ) : (
                    <div className="label" style={{width:40,textAlign:'right',fontSize:10}}>{lvLabel}</div>
                  )}
                  <div className="row" style={{gap:4,flexWrap:'wrap'}}>{boxes}</div>
                  <div className="small muted" style={{marginLeft:'auto',whiteSpace:'nowrap'}}>{u} / {max}</div>
                  {s.dmMode && (
                    <div className="row" style={{gap:2}}>
                      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setCustomSlot(lv,Math.max(0,(customSlots[lv]?.max??max)-1))}>−</button>
                      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setCustomSlot(lv,(customSlots[lv]?.max??max)+1)}>+</button>
                      <button className="btn btn-danger btn-ghost" style={{padding:'1px 5px',fontSize:9}} onClick={()=>{
                        updPlayer((pl:any)=>{
                          const cs = {...(pl.customSlots||{})};
                          cs[lv] = {...(cs[lv]||{}), max:0};
                          const su = {...(pl.slotsUsed||{})};
                          delete su[lv];
                          return {...pl, customSlots:cs, slotsUsed:su};
                        });
                      }} title="Rimuovi livello">&times;</button>
                    </div>
                  )}
                </div>
              );
            })
        }
        {s.dmMode && (
          <button className="btn" style={{fontSize:10,marginTop:6}} onClick={()=>{
            const newLv = String(Math.max(...Object.keys(slots).map(Number),0)+1);
            setCustomSlot(newLv, 1);
          }}>+ Aggiungi livello slot</button>
        )}
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
                    style={{width:30,height:30,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--bg-deep)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',transition:'all .15s',color:sp.expanded?p.color||'var(--gold)':'var(--gray-purple-deep)'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4 5.6 21.2 8 14 2 9.2h7.6z"/></svg>
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
                  {s.dmMode && (
                    <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9,flexShrink:0}}
                      onClick={()=>updPlayer((pl:any)=>({...pl,spells:pl.spells.map((ss:any)=>ss.id===sp.id?{...ss,revealed:sp.revealed===false?true:false}:ss)}))}
                      title={sp.revealed===false?'Rivela':'Nascondi'}>{sp.revealed===false?'◯':'◉'}</button>
                  )}
                </div>
                {s.dmMode && sp.revealed===false && <div className="dm-badge" style={{marginTop:4}}>SEGRETA</div>}
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
                      <div style={{fontSize:14,lineHeight:1.5,fontStyle:'italic'}}>{sp.desc||<span className="muted small" style={{fontStyle:'normal'}}>(nessuna descrizione)</span>}</div>
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
  const [filter, setFilter] = useState('tutti');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  const setItemField = (iid:string, f:string, v:any) => updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===iid?{...i,[f]:v}:i)}));
  const toggleExpand = (iid:string) => updPlayer((pl:any)=>({...pl,inventory:pl.inventory.map((i:any)=>i.id===iid?{...i,expanded:!i.expanded}:i)}));

  const allItems = [...(p.inventory||[])].sort((a:any,b:any)=>(b.equipped?1:0)-(a.equipped?1:0));
  const visibleItems = s.dmMode ? allItems : allItems.filter((it:any)=>it.revealed!==false);
  const filtered = filter==='tutti' ? visibleItems : visibleItems.filter((it:any)=>it.type===filter);

  return (
    <div>
      {/* Overlay immagine ingrandita */}
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      <PlayerSelector s={s} update={update} p={p} campaignId={campaignId} />
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Inventario</div>
        {/* Filtri per tipo */}
        <div className="row" style={{gap:5,flexWrap:'wrap',marginBottom:10}}>
          {['tutti',...ITEM_TYPES].map(t => (
            <button key={t} className="pill" style={{cursor:'pointer',padding:'4px 10px',fontSize:9,
              background:filter===t?'var(--bg-active)':'transparent',
              borderColor:filter===t?'var(--gold)':'var(--border)',
              color:filter===t?'var(--gold)':'var(--gray-purple-deep)'}}
              onClick={()=>setFilter(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun oggetto.</div>}
        {filtered.map((it:any) => (
          <div key={it.id} className="card" style={{
            borderLeft: it.equipped ? '3px solid '+(p.color||'var(--gold)') : '3px solid transparent',
            background: it.type==='magico' ? 'linear-gradient(90deg, rgba(80,140,220,.22) 0%, var(--bg-input) 40%)' :
                        it.type==='unico'  ? 'linear-gradient(90deg, rgba(180,50,90,.2) 0%, var(--bg-input) 40%)' :
                        undefined
          }}>
            <div className="row" style={{alignItems:'flex-start'}}>
              <button onClick={()=>setItemField(it.id,'equipped',!it.equipped)}
                title={it.equipped?'Rimuovi equipaggiamento':'Equipaggia'}
                style={{width:28,height:28,borderRadius:4,border:'1px solid '+(it.equipped?p.color||'var(--gold)':'var(--border)'),background:it.equipped?(p.color||'var(--gold)')+'22':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginTop:6,marginRight:6,fontSize:14,color:it.equipped?p.color||'var(--gold)':'var(--gray-purple-deep)'}}>
                {it.equipped ? '⚔' : '○'}
              </button>
              <div style={{width:42,height:42,flexShrink:0,cursor:'pointer',overflow:'hidden',borderRadius:6}}
                onClick={e=>{e.stopPropagation();const img=document.querySelector(`[data-slot="item-${it.id}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
                <div data-slot={'item-'+it.id} style={{width:42,height:42}}>
                  <ImageSlot slotId={'item-'+it.id} campaignId={campaignId} shape="rounded" width={42} height={42} dmMode={s.dmMode} placeholder=" " alt={it.name} />
                </div>
              </div>
              <div className="grow" style={{marginLeft:10,cursor:'pointer'}} onClick={()=>toggleExpand(it.id)}>
                {s.dmMode ? (
                  <input value={it.name} onClick={e=>e.stopPropagation()} onChange={e=>setItemField(it.id,'name',e.target.value)}
                    style={{fontWeight:500,background:'transparent',border:'1px solid var(--border)',padding:'3px 8px',marginBottom:3,fontSize:14}} />
                ) : (
                  <div style={{fontWeight:500}}>{it.name}</div>
                )}
                <div className="small muted">{it.type}</div>
              </div>
              <div className="row" style={{gap:3,flexShrink:0}}>
                <button className="btn" style={{padding:'2px 6px',fontSize:11}} onClick={()=>setItemField(it.id,'qty',Math.max(0,(it.qty||0)-1))}>−</button>
                <input type="number" value={it.qty||0}
                  onChange={e=>setItemField(it.id,'qty',Math.max(0,parseInt(e.target.value)||0))}
                  style={{width:44,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:14,fontWeight:600,color:'var(--text)',padding:'2px 0',borderRadius:4}} />
                <button className="btn" style={{padding:'2px 6px',fontSize:11}} onClick={()=>setItemField(it.id,'qty',(it.qty||0)+1)}>+</button>
              </div>
              {s.dmMode && <button className="btn btn-danger btn-ghost" style={{padding:'2px 6px',fontSize:9}} onClick={()=>updPlayer((pl:any)=>({...pl,inventory:pl.inventory.filter((i:any)=>i.id!==it.id)}))}>&times;</button>}
              {s.dmMode && (
                <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9,flexShrink:0}}
                  onClick={()=>setItemField(it.id,'revealed',it.revealed===false?true:false)}
                  title={it.revealed===false?'Rivela':'Nascondi'}>{it.revealed===false?'◯':'◉'}</button>
              )}
              <ReorderBtns
                onUp={()=>{const idx=(p.inventory||[]).findIndex((i:any)=>i.id===it.id);updPlayer((pl:any)=>({...pl,inventory:moveInArray(pl.inventory,idx,-1)}));}}
                onDown={()=>{const idx=(p.inventory||[]).findIndex((i:any)=>i.id===it.id);updPlayer((pl:any)=>({...pl,inventory:moveInArray(pl.inventory,idx,1)}));}}
              />
            </div>
            {/* Dettagli espandibili */}
            {it.expanded && (
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                {s.dmMode ? (
                  <>
                    <select value={it.type||'altro'} onChange={e=>setItemField(it.id,'type',e.target.value)} style={{fontSize:12,padding:'3px 6px',marginBottom:4}}>
                      {ITEM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <textarea value={it.effect||''} placeholder="Effetto (es. +1 ai tiri per colpire)" onChange={e=>setItemField(it.id,'effect',e.target.value)} style={{fontSize:13,padding:'6px 8px',minHeight:36,marginBottom:4}} />
                    <textarea value={it.desc||''} placeholder="Descrizione oggetto…" onChange={e=>setItemField(it.id,'desc',e.target.value)} style={{fontSize:13,padding:'6px 8px',minHeight:36}} />
                  </>
                ) : (
                  <>
                    {it.effect && <div style={{fontSize:14,lineHeight:1.5,color:'var(--gold)',marginBottom:4}}>✦ {it.effect}</div>}
                    <div style={{fontSize:14,lineHeight:1.5,fontStyle:'italic'}}>{it.desc||<span className="muted small" style={{fontStyle:'normal'}}>(nessuna descrizione)</span>}</div>
                  </>
                )}
                {/* Punti Usura — solo per arma e equipaggiamento */}
                {(it.type==='arma'||it.type==='armatura'||it.type==='magico'||it.type==='unico') && (
                  <div className="row" style={{gap:6,marginTop:6}}>
                    <span className="label" style={{fontSize:9}}>PU</span>
                    <input type="number" value={it.pu??0} onChange={e=>setItemField(it.id,'pu',Math.max(0,parseInt(e.target.value)||0))}
                      style={{width:44,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:13,color:((it.pu??0)>0)?'var(--red)':'var(--gray-purple)',padding:'2px 4px',borderRadius:4}} />
                    <span className="small muted">Punti Usura</span>
                  </div>
                )}
                {/* Cerchi potenziamento — arma, armatura, magico */}
                {(it.type==='arma'||it.type==='armatura'||it.type==='magico'||it.type==='unico') && (
                  <div className="row" style={{gap:8,marginTop:6}}>
                    <span className="label" style={{fontSize:9}}>Potenziamenti</span>
                    {[0,1,2].map(i => {
                      const maxSlots = it.enhSlots ?? 0;
                      const used = it.enhUsed ?? 0;
                      if (i >= maxSlots && !s.dmMode) return null;
                      const isFilled = i < used;
                      return i < maxSlots ? (
                        <button key={i} onClick={()=>setItemField(it.id,'enhUsed',isFilled ? Math.max(0,used-1) : Math.min(maxSlots,used+1))}
                          style={{width:22,height:22,borderRadius:'50%',border:'1px solid '+(isFilled?p.color||'var(--gold)':'var(--border)'),
                            background:isFilled?(p.color||'var(--gold)'):'transparent',cursor:'pointer',transition:'all .15s'}} />
                      ) : null;
                    })}
                    {s.dmMode && (
                      <div className="row" style={{gap:2,marginLeft:'auto'}}>
                        <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setItemField(it.id,'enhSlots',Math.max(0,(it.enhSlots??0)-1))}>−</button>
                        <span className="small muted">{it.enhSlots??0}/3</span>
                        <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10}} onClick={()=>setItemField(it.id,'enhSlots',Math.min(3,(it.enhSlots??0)+1))}>+</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {s.dmMode && (
          <div style={{marginTop:10}}>
            {/* Template oggetti comuni */}
            <div className="row" style={{gap:6,marginBottom:6}}>
              <select style={{flex:1,fontSize:12,padding:'5px 6px'}} defaultValue="" onChange={e=>{
                const tpl = ITEM_TEMPLATES.find(t=>t.name===e.target.value);
                if(tpl){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),...tpl,qty:1,expanded:false,equipped:false}]}));}
                e.target.value='';
              }}>
                <option value="" disabled>Inserisci da modello…</option>
                {ITEM_TEMPLATES.map(t=><option key={t.name} value={t.name}>{t.name} ({t.type})</option>)}
              </select>
            </div>
            <div className="row" style={{gap:6,marginBottom:6}}>
              <input className="grow" placeholder="…oppure crea nuovo" value={draftName} onChange={e=>setDraftName(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&draftName.trim()){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),name:draftName.trim(),qty:1,type:draftType,desc:'',effect:'',expanded:false,equipped:false,pu:0}]}));setDraftName('');}}} />
              <button className="btn btn-primary" onClick={()=>{if(draftName.trim()){updPlayer((pl:any)=>({...pl,inventory:[...pl.inventory,{id:uid('i'),name:draftName.trim(),qty:1,type:draftType,desc:'',effect:'',expanded:false,equipped:false,pu:0}]}));setDraftName('');}}}>+</button>
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
  const visibleCombatants = s.dmMode ? sorted : sorted.filter(k=>(k as any).revealed!==false);
  const idx = s.turnIndex||0;
  const current = sorted[idx % (sorted.length||1)];
  const [name,setName]=useState('');
  const [init,setInit]=useState('');
  const [hp,setHp]=useState('');
  const [dice,setDice]=useState(20);
  const [lastRoll,setLastRoll]=useState<{die:number;value:number;t:number}|null>(null);

  // HP change con sync bidirezionale combattente ↔ giocatore/companion
  const changeHp = (kId:string, delta:number) => {
    update(prev => {
      const newCombatants = prev.combatants.map(c =>
        c.id===kId ? {...c, hp: Math.max(0, Math.min(c.maxHp, c.hp + delta))} : c
      );
      let newPlayers = prev.players;
      // Sync verso player se è un PG
      if (kId.startsWith('pc-')) {
        const pId = kId.replace('pc-','');
        const comb = newCombatants.find(c=>c.id===kId);
        if (comb) {
          newPlayers = prev.players.map(p => p.id===pId ? {...p, hp: comb.hp, maxHp: comb.maxHp} : p);
        }
      }
      // Sync verso companion se è un companion
      if (kId.startsWith('comp-')) {
        const pId = kId.replace('comp-','');
        const comb = newCombatants.find(c=>c.id===kId);
        if (comb) {
          newPlayers = prev.players.map(p => p.id===pId && (p as any).companion
            ? {...p, companion: {...(p as any).companion, hp: comb.hp, maxHp: comb.maxHp}} as any
            : p);
        }
      }
      return { combatants: newCombatants, players: newPlayers };
    });
  };

  const nextTurn=()=>{let n=idx+1,r=s.round;if(n>=sorted.length){n=0;r++;}update({turnIndex:n,round:r});};
  const prevTurn=()=>{let n=idx-1,r=s.round;if(n<0){n=sorted.length-1;r=Math.max(1,r-1);}update({turnIndex:n,round:r});};

  // Importa i PG come combattenti (companion mostrato dentro la card del padrone)
  const addPlayers = () => {
    const existing = new Set((s.combatants||[]).map(c=>c.id));
    const newCombatants: any[] = [];
    s.players.forEach(p => {
      if (!existing.has('pc-'+p.id)) {
        newCombatants.push({
          id:'pc-'+p.id, name:p.name, init:p.init||10, hp:p.hp??p.maxHp??30, maxHp:p.maxHp??30, side:'ally' as const, conditions:[]
        });
      }
    });
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
        {visibleCombatants.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun combattente.</div>}
        {visibleCombatants.map((k,i) => {
          const isCurrent = sorted.indexOf(k)===(idx%sorted.length);
          const pct = Math.round(((k.hp||0)/(k.maxHp||1))*100);
          return (
            <div key={k.id} className={'card'+(isCurrent?' turn-indicator':'')}>
              <div className="row">
                {/* Ritratto — per tutti i combattenti */}
                <div style={{width:40,height:40,flexShrink:0,marginRight:4}}>
                  <ImageSlot slotId={k.id.startsWith('pc-')?'portrait-'+k.id.replace('pc-',''):k.id.startsWith('comp-')?'companion-'+k.id.replace('comp-',''):'combat-'+k.id} campaignId={campaignId} shape="circle" dmMode={s.dmMode} placeholder={k.name.slice(0,2).toUpperCase()} alt={k.name} />
                </div>
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
                    {(k.side==='ally'||s.dmMode) ? (
                      s.dmMode ? (
                        <div className="row" style={{gap:2}}>
                          <span style={{fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)'}}>{k.hp}/</span>
                          <input type="number" value={k.maxHp||0} onChange={e=>{const v=parseInt(e.target.value)||1;update(prev=>({combatants:prev.combatants.map(c=>c.id===k.id?{...c,maxHp:v,hp:Math.min(c.hp,v)}:c)}));}}
                            style={{width:40,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)',padding:'2px 4px'}} />
                        </div>
                      ) : (
                        <div style={{fontFamily:'var(--font-display)',fontSize:13,color:'var(--gray-purple)'}}>{k.hp}/{k.maxHp}</div>
                      )
                    ) : (
                      <div className="pill" style={{fontSize:9,padding:'2px 8px',color:'var(--red)',borderColor:'var(--pink-border)'}}>Nemico</div>
                    )}
                  </div>
                  {(k.side==='ally'||s.dmMode) && <>
                  <div className="hp-bar" style={{margin:'6px 0'}}><div className="hp-fill" style={{width:pct+'%',background:`hsl(${Math.round(pct*1.2)},65%,55%)`}} /></div>
                  <div className="row" style={{gap:4}}>
                    <button className="hp-btn hp-btn-neg" onClick={()=>changeHp(k.id,-5)}>-5</button>
                    <button className="hp-btn hp-btn-neg" onClick={()=>changeHp(k.id,-1)}>-1</button>
                    <button className="hp-btn hp-btn-pos" onClick={()=>changeHp(k.id,1)}>+1</button>
                    <button className="hp-btn hp-btn-pos" onClick={()=>changeHp(k.id,5)}>+5</button>
                  </div>
                  </>}
                  {/* Companion inline — nel turno del padrone */}
                  {k.id.startsWith('pc-') && (() => {
                    const owner = s.players.find(pl=>pl.id===k.id.replace('pc-',''));
                    const comp = owner && (owner as any).companion;
                    if (!comp || !comp.name) return null;
                    const compPct = comp.maxHp > 0 ? Math.round((comp.hp/comp.maxHp)*100) : 0;
                    return (
                      <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                        <div className="row" style={{gap:6}}>
                          <div style={{width:28,height:28,flexShrink:0}}>
                            <ImageSlot slotId={'companion-'+k.id.replace('pc-','')} campaignId={campaignId} shape="circle" dmMode={false} placeholder="🐾" alt={comp.name} />
                          </div>
                          <div className="grow">
                            <div style={{fontFamily:'var(--font-display)',fontSize:12,fontWeight:600,color:'var(--green)'}}>{comp.name}</div>
                            <div className="row" style={{gap:4}}>
                              <span style={{fontSize:11,color:'var(--red)'}}>♥</span>
                              <span style={{fontFamily:'var(--font-display)',fontSize:12}}>{comp.hp}/{comp.maxHp}</span>
                              <div className="hp-bar" style={{flex:1,height:4}}><div className="hp-fill" style={{width:compPct+'%',background:`hsl(${Math.round(compPct*1.2)},65%,55%)`}} /></div>
                            </div>
                          </div>
                          <div className="row" style={{gap:2}}>
                            <button className="hp-btn hp-btn-neg" style={{padding:'3px 6px',fontSize:10}} onClick={()=>{
                              update(prev=>({players:prev.players.map(p=>p.id===k.id.replace('pc-','')?{...p,companion:{...(p as any).companion,hp:Math.max(0,((p as any).companion?.hp??0)-1)}} as any:p)}));
                            }}>-1</button>
                            <button className="hp-btn hp-btn-pos" style={{padding:'3px 6px',fontSize:10}} onClick={()=>{
                              update(prev=>({players:prev.players.map(p=>p.id===k.id.replace('pc-','')?{...p,companion:{...(p as any).companion,hp:Math.min((p as any).companion?.maxHp??0,((p as any).companion?.hp??0)+1)}} as any:p)}));
                            }}>+1</button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
                      <button className="btn btn-ghost" style={{padding:'2px 6px',fontSize:9}}
                        onClick={()=>update(prev=>({combatants:prev.combatants.map(x=>x.id===k.id?{...x,revealed:(x as any).revealed===false?true:false} as any:x)}))}
                        title={(k as any).revealed===false?'Rivela':'Nascondi'}>{(k as any).revealed===false?'◯':'◉'}</button>
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
        <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>{sfxDice();const r=Math.floor(Math.random()*dice)+1;setLastRoll({die:dice,value:r,t:Date.now()});}}>Tira d{dice}</button>
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

// ─── TAB: BASE (Olmobianco) ──────────────────────────────────
const GATE_TYPES = [
  {id:'mondano',label:'Mondano',color:'var(--gold)',desc:'Sbloccato dalla fama'},
  {id:'esoterico',label:'Esoterico',color:'var(--blue)',desc:'Richiede conoscenza'},
  {id:'organico',label:'Organico',color:'var(--green)',desc:'Crescita naturale'},
];

function BaseTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const buildings: any[] = (s as any).buildings || [];
  const visible = s.dmMode ? buildings : buildings.filter((b:any)=>b.revealed!==false);
  const [draftName, setDraftName] = useState('');
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);

  const setBuilding = (id:string, patch:any) => update(prev => ({
    buildings: ((prev as any).buildings||[]).map((b:any) => b.id===id ? {...b,...patch} : b)
  } as any));
  const addBuilding = () => {
    if (!draftName.trim()) return;
    update(prev => ({
      buildings: [...((prev as any).buildings||[]), {
        id:uid('bld'), name:draftName.trim(), level:0, maxLevel:4,
        desc:'', nextDesc:'', gate:'mondano',
        costGold:0, costTime:'', costPeople:0,
        revealed:true, expanded:false,
      }]
    } as any));
    setDraftName('');
  };
  const delBuilding = (id:string) => {
    if (!confirm('Eliminare questo edificio?')) return;
    update(prev => ({buildings: ((prev as any).buildings||[]).filter((b:any)=>b.id!==id)} as any));
  };

  return (
    <div>
      {/* Overlay immagine ingrandita */}
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}

      <div className="frame">
        <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
          <div className="h1" style={{fontSize:18}}>Olmobianco</div>
          {s.dmMode && <div className="small muted">{buildings.length} edifici</div>}
        </div>

        {visible.length===0 && <div className="card muted small" style={{textAlign:'center'}}>Nessun edificio registrato.</div>}
        {visible.map((b:any) => {
          const gate = GATE_TYPES.find(g=>g.id===b.gate) || GATE_TYPES[0];
          const pct = b.maxLevel > 0 ? Math.round((b.level/b.maxLevel)*100) : 0;
          return (
            <div key={b.id} className="card" style={{borderLeft:`3px solid ${gate.color}`}}>
              {/* Header — click per espandere */}
              <div className="row" style={{cursor:'pointer',alignItems:'flex-start'}} onClick={()=>setBuilding(b.id,{expanded:!b.expanded})}>
                {/* Immagine verticale grande */}
                <div style={{width:64,height:88,flexShrink:0,overflow:'hidden',borderRadius:6,cursor:'pointer'}}
                  onClick={e=>{e.stopPropagation();const img=document.querySelector(`[data-slot="base-${b.id}"] img`) as HTMLImageElement;if(img?.src)setEnlargedImg(img.src);}}>
                  <div data-slot={'base-'+b.id} style={{width:64,height:88}}>
                    <ImageSlot slotId={'base-'+b.id} campaignId={campaignId} shape="rect" width={64} height={88} dmMode={s.dmMode} placeholder="🏠" alt={b.name} />
                  </div>
                </div>
                <div className="grow" style={{marginLeft:12}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div className="h2" style={{fontSize:15}}>{b.name}</div>
                    <div className="pill" style={{padding:'3px 8px',fontSize:9,color:gate.color,borderColor:gate.color}}>
                      Liv {b.level}/{b.maxLevel}
                    </div>
                  </div>
                  <div className="pill" style={{padding:'2px 7px',fontSize:8,marginTop:4,color:gate.color,borderColor:gate.color}}>{gate.label}</div>
                  {/* Barra progresso livello */}
                  <div style={{height:5,background:'var(--bg-deep)',borderRadius:3,overflow:'hidden',border:'1px solid var(--border)',marginTop:6}}>
                    <div style={{height:'100%',width:pct+'%',background:gate.color,borderRadius:3,transition:'width .3s'}} />
                  </div>
                  {b.revealed===false && s.dmMode && <span className="dm-badge" style={{marginTop:4}}>NASCOSTO</span>}
                </div>
                <span className="small muted" style={{marginLeft:6,fontSize:16,flexShrink:0}}>{b.expanded?'▾':'▸'}</span>
                <ReorderBtns
                  onUp={()=>{const idx=buildings.findIndex((x:any)=>x.id===b.id);update(prev=>({buildings:moveInArray((prev as any).buildings||[],idx,-1)} as any));}}
                  onDown={()=>{const idx=buildings.findIndex((x:any)=>x.id===b.id);update(prev=>({buildings:moveInArray((prev as any).buildings||[],idx,1)} as any));}}
                />
              </div>

              {/* Corpo espanso */}
              {b.expanded && (
                <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                  {/* Descrizione livello attuale */}
                  {s.dmMode ? (
                    <>
                      <input value={b.name} onChange={e=>setBuilding(b.id,{name:e.target.value})}
                        style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:14,color:'var(--gold)',background:'transparent',border:'1px solid var(--border)',padding:'4px 8px',marginBottom:4}} />
                      <textarea value={b.desc||''} placeholder="Descrizione livello attuale…" onChange={e=>setBuilding(b.id,{desc:e.target.value})}
                        style={{fontSize:13,padding:'6px 8px',minHeight:36,marginBottom:4}} />
                    </>
                  ) : (
                    b.desc && <div style={{fontSize:14,lineHeight:1.5,fontStyle:'italic',marginBottom:6}}>{b.desc}</div>
                  )}

                  {/* Prossimo livello */}
                  {b.level < b.maxLevel && (
                    <div style={{background:'var(--bg-deep)',border:'1px solid var(--border)',borderRadius:6,padding:10,marginBottom:6}}>
                      <div className="label" style={{fontSize:9,marginBottom:4}}>Prossimo upgrade (Liv {b.level+1})</div>
                      {s.dmMode ? (
                        <textarea value={b.nextDesc||''} placeholder="Cosa sblocca il prossimo livello…" onChange={e=>setBuilding(b.id,{nextDesc:e.target.value})}
                          style={{fontSize:13,padding:'5px 8px',minHeight:30,marginBottom:6}} />
                      ) : (
                        b.nextDesc && <div className="small" style={{marginBottom:6}}>{b.nextDesc}</div>
                      )}
                      <div className="row" style={{gap:10,flexWrap:'wrap'}}>
                        <div className="row" style={{gap:4}}>
                          <span style={{fontSize:12}}>🪙</span>
                          {s.dmMode ? (
                            <input type="number" value={b.costGold||0} onChange={e=>setBuilding(b.id,{costGold:parseInt(e.target.value)||0})}
                              style={{width:50,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontSize:12,padding:'2px 4px',borderRadius:4}} />
                          ) : (
                            <span className="small">{b.costGold||0} mo</span>
                          )}
                        </div>
                        <div className="row" style={{gap:4}}>
                          <span style={{fontSize:12}}>⏳</span>
                          {s.dmMode ? (
                            <input value={b.costTime||''} placeholder="es. 2 settimane" onChange={e=>setBuilding(b.id,{costTime:e.target.value})}
                              style={{width:100,background:'transparent',border:'1px solid var(--border)',fontSize:12,padding:'2px 4px',borderRadius:4}} />
                          ) : (
                            <span className="small">{b.costTime||'—'}</span>
                          )}
                        </div>
                        <div className="row" style={{gap:4}}>
                          <span style={{fontSize:12}}>👥</span>
                          {s.dmMode ? (
                            <input type="number" value={b.costPeople||0} onChange={e=>setBuilding(b.id,{costPeople:parseInt(e.target.value)||0})}
                              style={{width:40,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontSize:12,padding:'2px 4px',borderRadius:4}} />
                          ) : (
                            <span className="small">{b.costPeople||0} persone</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Controlli DM */}
                  {s.dmMode && (
                    <div style={{marginTop:6}}>
                      <div className="row" style={{gap:6,marginBottom:6}}>
                        <div className="label" style={{fontSize:9}}>Livello</div>
                        <button className="btn" style={{padding:'2px 8px',fontSize:11}} onClick={()=>setBuilding(b.id,{level:Math.max(0,b.level-1)})}>−</button>
                        <span style={{fontFamily:'var(--font-display)',fontSize:14,fontWeight:600}}>{b.level}</span>
                        <button className="btn" style={{padding:'2px 8px',fontSize:11}} onClick={()=>setBuilding(b.id,{level:Math.min(b.maxLevel,b.level+1)})}>+</button>
                        <div className="label" style={{fontSize:9,marginLeft:12}}>Max</div>
                        <input type="number" value={b.maxLevel||4} onChange={e=>setBuilding(b.id,{maxLevel:parseInt(e.target.value)||4})}
                          style={{width:36,textAlign:'center',background:'transparent',border:'1px solid var(--border)',fontSize:12,padding:'2px',borderRadius:4}} />
                      </div>
                      <div className="row" style={{gap:6,marginBottom:6}}>
                        <div className="label" style={{fontSize:9}}>Tipo</div>
                        {GATE_TYPES.map(g=>(
                          <button key={g.id} className="pill" style={{padding:'3px 8px',fontSize:9,cursor:'pointer',
                            color:g.color, borderColor:b.gate===g.id?g.color:'var(--border)',
                            background:b.gate===g.id?'var(--bg-active)':'transparent'}}
                            onClick={()=>setBuilding(b.id,{gate:g.id})}>{g.label}</button>
                        ))}
                      </div>
                      <div className="row" style={{gap:6}}>
                        <button className="btn btn-ghost" style={{fontSize:9}}
                          onClick={()=>setBuilding(b.id,{revealed:b.revealed===false?true:false})}>
                          {b.revealed===false?'◯ Nascondi':'◉ Visibile'}
                        </button>
                        <button className="btn btn-danger btn-ghost" style={{fontSize:9,marginLeft:'auto'}}
                          onClick={()=>delBuilding(b.id)}>Elimina</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Aggiungi edificio */}
        {s.dmMode && (
          <div className="row" style={{gap:6,marginTop:10}}>
            <input className="grow" placeholder="Nuovo edificio…" value={draftName} onChange={e=>setDraftName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')addBuilding();}} />
            <button className="btn btn-primary" onClick={addBuilding}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
