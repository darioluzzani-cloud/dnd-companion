'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { ImageSlot } from '@/components/ImageSlot';
import { sfxDice } from '@/lib/dnd/sounds';
import { rollDice } from '@/components/shared/DiceOverlay';
import { U } from '@/components/shared/common';
import { BestiaryPopup } from '@/components/popups/BestiaryPopup';
import { CombatCard } from '@/components/shared/CombatCard';
import { CombatantPopup } from '@/components/popups/CombatantPopup';
import { PanelBg } from '@/components/shared/PanelBox';


// ─── TAB: COMBATTIMENTO ──────────────────────────────────────
export function CombatTab({ s, update, campaignId }: { s:CampaignState; update:U; campaignId:string|null }) {
  const combatScen = (s as any).combatScenario || s.activeScenario || '';
  const setCombatScen = (id:string) => update({combatScenario:id} as any);
  const allCombatants = (s.combatants||[]).filter((k:any)=>!k.scenarioId || k.scenarioId===combatScen);
  const sorted = [...allCombatants].sort((a,b)=>(b.init||0)-(a.init||0));
  const visibleCombatants = s.dmMode ? sorted : sorted.filter(k=>(k as any).revealed!==false);
  // Il ciclo turni esclude SEMPRE i nascosti — sono "preparati ma non in campo"
  const turnList = sorted.filter(k=>(k as any).revealed!==false);
  const idx = s.turnIndex||0;
  const current = turnList[idx % (turnList.length||1)];
  const [name,setName]=useState('');
  const [init,setInit]=useState('');
  const [hp,setHp]=useState('');
  const [dice,setDice]=useState(20);
  const [lastRoll,setLastRoll]=useState<{die:number;value:number;t:number}|null>(null);
  const [enlargedImg, setEnlargedImg] = useState<string|null>(null);
  const [detailId, setDetailId] = useState<string|null>(null);   // carta aperta a pannello
  const [bgTick, setBgTick] = useState(0);                       // ricarica lo sfondo dopo il caricamento

  // ── PUNTI FERITA: UNA SOLA FONTE DI VERITÀ ────────────────
  // Per i personaggi giocanti e per i loro companion i punti ferita vivono
  // nella scheda del giocatore, non nella riga di iniziativa. La copia in
  // `combatants` resta scritta per compatibilità con i dati già salvati, ma
  // non viene MAI letta: `liveHp` risale sempre al proprietario. È il
  // rimedio strutturale al caso di Ysdra — prima la battaglia riscriveva
  // nella scheda anche il massimale, prendendolo da un combattente che
  // poteva essere vecchio di sessioni, e la correzione fatta in inventario
  // veniva silenziosamente annullata al primo colpo incassato.
  const ownerOf = (c:any) => c.id.startsWith('pc-') ? s.players.find(pl => pl.id === c.id.slice(3)) : undefined;
  const companionOf = (c:any) => c.id.startsWith('comp-') ? (s.players.find(pl => pl.id === c.id.slice(5)) as any)?.companion : undefined;
  const liveHp = (c:any): {hp:number; maxHp:number} => {
    const o:any = ownerOf(c);
    if (o) return { hp: o.hp ?? o.maxHp ?? 0, maxHp: o.maxHp ?? 0 };
    const comp:any = companionOf(c);
    if (comp) return { hp: comp.hp ?? 0, maxHp: comp.maxHp ?? 0 };
    return { hp: c.hp, maxHp: c.maxHp };
  };

  const changeHp = (kId:string, delta:number) => {
    update(prev => {
      // Il valore di partenza è quello della scheda, non quello del combattente
      const cur = prev.combatants.find(c => c.id === kId);
      if (!cur) return {};
      let base = { hp: cur.hp, maxHp: cur.maxHp };
      const pcId = kId.startsWith('pc-') ? kId.slice(3) : null;
      const compId = kId.startsWith('comp-') ? kId.slice(5) : null;
      if (pcId) { const o:any = prev.players.find(pl=>pl.id===pcId); if (o) base = { hp: o.hp ?? o.maxHp ?? 0, maxHp: o.maxHp ?? 0 }; }
      if (compId) { const o:any = prev.players.find(pl=>pl.id===compId); if (o?.companion) base = { hp: o.companion.hp ?? 0, maxHp: o.companion.maxHp ?? 0 }; }

      const hp = Math.max(0, Math.min(base.maxHp, base.hp + delta));

      const newCombatants = prev.combatants.map(c => {
        if (c.id !== kId) return c;
        const next:any = { ...c, hp, maxHp: base.maxHp };
        if (hp > 0 && next.ds) delete next.ds;   // sopra lo zero i TS contro morte si azzerano
        return next;
      });

      let newPlayers = prev.players;
      if (pcId)   newPlayers = prev.players.map(p => p.id===pcId ? {...p, hp} : p);
      if (compId) newPlayers = prev.players.map(p => p.id===compId && (p as any).companion
        ? {...p, companion: {...(p as any).companion, hp}} as any : p);

      return { combatants: newCombatants, players: newPlayers };
    });
  };

  const nextTurn=()=>{let n=idx+1,r=s.round;if(n>=turnList.length){n=0;r++;}update({turnIndex:n,round:r});};
  const prevTurn=()=>{let n=idx-1,r=s.round;if(n<0){n=turnList.length-1;r=Math.max(1,r-1);}update({turnIndex:n,round:r});};

  // Importa i PG come combattenti (companion mostrato dentro la card del padrone)
  const [showBestiary, setShowBestiary] = useState(false);

  const addPlayers = () => {
    const existing = new Set((s.combatants||[]).map(c=>c.id));
    const newCombatants: any[] = [];
    s.players.forEach(p => {
      if (!existing.has('pc-'+p.id)) {
        const dexMod = Math.floor((((p as any).abilities?.dex ?? 10) - 10) / 2);
        const ov = (p as any).initOverride;
        const initMod = (ov !== undefined && ov !== null && ov !== '') ? Number(ov) : dexMod + ((p as any).initBonus || 0);
        const initRoll = Math.floor(Math.random()*20) + 1 + initMod;
        newCombatants.push({
          id:'pc-'+p.id, name:p.name, init:initRoll, hp:p.hp??p.maxHp??30, maxHp:p.maxHp??30, side:'ally' as const, conditions:[], scenarioId:combatScen
        });
      }
    });
    if(newCombatants.length) { sfxDice(); update(prev=>({combatants:[...prev.combatants,...newCombatants]})); }
  };

  return (
    <div>
      {/* Overlay immagine ingrandita */}
      {enlargedImg && (
        <div onClick={()=>setEnlargedImg(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:20}}>
          <img src={enlargedImg} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:8,border:'1px solid var(--border)'}} alt="" />
        </div>
      )}
      {/* Selettore scenario */}
      <div className="frame">
        <div className="label" style={{marginBottom:6}}>Scenario</div>
        <div className="row" style={{gap:5,flexWrap:'wrap'}}>
          {(s.dmMode ? s.scenarios : s.scenarios.filter((sc:any) => sc.revealed !== false)).map(sc => (
            <button key={sc.id} className={'btn'+(combatScen===sc.id?' btn-primary':'')}
              style={{fontSize:10}} onClick={()=>setCombatScen(sc.id)}>{sc.name}</button>
          ))}
        </div>
      </div>
      {/* Testata: round, turno e comandi, integrati sopra la fila delle carte
          invece di occupare un riquadro proprio come accadeva prima. */}
      <div className="frame" style={{position:'relative',overflow:'hidden'}}>
        {/* Sfondo del campo di battaglia, come negli altri riquadri dell'app */}
        <div style={{position:'absolute',inset:0,zIndex:0}}>
          <div data-slot="combat-bg" style={{width:'100%',height:'100%'}}>
            <ImageSlot key={'cbg'+bgTick} slotId="combat-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="" />
          </div>
        </div>
        <div style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',
          background:'linear-gradient(180deg, rgba(30,22,48,.88) 0%, rgba(30,22,48,.80) 55%, rgba(30,22,48,.94) 100%)'}} />
        <div style={{position:'relative',zIndex:2}}>
        <div className="combat-head">
          <div className="combat-round">
            <div style={{textAlign:'center',flexShrink:0}}>
              <div className="combat-round-lbl">Round</div>
              <div className="combat-round-num">{s.round}</div>
            </div>
            <div className="combat-round-sep" />
            <div style={{minWidth:0}}>
              <div className="combat-round-lbl">In azione</div>
              <div className="combat-turn-name">{current ? current.name : '—'}</div>
            </div>
          </div>
          <div className="row" style={{gap:5,flexShrink:0}}>
            <button className="btn" style={{padding:'4px 9px'}} onClick={prevTurn}>◀</button>
            <button className="btn btn-primary" style={{padding:'4px 12px'}} onClick={nextTurn}>Succ.</button>
            {s.dmMode && <>
              <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:10}} onClick={addPlayers} title="Aggiungi i personaggi">+ PG</button>
              <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:10,color:'var(--red)'}} onClick={()=>setShowBestiary(true)} title="Registro dei nemici">Bestiario</button>
              <button className="btn btn-danger btn-ghost" style={{padding:'4px 8px',fontSize:10}} onClick={()=>{if(confirm('Reset?'))update({round:1,turnIndex:0});}}>Reset</button>
            </>}
          </div>
        </div>

        {visibleCombatants.length===0 && <div className="card muted small" style={{textAlign:'center',marginTop:10}}>Nessun combattente.</div>}

        {/* La fila: scorre lateralmente e sfrutta la larghezza dello schermo */}
        {visibleCombatants.length>0 && (
          <div className="combat-strip">
            {visibleCombatants.map(k => (
              <CombatCard key={k.id} s={s} k={k} campaignId={campaignId}
                isCurrent={turnList.indexOf(k)===(idx%(turnList.length||1))}
                liveHp={liveHp} changeHp={changeHp} update={update}
                onOpen={()=>setDetailId(k.id)} onEnlarge={setEnlargedImg} />
            ))}
          </div>
        )}

        {s.dmMode && (
          <div style={{marginTop:10}}>
            <div className="row" style={{gap:6}}>
              <input placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} style={{flex:1}} />
              <input placeholder="Init" value={init} onChange={e=>setInit(e.target.value)} style={{width:52}} title="Lasciando vuoto, l'iniziativa si tira dalla carta" />
              <input placeholder="PF" value={hp} onChange={e=>setHp(e.target.value)} style={{width:52}} />
              <button className="btn btn-primary" onClick={()=>{if(name.trim()){update(prev=>({combatants:[...prev.combatants,{id:uid('k'),name:name.trim(),init:parseInt(init)||0,hp:parseInt(hp)||10,maxHp:parseInt(hp)||10,initMod:0,side:'enemy',scenarioId:combatScen} as any]}));setName('');setInit('');setHp('');}}}>+</button>
            </div>
            <PanelBg slot="combat-bg" campaignId={campaignId} color="var(--gold)" onDone={()=>setBgTick(t=>t+1)} />
          </div>
        )}
        </div>
      </div>
      <div className="frame">
        <div className="label" style={{marginBottom:8}}>Dado</div>
        <div className="row" style={{gap:6,flexWrap:'wrap',marginBottom:8}}>
          {[4,6,8,10,12,20,100].map(n=>(
            <button key={n} className={'btn'+(dice===n?' btn-primary':'')} onClick={()=>setDice(n)}>d{n}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>{const r=rollDice(dice);setLastRoll({die:dice,value:r,t:Date.now()});}}>Tira d{dice}</button>
        {lastRoll && (
          <div className="dice-display roll-anim" key={lastRoll.t} style={{marginTop:10}}>
            <div className="small muted" style={{fontFamily:'var(--font-body)',fontSize:10}}>d{lastRoll.die}</div>
            <div>{lastRoll.value}</div>
          </div>
        )}
      </div>
      {detailId && (() => {
        const k = (s.combatants||[]).find((c:any)=>c.id===detailId);
        return k ? <CombatantPopup s={s} k={k} campaignId={campaignId} liveHp={liveHp} changeHp={changeHp}
          update={update} onEnlarge={setEnlargedImg} onClose={()=>setDetailId(null)} /> : null;
      })()}
      {showBestiary && <BestiaryPopup s={s} update={update} campaignId={campaignId} combatScen={combatScen} onClose={()=>setShowBestiary(false)} />}
    </div>
  );
}
