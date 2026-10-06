'use client';
import { useState, ReactNode } from 'react';
import { ImageSlot, registerStorageFile } from '@/components/ImageSlot';
import { supabase } from '@/lib/supabase';

// ─── RIQUADRO DEL MENÙ BASE ──────────────────────────────────
// Forma unica per tutti i riquadri della tab Base, estratta dalla Fucina di
// Durna: sfondo illustrato, testata ripiegabile, sfumatura che cambia a
// seconda che il pannello sia aperto o chiuso. Prima ogni riquadro aveva
// la sua struttura — magazzino in un modo, mercato in un altro, villaggio
// in un terzo — e la tab si leggeva come un collage.
//
// L'apertura è stato locale del riquadro: nessun toggle di navigazione
// finisce nel dato condiviso fra i cinque dispositivi.
//
// L'inquadratura dello sfondo a scheda chiusa, invece, è un dato condiviso:
// a riquadro chiuso l'immagine si riduce a una striscia bassa e larga, e
// dove cada il ritaglio decide se si vede il soggetto o il suo soffitto.
// La sceglie il DM con un cursore, come per le immagini degli oggetti, e
// vale per tutti i dispositivi.

/** Inquadrature degli sfondi: slot → posizione verticale del ritaglio (0–100). */
export type PanelPos = Record<string, number>;

/** Le due proprietà d'inquadratura da passare a un riquadro, lette e
 *  scritte nello stato della campagna. */
export function panelPos(s: any, update: (patch: any) => void, slot: string): { bgPos: number; onBgPos: (n: number) => void } {
  const cur = (s?.panelPos as PanelPos | undefined)?.[slot];
  return {
    bgPos: typeof cur === 'number' ? cur : 50,
    onBgPos: (n: number) => update((prev: any) => ({ panelPos: { ...((prev?.panelPos || {}) as PanelPos), [slot]: n } })),
  };
}

export function PanelBox({ title, color, icon, bgSlot, campaignId, dmMode, badge, defaultOpen, bgPos, onBgPos, children }: {
  title: string;
  color: string;
  icon: ReactNode;
  bgSlot: string;             // slot immagine dello sfondo
  campaignId: string | null;
  dmMode?: boolean;
  badge?: ReactNode;          // indicatore mostrato anche a pannello chiuso
  defaultOpen?: boolean;
  bgPos?: number;             // inquadratura verticale dello sfondo a scheda chiusa (0–100)
  onBgPos?: (n: number) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [bgTick, setBgTick] = useState(0);

  return (
    <div className="frame" style={{ position: 'relative', overflow: 'hidden', borderColor: color, padding: 0, minHeight: open ? undefined : 76 }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div data-slot={bgSlot} style={{ width: '100%', height: '100%' }}>
          <ImageSlot key={(open ? 'o' : 'c') + bgTick} slotId={bgSlot} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt={title}
            objectPosition={open ? undefined : `center ${bgPos ?? 50}%`} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: open
        ? 'linear-gradient(180deg, rgba(30,22,48,0) 0%, rgba(30,22,48,0.55) 25%, rgba(30,22,48,0.92) 50%, rgba(30,22,48,1) 70%)'
        : 'linear-gradient(90deg, rgba(11,8,20,.92) 0%, rgba(11,8,20,.4) 50%, rgba(11,8,20,0) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, padding: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer', marginBottom: open ? 10 : 0, gap: 8 }} onClick={() => setOpen(!open)}>
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            {icon}
            <div className="h2" style={{ color, whiteSpace: 'nowrap' }}>{title}</div>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {badge}
            <span style={{ fontSize: 14, color, transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : '' }}>▾</span>
          </div>
        </div>
        {open && <>
          {children}
          {dmMode && <PanelBg slot={bgSlot} campaignId={campaignId} color={color} onDone={() => setBgTick(t => t + 1)} />}
          {dmMode && onBgPos && <PanelBgPos slot={bgSlot} campaignId={campaignId} pos={bgPos ?? 50} onPos={onBgPos} tick={bgTick} />}
        </>}
      </div>
    </div>
  );
}

/** Caricamento dello sfondo — solo DM. Sostituisce la versione precedente. */
export function PanelBg({ slot, campaignId, color, onDone }: { slot: string; campaignId: string | null; color: string; onDone: () => void }) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
      <div className="label" style={{ fontSize: 9 }}>Sfondo</div>
      <label className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10, cursor: 'pointer', color, borderColor: color }}>
        📷 Carica sfondo
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file || !campaignId) return;
          const ext = (file.name.split('.').pop() || 'png').toLowerCase();
          try {
            const { data: ex } = await supabase.storage.from('campaign-images').list(campaignId, { search: slot });
            const rm = (ex || []).filter((f: any) => f.name.startsWith(slot + '.')).map((f: any) => `${campaignId}/${f.name}`);
            if (rm.length) await supabase.storage.from('campaign-images').remove(rm);
            const vName = `${slot}.${Date.now().toString(36)}.${ext}`;
            await supabase.storage.from('campaign-images').upload(`${campaignId}/${vName}`, file, { upsert: true, cacheControl: '31536000', contentType: file.type });
            await registerStorageFile(campaignId, vName);
            onDone();
            window.location.reload();
          } catch (err: any) { alert('Errore: ' + (err.message || err)); }
          e.target.value = '';
        }} />
      </label>
      <span className="small muted" style={{ fontSize: 9 }}>Un'unica immagine per il riquadro chiuso e aperto.</span>
    </div>
  );
}

/**
 * Inquadratura dello sfondo a scheda chiusa — solo DM. Il cursore sposta
 * il ritaglio verso l'alto o verso il basso; l'anteprima mostra la striscia
 * così come apparirà a riquadro chiuso, perché da aperto la stessa immagine
 * occupa tutt'altra forma e non direbbe nulla del risultato.
 */
export function PanelBgPos({ slot, campaignId, pos, onPos, tick }: { slot: string; campaignId: string | null; pos: number; onPos: (n: number) => void; tick?: number }) {
  return (
    <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
      <div style={{ position: 'relative', height: 76, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <ImageSlot key={'pv' + (tick || 0)} slotId={slot} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="" objectPosition={`center ${pos}%`} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(11,8,20,.92) 0%, rgba(11,8,20,.4) 50%, rgba(11,8,20,0) 100%)' }} />
        <span className="small muted" style={{ position: 'absolute', left: 10, top: 8, fontSize: 9 }}>Anteprima a scheda chiusa</span>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6 }}>
        <span className="label" style={{ fontSize: 8 }}>Inquadratura</span>
        <input type="range" min={0} max={100} value={pos} onChange={e => onPos(parseInt(e.target.value))}
          style={{ flex: 1 }} title="Sposta il ritaglio dello sfondo verso l'alto o verso il basso" />
        <span className="small muted" style={{ fontSize: 10, width: 32, textAlign: 'right' }}>{pos}%</span>
      </div>
    </div>
  );
}

// ─── BANCO DI LAVORO ─────────────────────────────────────────
// Le due caselle quadrate con la freccia che si riempie: a sinistra ciò che
// entra nella bottega, a destra ciò che ne esce. La freccia raddoppia da
// indicatore di avanzamento quando una commessa è in corso, così la stessa
// figura racconta sia la trasformazione sia il tempo che le manca.

export function WorkBench({ left, lefts, right, pct, done, accent, label }: {
  left?: ReactNode;
  /** Più ingredienti: ciascuno nella propria casella, affiancate. Due pelli
   *  e una corteccia sono tre cose distinte sul banco, non un mucchio. */
  lefts?: ReactNode[];
  right: ReactNode;
  pct?: number;          // 0–100; assente = freccia inerte
  done?: boolean;
  accent: string;
  label?: string;
}) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const col = done ? 'var(--green)' : accent;
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'center', margin: '4px 0 8px' }}>
      <div className="row" style={{ gap: 5, flexShrink: 0 }}>
        {(lefts && lefts.length ? lefts : [left]).map((node, i, arr) => {
          // Le caselle si stringono al crescere del numero, così tre
          // ingredienti stanno sul banco senza spingere fuori la freccia.
          const side = arr.length >= 3 ? 52 : arr.length === 2 ? 64 : 84;
          return (
            <div key={i} style={{ width: side, height: side, flexShrink: 0, borderRadius: 9, overflow: 'hidden', border: '2px solid var(--border-sec)', position: 'relative' }}>
              {node}
            </div>
          );
        })}
      </div>

      <div style={{ flex: '1 1 0', minWidth: 44, maxWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ position: 'relative', width: '100%', height: 12 }}>
          {/* corpo della freccia */}
          <div style={{ position: 'absolute', left: 0, right: 10, top: 3, height: 6, borderRadius: 3, background: 'var(--bg-deep)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: p + '%', background: col, transition: 'width .4s' }} />
          </div>
          {/* punta */}
          <div style={{ position: 'absolute', right: 0, top: 0, width: 0, height: 0,
            borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
            borderLeft: `10px solid ${p >= 100 ? col : 'var(--border)'}`, transition: 'border-color .4s' }} />
        </div>
        {label && <span className="small muted" style={{ fontSize: 8.5, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>}
      </div>

      <div style={{ width: 84, height: 84, flexShrink: 0, borderRadius: 10, overflow: 'hidden',
        border: '2px solid ' + (done ? 'var(--green)' : 'var(--border-sec)'),
        boxShadow: done ? '0 0 18px rgba(90,180,110,.45)' : 'none', position: 'relative' }}>
        {right}
      </div>
    </div>
  );
}

/** Casella vuota del banco, con un segno al centro. */
export function BenchEmpty({ mark }: { mark: string }) {
  return <div className="img-empty" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, opacity: .5 }}>{mark}</div>;
}
