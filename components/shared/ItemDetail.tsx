'use client';
import { ImageSlot } from '@/components/ImageSlot';
import { Markdown } from '@/components/shared/textUtils';
import { NumberInput } from '@/components/shared/textUtils';
import { ATTUNE_MAX, attunedCount, qtyEditable, hasWear } from '@/lib/dnd/equipment';
import { isPerishable, batchesOf, batchLabel, BATCH_SLOTS, PERISH_DAYS } from '@/lib/dnd/perishables';

// ─── SCHEDA DELL'OGGETTO ─────────────────────────────────────
// Corpo condiviso fra la sagoma dell'equipaggiamento e la griglia
// dell'inventario, così le due viste non divergono col tempo: i comandi
// propri di ciascuna restano fuori, passati come contorno.

export function ItemDetailBody({ item, inventory, campaignId, accent, onAttune, onEnlarge, onImgPos, imageHeight = 200, slotPrefix = 'itemdetail',
  dmMode, onQty, onPu, players, onTransfer, today, onConsume }: {
  item: any;
  inventory?: any[];
  campaignId: string | null;
  accent: string;
  onAttune?: () => void;
  onEnlarge?: (src: string) => void;
  onImgPos?: (v: number) => void;   // se presente, compare il cursore d'inquadratura
  imageHeight?: number;
  slotPrefix?: string;
  dmMode?: boolean;
  onQty?: (n: number) => void;      // regolazione della quantità
  onPu?: (n: number) => void;       // Punti Usura
  players?: { id: string; name: string; short?: string; color?: string }[];
  onTransfer?: (targetId: string) => void;   // «Passa a…»
  today?: any;                      // data corrente, per la scadenza dei preparati
  onConsume?: (madeOn: number, n?: number) => void;   // muove le dosi di un lotto (n>0 consuma, n<0 restituisce)
}) {
  if (!item) return null;
  const qty = item.qty ?? 1;
  const anchor = `${slotPrefix}-${item.id}`;
  const bloccato = !item.attuned && attunedCount(inventory) >= ATTUNE_MAX;
  const canQty = !!onQty && qtyEditable(item, dmMode);
  const perish = isPerishable(item);
  const batches = perish ? batchesOf(item) : [];

  return (
    <>
      <div style={{ cursor: onEnlarge ? 'pointer' : 'default', marginBottom: 10 }}
        onClick={() => {
          if (!onEnlarge) return;
          const img = document.querySelector(`[data-slot="${anchor}"] img`) as HTMLImageElement;
          if (img?.src) onEnlarge(img.src);
        }}>
        <div data-slot={anchor}>
          <ImageSlot slotId={'item-' + item.id} campaignId={campaignId} shape="rounded" width="100%" height={imageHeight}
            dmMode={false} placeholder={item.name.slice(0, 2).toUpperCase()} alt={item.name} hideIfEmpty
            objectPosition={`center ${item.imgPos ?? 50}%`} />
        </div>
      </div>

      {onImgPos && (
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }} onClick={e => e.stopPropagation()}>
          <span className="label" style={{ fontSize: 8 }}>Inquadratura</span>
          <input type="range" min={0} max={100} value={item.imgPos ?? 50}
            onChange={e => onImgPos(parseInt(e.target.value))}
            style={{ flex: 1 }} title="Sposta il ritaglio verso l'alto o verso il basso" />
          <span className="small muted" style={{ fontSize: 10, width: 32, textAlign: 'right' }}>{item.imgPos ?? 50}%</span>
        </div>
      )}

      <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
        <div className="h2 grow" style={{ fontSize: 16, color: accent }}>{item.name}</div>
        {qty !== 1 && <span className="small muted">×{qty}</span>}
      </div>
      <div className="small muted" style={{ marginBottom: 8 }}>
        {item.type}{item.subtype ? ' · ' + item.subtype : ''}
        {item.type === 'armatura' && item.armorCA ? ` · CA ${item.armorCA}` : ''}
        {item.equipped ? ' · indossato' : ''}
      </div>

      {item.attunement && (
        <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <button className="btn" disabled={!onAttune || bloccato}
            style={{ fontSize: 11, padding: '4px 12px',
              color: item.attuned ? 'var(--blue)' : 'var(--gray-purple)',
              borderColor: item.attuned ? 'var(--blue)' : 'var(--border)',
              background: item.attuned ? 'var(--bg-active)' : 'transparent',
              opacity: (!onAttune || bloccato) ? .5 : 1 }}
            onClick={() => onAttune && onAttune()}>
            ◈ {item.attuned ? 'Sintonizzato' : 'Sintonizzati'}
          </button>
          {bloccato && <span className="small" style={{ color: 'var(--red)' }}>Hai già {ATTUNE_MAX} sintonie attive</span>}
        </div>
      )}

      {item.effect && (
        <div className="card" style={{ padding: '8px 10px' }}>
          <div className="label" style={{ fontSize: 8, marginBottom: 3, color: 'var(--gold)' }}>Effetto</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--gold)' }}><Markdown text={item.effect} /></div>
        </div>
      )}
      {item.desc && (
        <div className="card" style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}><Markdown text={item.desc} /></div>
        </div>
      )}
      {(item.upgrades || []).length > 0 && (
        <div className="card" style={{ padding: '8px 10px' }}>
          <div className="label" style={{ fontSize: 8, marginBottom: 4, color: 'var(--ember)' }}>Potenziamenti</div>
          {(item.upgrades || []).map((u: any, i: number) => (
            <div key={i} className="small" style={{ marginBottom: 2 }}>⚒ <b>{u.name}</b>{u.desc ? ' — ' + u.desc : ''}</div>
          ))}
        </div>
      )}
      {!item.effect && !item.desc && (item.upgrades || []).length === 0 && (
        <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Nessuna descrizione registrata.</div>
      )}

      {/* ── Preparato deperibile: i lotti ──────────────────────
          Due riquadri, quanti sono i giorni di vita del preparato: più di
          due partite non possono coesistere. Ognuno porta la propria data,
          la propria scorta e il proprio comando di consumo; il lotto più
          vecchio sta a sinistra, ed è quello da bere per primo. Svuotato un
          riquadro, si libera e resta pronto per la prossima preparazione. */}
      {perish && today && (
        <div style={{ marginTop: 10 }}>
          <div className="row" style={{ gap: 6, alignItems: 'baseline', marginBottom: 5 }}>
            <span className="label" style={{ fontSize: 9 }}>Partite preparate</span>
            <span className="small muted" style={{ fontSize: 9 }}>durata {PERISH_DAYS} giorni</span>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
            {Array.from({ length: Math.max(BATCH_SLOTS, batches.length) }).map((_, i) => {
              const b = batches[i];
              if (!b) return (
                <div key={'empty' + i} className="card" style={{ flex: '1 1 0', minWidth: 0, margin: 0, padding: '10px 8px',
                  borderStyle: 'dashed', textAlign: 'center' }}>
                  <span className="small muted" style={{ fontSize: 10, fontStyle: 'italic' }}>riquadro libero</span>
                </div>
              );
              const lab = batchLabel(b, today);
              const urgent = lab.left <= 1;
              return (
                <div key={b.madeOn} className="card" style={{ flex: '1 1 0', minWidth: 0, margin: 0, padding: '8px 8px',
                  borderColor: urgent ? 'var(--red)' : 'var(--border-sec)' }}>
                  <div className="label" style={{ fontSize: 8, color: urgent ? 'var(--red)' : 'var(--gray-purple)' }}>
                    ⧖ {lab.made}
                  </div>
                  <div className="small" style={{ fontSize: 9, color: urgent ? 'var(--red)' : 'var(--gray-purple-deep)', marginBottom: 5 }}>
                    {lab.text}
                  </div>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: accent }}>×{b.qty}</span>
                    <div className="grow" />
                    {dmMode && onConsume && (
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 7px' }}
                        title="Restituisci una dose a questa partita"
                        onClick={() => onConsume(b.madeOn, -1)}>+</button>
                    )}
                    {onConsume && (
                      <button className="btn" style={{ fontSize: 10, padding: '3px 10px' }}
                        title="Bevi o applica una dose di questa partita"
                        onClick={() => onConsume(b.madeOn, 1)}>Consuma</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {batches.length === 0 && (
            <div className="small muted" style={{ fontSize: 10, fontStyle: 'italic', marginTop: 5 }}>
              Nessuna partita in scorta: se ne prepara una nuova in alchimia.
            </div>
          )}
        </div>
      )}

      {/* Quantità — regolabile dal giocatore su ciò che si consuma e su ciò
          che il DM ha dichiarato munizione; dal DM sempre. Sui deperibili la
          quantità è la somma dei lotti e si governa dai riquadri qui sopra. */}
      {canQty && !perish && (
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 10 }}>
          <span className="label" style={{ fontSize: 9 }}>Quantità</span>
          <button className="btn" style={{ padding: '3px 12px', fontSize: 13 }} onClick={() => onQty!(Math.max(0, qty - 1))}>−</button>
          <NumberInput value={qty} min={0} onChange={n => onQty!(Math.max(0, n))}
            style={{ width: 52, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, padding: '3px 4px' }} />
          <button className="btn" style={{ padding: '3px 12px', fontSize: 13 }} onClick={() => onQty!(qty + 1)}>+</button>
          {item.ammo && <span className="small muted" style={{ fontSize: 9 }}>munizione</span>}
        </div>
      )}

      {/* Punti Usura — visibili e correggibili anche dal giocatore */}
      {onPu && hasWear(item) && (
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
          <span className="label" style={{ fontSize: 9 }}>Usura</span>
          <button className="btn" style={{ padding: '3px 12px', fontSize: 13 }} onClick={() => onPu(Math.max(0, (item.pu ?? 0) - 1))}>−</button>
          <NumberInput value={item.pu ?? 0} min={0} onChange={n => onPu(Math.max(0, n))}
            style={{ width: 52, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600,
              color: (item.pu ?? 0) > 0 ? 'var(--red)' : 'var(--gray-purple)', padding: '3px 4px' }} />
          <button className="btn" style={{ padding: '3px 12px', fontSize: 13 }} onClick={() => onPu((item.pu ?? 0) + 1)}>+</button>
          <span className="small muted" style={{ fontSize: 9 }}>PU</span>
        </div>
      )}

      {/* Passa a… — un solo comando, aperto anche ai giocatori: un oggetto
          consegnato di mano in mano non deve passare dal DM. */}
      {onTransfer && (players || []).length > 0 && (
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
          <span className="label" style={{ fontSize: 9, flexShrink: 0 }}>Passa a</span>
          <select className="grow" style={{ fontSize: 12, padding: '4px 6px' }} defaultValue=""
            onChange={e => { const v = e.target.value; e.target.value = ''; if (v) onTransfer(v); }}>
            <option value="">— scegli il destinatario —</option>
            {(players || []).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
