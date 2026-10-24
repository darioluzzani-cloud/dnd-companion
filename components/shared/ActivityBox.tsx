'use client';
import { ReactNode } from 'react';
import { CampaignState } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { PanelBox, panelPos, panelCtl } from '@/components/shared/PanelBox';
import { YieldCard } from '@/components/shared/YieldCard';
import { absDay, DEFAULT_CALENDAR } from '@/lib/dnd/calendar';
import {
  ActivityState, activitiesOf, activityStatus, activityBuilding,
  effectsOf, describeEffect, effectSign, isKnown, daysToKnow, workersOf, postsOf,
} from '@/lib/dnd/village';

// ─── RIQUADRO DI UN'ATTIVITÀ ─────────────────────────────────
// Per le attività che non hanno — ancora — un banco di lavoro proprio, come
// la fucina e la conceria: i Campi, l'Erboristeria, la Cappella. Il riquadro
// mostra lo stato, chi la tiene e che cosa porta, gli adulti al lavoro e la
// produzione settimanale. Capo e adulti si assegnano in «Gli abitanti»:
// qui si leggono soltanto, perché le stesse decisioni non abbiano due posti.
//
// Quando un'attività avrà un gesto proprio — la semina dei Campi, per
// esempio — lo si aggiungerà qui come `children`, sopra la produzione.

const STATE: Record<ActivityState, { label: string; color: string }> = {
  active:  { label: 'Attiva',        color: 'var(--green)' },
  idle:    { label: 'Senza capo',    color: 'var(--gold-dim)' },
  unbuilt: { label: 'Da costruire',  color: 'var(--gray-purple)' },
  low:     { label: 'Da potenziare', color: 'var(--gray-purple)' },
};

export interface ActivityBoxCfg {
  panelId: string;       // identificativo nella disposizione della Base
  activityId: string;    // attività del catalogo di «Gli abitanti»
  title: string;         // nome di partenza del riquadro
  color: string;
  bgSlot: string;
  icon: ReactNode;
}

export function ActivityBox({ s, update, campaignId, cfg, children }: { s: CampaignState; update: U; campaignId: string | null; cfg: ActivityBoxCfg; children?: ReactNode }) {
  const act = activitiesOf(s).find(a => a.id === cfg.activityId);
  if (!act) return null;   // attività tolta dal catalogo: niente riquadro
  const st = activityStatus(s, act.id);
  // Ai giocatori il riquadro compare con l'edificio, come la Biblioteca; il DM lo vede sempre.
  if (!s.dmMode && act.building !== 'none' && !activityBuilding(s, act)) return null;

  const meta = STATE[st.state];
  const today = absDay((s.calendar || DEFAULT_CALENDAR).date);
  const posts = postsOf(s, act);
  const workers = workersOf(s)[act.id] || 0;
  const known = !!st.capo && isKnown(s, st.capo.id, act.id);
  const fx = st.capo ? effectsOf(st.capo, act.id) : [];

  const why = st.state === 'unbuilt' ? 'L\'edificio non esiste ancora: si costruisce fra gli edifici di Olmobianco.'
    : st.state === 'low' ? `«${st.building?.name}» è al livello ${st.building?.level || 0}: l'attività si apre al livello ${st.need}.`
    : st.state === 'idle' ? 'Nessuno la tiene: il capo si sceglie nel riquadro «Gli abitanti».'
    : '';

  return (
    <PanelBox {...panelCtl(s, update, cfg.panelId, cfg.title)} color={cfg.color} bgSlot={cfg.bgSlot} campaignId={campaignId} dmMode={s.dmMode} {...panelPos(s, update, cfg.bgSlot)}
      badge={<span className="pill" style={{ padding: '2px 8px', fontSize: 8.5, color: meta.color, borderColor: meta.color }}>{meta.label}</span>}
      icon={cfg.icon}>

      {/* Stato e capo */}
      <div className="card" style={{ padding: '11px 13px' }}>
        {why && <div className="small" style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--gold-dim)', marginBottom: st.capo ? 9 : 0 }}>{why}</div>}
        {st.capo ? (
          <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
            <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', border: '1px solid ' + cfg.color }}>
              <ImageSlot slotId={'png-' + st.capo.id} campaignId={campaignId} shape="circle" width={56} height={56} dmMode={false}
                placeholder={(st.capo.name || '?').slice(0, 2).toUpperCase()} alt={st.capo.name} objectPosition={`center ${st.capo.imgPos ?? 50}%`} />
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="label" style={{ fontSize: 8, marginBottom: 2 }}>La tiene</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--gold)' }}>{st.capo.name}</div>
              {st.capo.trait && <div className="small" style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--text-card)', lineHeight: 1.4 }}>{st.capo.trait}</div>}
              {/* Che cosa porta: noto dopo una settimana di lavoro; il DM lo vede sempre */}
              <div style={{ marginTop: 6 }}>
                {(known || s.dmMode) ? (
                  fx.length === 0
                    ? <span className="small muted" style={{ fontSize: 11 }}>Né bonus né malus.</span>
                    : fx.map((a, i) => {
                        const d = describeEffect(s, a), sg = effectSign(a);
                        return (
                          <div key={i} className="small" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
                            {a.text}{a.text && d ? ' — ' : ''}
                            {d && <b style={{ color: sg > 0 ? 'var(--green)' : sg < 0 ? 'var(--red)' : 'var(--gray-purple)' }}>{d}</b>}
                          </div>
                        );
                      })
                ) : (
                  <span className="small muted" style={{ fontSize: 11 }}>
                    {st.state !== 'active' ? 'Bonus e malus si scopriranno al lavoro, quando l\'attività sarà attiva.'
                      : (() => { const left = st.seat ? daysToKnow(st.seat, today) : 6; return `Bonus e malus si vedranno ${left <= 1 ? 'fra un giorno' : `fra ${left} giorni`} di lavoro.`; })()}
                  </span>
                )}
                {s.dmMode && !known && fx.length > 0 && <div className="small muted" style={{ fontSize: 9.5 }}>celato ai giocatori</div>}
              </div>
            </div>
          </div>
        ) : null}

        {/* Adulti al lavoro: si leggono qui, si assegnano in «Gli abitanti» */}
        {posts > 0 && (
          <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span className="label" style={{ fontSize: 8 }}>Adulti al lavoro</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: workers > 0 ? 'var(--gold)' : 'var(--gray-purple)' }}>
              {workers}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--gray-purple)' }}> / {posts}</span>
            </span>
            <span className="small muted" style={{ fontSize: 10 }}>si assegnano in «Gli abitanti»</span>
          </div>
        )}
      </div>

      {children}

      {/* Ciò che l'attività rende al magazzino a ogni mercato */}
      <YieldCard s={s} update={update} campaignId={campaignId} activityId={act.id} color={cfg.color} />
    </PanelBox>
  );
}

// ─── Le tre attività ─────────────────────────────────────────

const ic = (c: string, d: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{d.split('|').map((p, i) => <path key={i} d={p} />)}</svg>;

export const FIELDS: ActivityBoxCfg = {
  panelId: 'fields', activityId: 'act-campi', title: 'Campi di Olmobianco', color: 'var(--gold-light)', bgSlot: 'fields-bg',
  icon: ic('var(--gold-light)', 'M12 21V9|M12 9c0-3 2-5 5-5 0 3-2 5-5 5z|M12 13c0-3-2-5-5-5 0 3 2 5 5 5z|M12 17c0-2.5 2-4 4.5-4 0 2.5-2 4-4.5 4z|M4 21h16'),
};
export const HERBS: ActivityBoxCfg = {
  panelId: 'herbs', activityId: 'act-erboristeria', title: 'Erboristeria', color: 'var(--green-light)', bgSlot: 'herbs-bg',
  icon: ic('var(--green-light)', 'M6 20c8 0 12-6 12-15-9 0-15 4-15 12 0 1 .2 2 .5 3|M6 20c1-5 4-9 9-12'),
};
export const CHAPEL: ActivityBoxCfg = {
  panelId: 'chapel', activityId: 'act-cappella', title: 'Cappella di S. Mira', color: 'var(--blue)', bgSlot: 'chapel-bg',
  icon: ic('var(--blue)', 'M12 3v4|M10 5h4|M5 21V11l7-4 7 4v10|M9 21v-5a3 3 0 016 0v5|M3 21h18'),
};
