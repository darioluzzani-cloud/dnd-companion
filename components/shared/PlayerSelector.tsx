'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { getLevelInfo } from '@/lib/dnd/xp-table';
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
