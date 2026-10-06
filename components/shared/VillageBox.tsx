'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { PanelBox } from '@/components/shared/PanelBox';
import { NumberInput } from '@/components/shared/textUtils';
import { absDay, addDays, formatDateShort } from '@/lib/dnd/calendar';
import {
  HousingRow, VillageGateEntry, NOTABLE_MIN,
  popOf, ledgerOf, gateOf, residentIds, residentsOf, dismissedIds, deckOf,
  housingBuilding, housingRow, currentHousing, daysToGrowth,
} from '@/lib/dnd/village';

// ─── GLI ABITANTI ────────────────────────────────────────────
// Primo passo del gestionale: quanta gente vive a Olmobianco, chi bussa
// alla porta e chi, fra i residenti, ha un nome. Le caselle dei capi delle
// attività si innesteranno qui sopra, in questo stesso riquadro.
//
// Ai giocatori il tiro di crescita resta invisibile: vedono il numero
// salire e la capienza delle case. Dadi, fattore e conto alla rovescia
// stanno fra gli strumenti del DM.

const COLOR = 'var(--purple-light)';

export function VillageBox({ s, update, campaignId, defaultOpen }: { s: CampaignState; update: U; campaignId: string | null; defaultOpen?: boolean }) {
  const pop = popOf(s);
  const house = currentHousing(s);
  const hb = housingBuilding(s);
  const led = ledgerOf(s);
  const gate = gateOf(s);
  const residents = residentsOf(s);
  const deck = deckOf(s);
  const [dmOpen, setDmOpen] = useState(false);

  const pct = house.cap > 0 ? Math.min(100, Math.round((pop / house.cap) * 100)) : 0;
  const full = house.found && house.cap > 0 && pop >= house.cap;

  // ── La porta: integrare o respingere ──
  // Si riparte sempre dallo stato più recente, perché nel frattempo il
  // calendario può aver fatto arrivare qualcun altro.
  const leaveGate = (list: VillageGateEntry[], id: string) => list.filter(g => g.npcId !== id);
  const integrate = (id: string) => update(prev => ({
    villageGate: leaveGate(gateOf(prev), id),
    villageResidents: [...residentIds(prev).filter(x => x !== id), id],
  } as any));
  const reject = (id: string, name: string) => {
    if (!confirm(`Respingere ${name}? Riprenderà la strada e non si ripresenterà.`)) return;
    update(prev => ({
      villageGate: leaveGate(gateOf(prev), id),
      villageDismissed: [...dismissedIds(prev).filter(x => x !== id), id],
    } as any));
  };

  const person = (npc: any, sub?: string) => (
    <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
      <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-sec)' }}>
        <ImageSlot slotId={'png-' + npc.id} campaignId={campaignId} shape="circle" width={44} height={44} dmMode={false}
          placeholder={(npc.name || '?').slice(0, 2).toUpperCase()} alt={npc.name} objectPosition={`center ${npc.imgPos ?? 50}%`} />
      </div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>{npc.name}</span>
          {sub && <span className="small muted" style={{ fontSize: 10.5 }}>{sub}</span>}
        </div>
        {npc.trait && <div className="small" style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--text-card)', lineHeight: 1.4 }}>{npc.trait}</div>}
      </div>
    </div>
  );

  // ── Strumenti del DM ──
  const setPop = (n: number) => update({ villagePop: Math.max(0, Math.floor(n || 0)) } as any);
  const setRow = (lv: number, p: Partial<HousingRow>) => update(prev => {
    const list = [...(((prev as any).villageHousing || []) as HousingRow[])];
    for (let i = 0; i <= lv; i++) if (!list[i]) list[i] = housingRow(prev, i);   // consolida i valori di partenza
    list[lv] = { ...list[lv], ...p };
    return { villageHousing: list } as any;
  });
  const today = s.calendar?.date ? absDay(s.calendar.date) : null;
  const callIn = (id: string) => {
    if (today === null) return;
    update(prev => ({ villageGate: [...leaveGate(gateOf(prev), id), { npcId: id, sinceAbs: today }] } as any));
  };
  const recall = (id: string) => update(prev => ({ villageDismissed: dismissedIds(prev).filter(x => x !== id) } as any));
  const sendAway = (id: string, name: string) => {
    if (confirm(`Togliere ${name} dai residenti di Olmobianco?`)) update(prev => ({ villageResidents: residentIds(prev).filter(x => x !== id) } as any));
  };
  const dismissed = dismissedIds(s).map(id => s.characters.find(c => c.id === id)).filter(Boolean) as any[];
  const lastLevel = Math.max(hb?.maxLevel || 0, house.level);
  const dateOf = (abs: number) => formatDateShort(addDays({ year: 0, month: 1, day: 1 }, abs)).replace(/ · .*$/, '');
  const num = { width: 58, textAlign: 'center', fontSize: 11, padding: '2px 4px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4 } as const;

  return (
    <PanelBox title="Gli abitanti" color={COLOR} bgSlot="people-bg" campaignId={campaignId} dmMode={s.dmMode} defaultOpen={defaultOpen}
      badge={<span className="pill" style={{ padding: '2px 8px', fontSize: 8.5, color: COLOR, borderColor: COLOR }}>{pop} abitanti{gate.length > 0 ? ' · ' + gate.length + ' alla porta' : ''}</span>}
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLOR} strokeWidth="1.5"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.3c3 .2 5.5 2.6 5.5 5.7"/></svg>}>

      {/* Indicatore della popolazione */}
      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>{pop}</span>
            <span className="small muted">abitanti a Olmobianco</span>
          </div>
          {house.found && house.cap > 0 && (
            <span className="small" style={{ color: full ? 'var(--gold-dim)' : 'var(--gray-purple)' }}>
              {full ? 'case piene' : `tetti per ${house.cap}`}
            </span>
          )}
        </div>
        {house.found && house.cap > 0 && (
          <div style={{ height: 6, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 9 }}>
            <div style={{ height: '100%', width: pct + '%', background: full ? 'var(--gold-dim)' : COLOR, borderRadius: 3, transition: 'width .4s' }} />
          </div>
        )}
        {full && <div className="small muted" style={{ fontSize: 10.5, marginTop: 6, lineHeight: 1.5 }}>Finché le case non vengono ampliate, chi arriva non trova dove fermarsi.</div>}
      </div>

      {/* La porta del villaggio */}
      {gate.map(g => {
        const npc: any = s.characters.find(c => c.id === g.npcId);
        if (!npc) return null;
        return (
          <div key={g.npcId} className="card" style={{ borderColor: COLOR, padding: '11px 13px' }}>
            <div className="label" style={{ fontSize: 9, color: COLOR, marginBottom: 8 }}>Alla porta del villaggio</div>
            {person(npc, npc.role || undefined)}
            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn btn-gold" style={{ fontSize: 10, padding: '4px 14px' }} onClick={() => integrate(npc.id)}>Integra</button>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 14px' }} onClick={() => reject(npc.id, npc.name)}>Respingi</button>
            </div>
          </div>
        );
      })}

      {/* Residenti con un nome */}
      <div className="card" style={{ padding: '11px 13px' }}>
        <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>Residenti con un nome · {residents.length}</div>
        {residents.length === 0 && <div className="small muted" style={{ fontSize: 11 }}>Nessuno ancora.{s.dmMode ? ' Un PNG si stabilisce dalla sua scheda, nella sezione «Villaggio».' : ''}</div>}
        {residents.map((npc: any) => (
          <div key={npc.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '4px 0' }}>
            <div className="grow" style={{ minWidth: 0 }}>{person(npc, npc.role || undefined)}</div>
            {s.dmMode && <button className="btn btn-danger btn-ghost" style={{ fontSize: 9, padding: '2px 8px', flexShrink: 0 }} onClick={() => sendAway(npc.id, npc.name)}>Togli</button>}
          </div>
        ))}
      </div>

      {/* ── Strumenti del DM ── */}
      {s.dmMode && (
        <div className="card" style={{ padding: '10px 13px', borderStyle: 'dashed' }}>
          <div className="row" style={{ cursor: 'pointer', justifyContent: 'space-between' }} onClick={() => setDmOpen(!dmOpen)}>
            <div className="label" style={{ fontSize: 9 }}>Strumenti del DM</div>
            <span className="small muted">{dmOpen ? '▾' : '▸'}</span>
          </div>
          {dmOpen && (
            <div style={{ marginTop: 10 }}>
              {/* Popolazione */}
              <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span className="small grow">Abitanti</span>
                <button className="hp-btn hp-btn-neg" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop - 10)}>-10</button>
                <button className="hp-btn hp-btn-neg" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop - 1)}>-1</button>
                <NumberInput value={pop} min={0} onChange={setPop} style={{ ...num, width: 64, fontSize: 13, color: 'var(--gold)', fontWeight: 600 }} title="Abitanti" />
                <button className="hp-btn hp-btn-pos" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop + 1)}>+1</button>
                <button className="hp-btn hp-btn-pos" style={{ flex: 'none', padding: '3px 9px' }} onClick={() => setPop(pop + 10)}>+10</button>
              </div>
              <div className="small muted" style={{ fontSize: 10, lineHeight: 1.55, marginBottom: 12 }}>
                {led.last
                  ? <>Ultimo tiro, {dateOf(led.last.abs)}: {led.last.dice.join(' · ')} = {led.last.dice.reduce((a, b) => a + b, 0)}{led.last.mult > 1 ? ' × ' + led.last.mult : ''} → +{led.last.gained}. </>
                  : <>Nessun tiro ancora. </>}
                {today !== null && <>Il prossimo cade fra {daysToGrowth(today)} giorni: si tira un mercato sì e uno no. </>}
                Con {NOTABLE_MIN}–12 sul tiro nudo si presenta un notabile del mazzo.
              </div>

              {/* Case: capienza e fattore per livello */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Case: capienza e fattore del 3d4</div>
              <select value={(s as any).villageHousingId || hb?.id || ''} onChange={e => update({ villageHousingId: e.target.value || undefined } as any)} style={{ fontSize: 11, width: '100%', marginBottom: 6 }}>
                {!hb && <option value="">Nessun edificio delle case: scegline uno…</option>}
                {(((s as any).buildings || []) as any[]).map(b => <option key={b.id} value={b.id}>{b.name} — livello {b.level}</option>)}
              </select>
              {hb ? (
                <div style={{ marginBottom: 12 }}>
                  {Array.from({ length: lastLevel + 1 }).map((_, lv) => {
                    const row = housingRow(s, lv);
                    const cur = lv === house.level;
                    return (
                      <div key={lv} className="row" style={{ gap: 6, alignItems: 'center', padding: '2px 0' }}>
                        <span className="small" style={{ width: 62, fontSize: 11, color: cur ? 'var(--gold)' : 'var(--gray-purple)', fontWeight: cur ? 600 : 400 }}>Livello {lv}{cur ? ' ◂' : ''}</span>
                        <span className="small muted" style={{ fontSize: 10 }}>tetti</span>
                        <NumberInput value={row.cap} min={0} onChange={n => setRow(lv, { cap: n })} style={num} title={`Capienza al livello ${lv}`} />
                        <span className="small muted" style={{ fontSize: 10 }}>3d4 ×</span>
                        <NumberInput value={row.mult} min={0} onChange={n => setRow(lv, { mult: n })} style={{ ...num, width: 44 }} title={`Fattore di crescita al livello ${lv}`} />
                        <span className="small muted" style={{ fontSize: 10 }}>≈ {Math.round(7.5 * row.mult)} a tiro</span>
                      </div>
                    );
                  })}
                  <div className="small muted" style={{ fontSize: 10, lineHeight: 1.5, marginTop: 4 }}>Le righe seguono il livello massimo dell'edificio: alzandolo compaiono le successive.</div>
                </div>
              ) : (
                <div className="small muted" style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 12 }}>Senza un edificio delle case il tiro si fa comunque, ma non aggiunge nessuno.</div>
              )}

              {/* Mazzo */}
              <div className="label" style={{ fontSize: 8, marginBottom: 5 }}>Mazzo dei forestieri · {deck.length}</div>
              {deck.length === 0 && <div className="small muted" style={{ fontSize: 10, marginBottom: 6 }}>Vuoto. Una carta si prepara dalla scheda del PNG, nella sezione «Villaggio».</div>}
              {deck.map((npc: any) => (
                <div key={npc.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '2px 0' }}>
                  <span className="small grow">{npc.name}{npc.trait ? <span className="muted" style={{ fontSize: 10, fontStyle: 'italic' }}> · {npc.trait}</span> : <span className="muted" style={{ fontSize: 10 }}> · senza tratto</span>}</span>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '2px 8px', flexShrink: 0 }} disabled={today === null} onClick={() => callIn(npc.id)}>Fai arrivare</button>
                </div>
              ))}
              {dismissed.map((npc: any) => (
                <div key={npc.id} className="row" style={{ gap: 6, alignItems: 'center', padding: '2px 0', opacity: .7 }}>
                  <span className="small grow">{npc.name} <span className="muted" style={{ fontSize: 10 }}>· ha avuto un rifiuto alla porta</span></span>
                  <button className="btn btn-ghost" style={{ fontSize: 9, padding: '2px 8px', flexShrink: 0 }} onClick={() => recall(npc.id)}>Rimetti nel mazzo</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PanelBox>
  );
}
