'use client';
import { ImageSlot } from '@/components/ImageSlot';
import { Markdown } from '@/components/shared/textUtils';
import { ATTUNE_MAX, attunedCount } from '@/lib/dnd/equipment';

// ─── SCHEDA DELL'OGGETTO ─────────────────────────────────────
// Corpo condiviso fra la sagoma dell'equipaggiamento e la griglia
// dell'inventario, così le due viste non divergono col tempo: i comandi
// propri di ciascuna restano fuori, passati come contorno.

export function ItemDetailBody({ item, inventory, campaignId, accent, onAttune, onEnlarge, onImgPos, imageHeight = 200, slotPrefix = 'itemdetail' }: {
  item: any;
  inventory?: any[];
  campaignId: string | null;
  accent: string;
  onAttune?: () => void;
  onEnlarge?: (src: string) => void;
  onImgPos?: (v: number) => void;   // se presente, compare il cursore d'inquadratura
  imageHeight?: number;
  slotPrefix?: string;
}) {
  if (!item) return null;
  const qty = item.qty ?? 1;
  const anchor = `${slotPrefix}-${item.id}`;
  const bloccato = !item.attuned && attunedCount(inventory) >= ATTUNE_MAX;

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
    </>
  );
}
