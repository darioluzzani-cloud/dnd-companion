'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCampaignState } from '@/hooks/useCampaignState';
import { CalendarPopup, CalendarBar } from '@/components/popups/CalendarPopup';
import { JournalPopup } from '@/components/popups/JournalPopup';
import { QuestsTab } from '@/components/tabs/QuestsTab';
import { CharactersTab } from '@/components/tabs/CharactersTab';
import { SpellsTab } from '@/components/tabs/SpellsTab';
import { InventoryTab } from '@/components/tabs/InventoryTab';
import { CombatTab } from '@/components/tabs/CombatTab';
import { LoreTab } from '@/components/tabs/LoreTab';
import { BaseTab } from '@/components/tabs/BaseTab';

const TABS = [
  {id:'quests',label:'Quest',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>},
  {id:'characters',label:'NPC',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>},
  {id:'lore',label:'Lore',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>},
  {id:'spells',label:'Magie',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>},
  {id:'inventory',label:'Inventario',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>},
  {id:'combat',label:'Battaglia',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 18L18 6M6 6l12 12"/></svg>},
  {id:'base',label:'Base',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>},
];

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

  const [showCalendar, setShowCalendar] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && window.localStorage.getItem('velmora-theme')) as 'dark'|'light'|null;
    if (saved === 'light' || saved === 'dark') { setTheme(saved); document.documentElement.dataset.theme = saved; }
  }, []);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem('velmora-theme', next); } catch {}
  };

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
          <CalendarBar s={s} onOpen={()=>setShowCalendar(true)} />
        </div>
        <button className="journal-topbar-btn" onClick={()=>setShowJournal(true)} title="Diario di gioco">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z"/><path d="M9 7h7M9 11h7"/></svg>
        </button>
        <div className="row" style={{gap:6}}>
          <button className="btn btn-ghost" style={{padding:'4px 6px'}} onClick={toggleTheme} title={theme==='dark'?'Tema chiaro':'Tema scuro'}>
            {theme === 'dark'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>}
          </button>
          <button
            className="btn"
            style={s.dmMode ? {background:'var(--gold)',color:'var(--bg-deep)',borderColor:'var(--gold)'} : undefined}
            onClick={() => update({dmMode:!s.dmMode})}
          >{s.dmMode ? 'DM' : 'PG'}</button>
        </div>
      </div>

      {showJournal && <JournalPopup s={s} update={update} campaignId={campaignId} onClose={()=>setShowJournal(false)} />}
      {showCalendar && s.dmMode && <CalendarPopup s={s} update={update} onClose={()=>setShowCalendar(false)} />}

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
      {s.tab === 'quests' && <QuestsTab s={s} update={update} updScen={updScen} sc={activeScen} campaignId={campaignId} />}
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
