'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { getLevelInfo } from '@/lib/dnd/xp-table';
import { sfxDice } from '@/lib/dnd/sounds';
import { SheetPopup } from '@/components/popups/SheetPopup';
import { FeatsPopup } from '@/components/popups/FeatsPopup';
import { CasterType } from '@/lib/dnd/spell-slots';
import { U, computeAC } from '@/components/shared/common';

// Sottoclassi note che cambiano il caster type
const SUBCLASS_CASTER: Record<string, Record<string, CasterType>> = {
  'Ladro':     { 'Mistificatore Arcano': 'third' },
  'Guerriero': { 'Cavaliere Mistico': 'third' },
  'Rogue':     { 'Arcane Trickster': 'third' },
  'Fighter':   { 'Eldritch Knight': 'third' },
};

export function PlayerSelector({ s, update, p, campaignId }: { s:CampaignState; update:U; p: CampaignState['players'][0]; campaignId:string|null }) {
  const info = getLevelInfo(p.xp||0);
  const [editing, setEditing] = useState(false);
  const [lastHd, setLastHd] = useState<{pid:string;roll:number;heal:number}|null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showFeats, setShowFeats] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [die, setDie] = useState(20);
  const [lastRoll, setLastRoll] = useState<{die:number;value:number;t:number}|null>(null);
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
                <button className="btn btn-ghost" style={{padding:'4px 6px'}} title={(p as any).inspiration ? 'Ispirazione Eroica: attiva' : 'Ispirazione Eroica: assente'}
                  onClick={()=>setP('inspiration' as any, !(p as any).inspiration)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={(p as any).inspiration ? 'var(--gold)' : 'none'} stroke={(p as any).inspiration ? 'var(--gold)' : 'var(--gray-purple-deep)'} strokeWidth="1.5">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                  </svg>
                </button>
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
                  <input type="number" value={(p as any).initBonus||0} title="Bonus extra all'iniziativa (es. talento Allerta)"
                    onChange={e=>setP('initBonus' as any, parseInt(e.target.value)||0)} style={{width:52,fontSize:13,padding:'3px 6px',textAlign:'center'}} />
                  <span className="small muted" style={{fontSize:10}}>iniz.</span>
                  <input type="color" value={p.color||'#a489dd'} onChange={e=>setP('color',e.target.value)} style={{width:28,height:28,padding:0,border:'none',cursor:'pointer'}} />
                </div>
                <label className="row" style={{gap:6,marginTop:6,cursor:'pointer',fontSize:12,color:'var(--gray-purple)'}}>
                  <input type="checkbox" checked={!!(p as any).pactSlots} onChange={e=>setP('pactSlots' as any, e.target.checked)} style={{width:'auto'}} />
                  Slot da patto — recupero a riposo breve (Warlock)
                </label>
              </div>
            ) : (
              <div className="small muted">{p.cls}{(p as any).subclass ? ' — '+(p as any).subclass : ''}</div>
            )}
            {/* HP + CA — editabile da chiunque */}
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
              {/* CA — Classe Armatura */}
              <div className="ac-shield" title="Classe Armatura">
                <svg viewBox="0 0 24 28" width="28" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1L2 6v7c0 7.5 4.3 13.2 10 14 5.7-.8 10-6.5 10-14V6L12 1z" fill="var(--bg-deep)" stroke={p.color||'var(--gold)'} strokeWidth="1.2"/>
                </svg>
                <input type="number" value={(p as any).ac??10}
                  onChange={e=>setP('ac' as any, parseInt(e.target.value)||0)}
                  className="ac-value" style={{color:p.color||'var(--gold)'}} />
              </div>
              {/* Iniziativa — derivata: mod. Des + bonus extra */}
              {(() => {
                const dexMod = Math.floor((((p as any).abilities?.dex ?? 10) - 10) / 2);
                const ib = dexMod + ((p as any).initBonus || 0);
                return (
                  <div className="pill" style={{padding:'4px 8px',gap:4,flexShrink:0,fontSize:11}} title="Bonus di iniziativa (mod. Des + extra)">
                    <span style={{color:'var(--blue)'}}>⚡</span>
                    <span style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--text)'}}>{ib >= 0 ? '+'+ib : ib}</span>
                  </div>
                );
              })()}
              {/* Velocità — editabile */}
              <div className="pill" style={{padding:'4px 8px',gap:3,flexShrink:0,fontSize:11}} title="Velocità">
                <span style={{color:'var(--green)'}}>»</span>
                <input type="number" value={(p as any).speed ?? 9} onChange={e=>setP('speed' as any, parseInt(e.target.value)||0)}
                  style={{width:24,textAlign:'center',background:'transparent',border:'none',fontFamily:'var(--font-display)',fontSize:12,fontWeight:600,color:'var(--text)',padding:0}} />
                <span className="small muted" style={{fontSize:10}}>m</span>
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
          const setAb = (k:string,v:number) => {
            update(prev => ({
              players: prev.players.map(pl => {
                if (pl.id !== p.id) return pl;
                const newAbs = {...((pl as any).abilities || {str:10,dex:10,con:10,int:10,wis:10,cha:10}), [k]:v};
                const newPl = {...pl, abilities: newAbs} as any;
                return {...newPl, ac: computeAC(newPl)};
              })
            }));
          };
          return (
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4,marginTop:10}}>
              {stats.map(s => {
                const val = abs[s.k] ?? 10;
                const m = Math.floor((val-10)/2);
                const modColor = m > 0 ? 'var(--green)' : m < 0 ? 'var(--red)' : 'var(--gray-purple)';
                return (
                  <div key={s.k} style={{
                    textAlign:'center',
                    background:'linear-gradient(180deg, var(--stat-grad) 0%, var(--bg-deep) 100%)',
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

        {/* === RECUPERO: dadi vita, indebolimento, riposo lungo === */}
        {(() => {
          const hdDefault = (() => {
            const c = (p.cls||'').toLowerCase();
            if (c.includes('barbar')) return 12;
            if (c.includes('guerrier') || c.includes('paladin') || c.includes('ranger')) return 10;
            if (c.includes('mago') || c.includes('stregon')) return 6;
            return 8;
          })();
          const hitDie = (p as any).hitDie || hdDefault;
          const usedHD = (p as any).hitDiceUsed || 0;
          const availHD = Math.max(0, info.level - usedHD);
          const conMod = Math.floor((((p as any).abilities?.con ?? 10) - 10) / 2);
          const exh = (p as any).exhaustion || 0;

          const spendDie = () => {
            if (availHD <= 0) return;
            const roll = Math.floor(Math.random() * hitDie) + 1;
            const heal = Math.max(0, roll + conMod);
            sfxDice();
            setLastHd({ pid: p.id, roll, heal });
            update(prev => ({
              players: prev.players.map(pl => {
                if (pl.id !== p.id) return pl;
                return { ...pl, hp: Math.min(pl.maxHp ?? 0, (pl.hp ?? 0) + heal), hitDiceUsed: ((pl as any).hitDiceUsed || 0) + 1 } as any;
              }),
              combatants: prev.combatants.map(c => c.id === 'pc-' + p.id ? { ...c, hp: Math.min(c.maxHp, c.hp + heal) } : c),
            }));
          };

          const longRest = () => {
            if (!confirm('Riposo lungo: PF al massimo, slot incantesimo ripristinati, recupero di metà dei dadi vita, −1 indebolimento. Confermare?')) return;
            update(prev => ({
              players: prev.players.map(pl => {
                if (pl.id !== p.id) return pl;
                const lvl = getLevelInfo(pl.xp || 0).level;
                const recovered = Math.max(1, Math.floor(lvl / 2));
                return { ...pl,
                  hp: pl.maxHp ?? pl.hp ?? 0,
                  slotsUsed: {},
                  hitDiceUsed: Math.max(0, ((pl as any).hitDiceUsed || 0) - recovered),
                  exhaustion: Math.max(0, ((pl as any).exhaustion || 0) - 1),
                  resources: (pl.resources || []).map((r:any) => r.recovery === 'none' ? r : { ...r, current: r.max }),
                } as any;
              }),
              combatants: prev.combatants.map(c => c.id === 'pc-' + p.id ? { ...c, hp: c.maxHp } : c),
            }));
            setLastHd(null);
          };

          const hdBoxes = [];
          for (let i = 0; i < info.level; i++) {
            const isAvail = i < availHD;  // pieno = disponibile; si consumano da destra
            hdBoxes.push(
              <button key={i}
                onClick={()=>setP('hitDiceUsed' as any, isAvail ? usedHD + 1 : Math.max(0, usedHD - 1))}
                title={isAvail ? 'Segna come speso (senza tirare)' : 'Recupera'}
                style={{width:22,height:22,padding:0,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" style={{transition:'all .15s'}}>
                  <polygon points="12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75"
                    fill={isAvail ? (p.color||'var(--gold)') : 'transparent'}
                    stroke={isAvail ? (p.color||'var(--gold)') : 'var(--border)'} strokeWidth="1.4" />
                  <polygon points="12,6.2 17.2,15.2 6.8,15.2" fill="none"
                    stroke={isAvail ? 'var(--bg-deep)' : 'var(--border)'} strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M12 1.5v4.7M21.1 17.25l-3.9-2.05M2.9 17.25l3.9-2.05"
                    stroke={isAvail ? 'var(--bg-deep)' : 'var(--border)'} strokeWidth="1" opacity=".7" />
                </svg>
              </button>
            );
          }

          const exhPips = [];
          for (let i = 0; i < 6; i++) {
            const on = i < exh;
            const pipColor = i >= 4 ? 'var(--red)' : i >= 2 ? '#e0a040' : 'var(--gold)';
            exhPips.push(
              <button key={i}
                onClick={()=>setP('exhaustion' as any, exh === i + 1 ? i : i + 1)}
                title={'Livello ' + (i + 1)}
                style={{width:16,height:16,borderRadius:3,border:'1px solid '+(on?pipColor:'var(--border)'),
                  background:on?pipColor:'transparent',cursor:'pointer',transition:'all .15s'}} />
            );
          }

          return (
            <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
              {/* Strumenti del personaggio: scheda e talenti */}
              <div className="row" style={{gap:8,marginBottom:12}}>
                <button className="tool-box-btn" style={{flex:1,color:'var(--purple)'}} onClick={()=>setShowSheet(true)} title="Bonus di competenza, tiri salvezza e abilità">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6M9 8h6M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/></svg>
                  <span>Scheda</span>
                </button>
                <button className="tool-box-btn" style={{flex:1,color:'var(--gold)'}} onClick={()=>setShowFeats(true)} title="Talenti e padronanze">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.5L7 22l5-2.5L17 22l-1.5-7.5"/></svg>
                  <span>Talenti</span>
                </button>
              </div>
              {/* Dadi vita */}
              <div className="row" style={{justifyContent:'space-between',marginBottom:6}}>
                <div className="label" style={{fontSize:9}}>Dadi vita · d{hitDie}</div>
                {s.dmMode && (
                  <select value={hitDie} onChange={e=>setP('hitDie' as any, parseInt(e.target.value))} style={{width:60,fontSize:11,padding:'2px 4px'}}>
                    {[6,8,10,12].map(d => <option key={d} value={d}>d{d}</option>)}
                  </select>
                )}
              </div>
              <div className="row" style={{gap:6,flexWrap:'wrap',alignItems:'center'}}>
                <div className="row" style={{gap:4,flexWrap:'wrap'}}>{hdBoxes}</div>
                <span className="small muted" style={{whiteSpace:'nowrap'}}>{availHD} / {info.level}</span>
                <button className="btn" disabled={availHD<=0}
                  style={{fontSize:9,padding:'4px 10px',marginLeft:'auto',opacity:availHD<=0?0.4:1}}
                  onClick={spendDie}
                >Tira 1d{hitDie}{conMod !== 0 ? (conMod > 0 ? '+'+conMod : ''+conMod) : ''}</button>
              </div>
              {lastHd && lastHd.pid === p.id && (
                <div className="small" style={{marginTop:4,color:'var(--green)'}}>d{hitDie}: {lastHd.roll}{conMod !== 0 ? (conMod > 0 ? ' + '+conMod : ' − '+Math.abs(conMod)) : ''} → +{lastHd.heal} PF</div>
              )}
              {/* Riserve personali — slot dedicati (es. Salto Leporino, Ira) */}
              {(() => {
                const resources = (p.resources || []) as {id:string;name:string;current:number;max:number;recovery?:string}[];
                const setRes = (list: typeof resources) => setP('resources' as any, list);
                return (
                  <div style={{marginTop:10}}>
                    {resources.map(r => {
                      const boxes = [];
                      const color = p.color || 'var(--gold)';
                      for (let i = 0; i < r.max; i++) {
                        const isAvail = i < r.current;
                        boxes.push(
                          <button key={i}
                            onClick={()=>setRes(resources.map(x=>x.id===r.id?{...x,current: isAvail?Math.max(0,x.current-1):Math.min(x.max,x.current+1)}:x))}
                            title={isAvail?'Spendi':'Recupera'}
                            style={{width:20,height:20,padding:0,background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <ResourceShape shape={(r as any).icon || 'quadrato'} filled={isAvail} color={color} />
                          </button>
                        );
                      }
                      return (
                        <div key={r.id} className="row" style={{gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
                          <div className="label" style={{fontSize:9,flexBasis:'100%'}}>{r.name}
                            {s.dmMode && (
                              <button className="btn btn-ghost" style={{padding:'0 5px',fontSize:9,marginLeft:6}} title="Cambia forma dell'indicatore"
                                onClick={()=>{
                                  const order = ['quadrato','d20','goccia','fiamma','stella','scudo'];
                                  const cur = (r as any).icon || 'quadrato';
                                  const next = order[(order.indexOf(cur)+1) % order.length];
                                  setRes(resources.map(x=>x.id===r.id?({...x,icon:next} as any):x));
                                }}>◈</button>
                            )}
                            {s.dmMode && (
                              <button className="btn btn-danger btn-ghost" style={{padding:'0 5px',fontSize:9,marginLeft:6}}
                                onClick={()=>{if(confirm('Rimuovere la riserva "'+r.name+'"?'))setRes(resources.filter(x=>x.id!==r.id));}}>&times;</button>
                            )}
                          </div>
                          <div className="row" style={{gap:4,flexWrap:'wrap'}}>{boxes}</div>
                          <span className="small muted">{r.current} / {r.max}</span>
                          {r.recovery==='short' && <span className="small" style={{color:'var(--purple-light)',fontSize:10}}>rip. breve</span>}
                          {r.recovery==='none' && <span className="small muted" style={{fontSize:10}}>manuale</span>}
                        </div>
                      );
                    })}
                    {s.dmMode && (() => {
                      return (
                        <ResourceAddForm onAdd={(name,max,recovery,icon)=>setRes([...resources,{id:'res'+Date.now().toString(36),name,current:max,max,recovery,icon} as any])} />
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Indebolimento */}
              <div className="row" style={{gap:8,marginTop:10,alignItems:'center',flexWrap:'wrap'}}>
                <div className="label" style={{fontSize:9}}>Indebolimento</div>
                <div className="row" style={{gap:4}}>{exhPips}</div>
                {exh > 0 && (
                  <span className="small" style={{color: exh >= 5 ? 'var(--red)' : exh >= 3 ? '#e0a040' : 'var(--gray-purple)',fontWeight:500}}>
                    −{exh} ai d20 e alla CD{exh >= 5 ? ' · velocità 0' : ''}{exh >= 6 ? ' · MORTE' : ''}
                  </span>
                )}
              </div>
              {/* Riposi */}
              <div className="row" style={{gap:6,marginTop:10}}>
                {((p as any).pactSlots || (p.resources||[]).some((r:any)=>r.recovery==='short')) && (
                  <button className="btn" style={{flex:1,fontSize:11,color:'var(--purple-light)',borderColor:'var(--purple)'}}
                    onClick={()=>{
                      if(!confirm('Riposo breve: slot da patto e riserve a ricarica breve tornano disponibili. Confermare?')) return;
                      update(prev=>({players:prev.players.map(pl=>{
                        if(pl.id!==p.id) return pl;
                        return {...pl,
                          ...((pl as any).pactSlots ? {slotsUsed:{}} : {}),
                          resources:(pl.resources||[]).map((r:any)=>r.recovery==='short'?{...r,current:r.max}:r),
                        } as any;
                      })}));
                    }}>Riposo breve</button>
                )}
                <button className="btn btn-primary" style={{flex:(p as any).pactSlots?1.4:1,fontSize:11}} onClick={longRest}>Riposo lungo</button>
              </div>

              {/* Tiradadi — come nel menù battaglia */}
              <div style={{marginTop:10,textAlign:'center'}}>
                <button className="btn btn-ghost" style={{padding:'4px 10px'}} onClick={()=>setShowDice(!showDice)} title="Tira un dado">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <polygon points="12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75" fill="none" stroke={p.color||'var(--gold)'} strokeWidth="1.4" />
                    <polygon points="12,6.2 17.2,15.2 6.8,15.2" fill="none" stroke={p.color||'var(--gold)'} strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M12 1.5v4.7M21.1 17.25l-3.9-2.05M2.9 17.25l3.9-2.05" stroke={p.color||'var(--gold)'} strokeWidth="1" opacity=".6" />
                  </svg>
                </button>
                {showDice && (
                  <div style={{marginTop:6}}>
                    <div className="row" style={{gap:5,flexWrap:'wrap',justifyContent:'center',marginBottom:8}}>
                      {[4,6,8,10,12,20,100].map(n=>(
                        <button key={n} className={'btn'+(die===n?' btn-primary':'')} style={{fontSize:10,padding:'5px 9px'}} onClick={()=>setDie(n)}>d{n}</button>
                      ))}
                    </div>
                    <button className="btn btn-primary" style={{width:'100%',fontSize:11}}
                      onClick={()=>{sfxDice();setLastRoll({die,value:Math.floor(Math.random()*die)+1,t:Date.now()});}}>Tira d{die}</button>
                    {lastRoll && (
                      <div className="dice-display roll-anim" key={lastRoll.t} style={{marginTop:8}}>
                        <div className="small muted" style={{fontFamily:'var(--font-body)',fontSize:10}}>d{lastRoll.die}</div>
                        <div>{lastRoll.value}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
      {showSheet && <SheetPopup s={s} update={update} p={p} campaignId={campaignId} onClose={()=>setShowSheet(false)} />}
      {showFeats && <FeatsPopup s={s} update={update} p={p} campaignId={campaignId} onClose={()=>setShowFeats(false)} />}
    </div>
  );
}


// ─── Form di aggiunta riserva (solo DM) ──────────────────────
function ResourceAddForm({ onAdd }: { onAdd: (name: string, max: number, recovery: 'long'|'short'|'none', icon: string) => void }) {
  const [name, setName] = useState('');
  const [max, setMax] = useState('');
  const [recovery, setRecovery] = useState<'long'|'short'|'none'>('long');
  const [icon, setIcon] = useState('quadrato');
  return (
    <div className="row" style={{gap:4,flexWrap:'wrap',marginTop:4}}>
      <input value={name} placeholder="Nuova riserva (es. Salto Leporino)" onChange={e=>setName(e.target.value)} style={{fontSize:12,padding:'4px 8px',flex:'1 1 150px'}} />
      <input type="number" value={max} placeholder="N" onChange={e=>setMax(e.target.value)} style={{width:44,fontSize:12,padding:'4px 4px',textAlign:'center'}} />
      <select value={recovery} onChange={e=>setRecovery(e.target.value as any)} style={{width:100,fontSize:11,padding:'4px 4px'}}>
        <option value="long">Rip. lungo</option>
        <option value="short">Rip. breve</option>
        <option value="none">Manuale</option>
      </select>
      <select value={icon} onChange={e=>setIcon(e.target.value)} style={{width:92,fontSize:11,padding:'4px 4px'}} title="Forma dell'indicatore">
        <option value="quadrato">Quadrato</option>
        <option value="d20">D20</option>
        <option value="goccia">Goccia</option>
        <option value="fiamma">Fiamma</option>
        <option value="stella">Stella</option>
        <option value="scudo">Scudo</option>
      </select>
      <button className="btn" style={{fontSize:9,padding:'5px 10px'}}
        onClick={()=>{ if(!name.trim()||!(parseInt(max)>0)) return; onAdd(name.trim(), parseInt(max), recovery, icon); setName(''); setMax(''); }}>+</button>
    </div>
  );
}


// ─── Forme degli indicatori di riserva ───────────────────────
function ResourceShape({ shape, filled, color }: { shape: string; filled: boolean; color: string }) {
  const fill = filled ? color : 'transparent';
  const stroke = filled ? color : 'var(--border)';
  const inner = filled ? 'var(--bg-deep)' : 'var(--border)';
  switch (shape) {
    case 'd20': return (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <polygon points="12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75" fill={fill} stroke={stroke} strokeWidth="1.4" />
        <polygon points="12,6.2 17.2,15.2 6.8,15.2" fill="none" stroke={inner} strokeWidth="1.2" strokeLinejoin="round" />
      </svg>);
    case 'goccia': return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M12 2.5c4 5.5 7 8.8 7 12.5a7 7 0 11-14 0c0-3.7 3-7 7-12.5z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      </svg>);
    case 'fiamma': return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M12 2c1 4-4 5.5-4 10a4 4 0 008 0c0-2-1-3-1-3s3 1.4 3 5a6 6 0 11-12 0c0-6 5-8 6-12z" fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>);
    case 'stella': return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M12 2.6l2.6 5.8 6.3.6-4.8 4.2 1.4 6.2L12 16.2 6.5 19.4l1.4-6.2L3.1 9l6.3-.6z" fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>);
    case 'scudo': return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>);
    default: return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
      </svg>);
  }
}
