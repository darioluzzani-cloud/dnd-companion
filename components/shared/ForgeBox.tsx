'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { sfxComplete } from '@/lib/dnd/sounds';

const FORGEABLE_TYPES = ['arma', 'armatura', 'equipaggiamento', 'unico', 'magico'];

export interface SmithUpgrade {
  id: string;
  name: string;
  desc: string;       // effetto testuale, finirà sull'oggetto potenziato
  material?: string;  // nome esatto dell'oggetto-materiale richiesto (vuoto = nessuno)
}

// ─── FUCINA DI DURNA — riquadro autonomo della tab Base ─────
export function ForgeBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  const [open, setOpen] = useState(false);
  const [bgTick, setBgTick] = useState(0);
  const [playerId, setPlayerId] = useState<string>(s.activePlayer || s.players[0]?.id || '');
  const [itemId, setItemId] = useState<string>('');
  const [upgradeId, setUpgradeId] = useState<string>('');
  const [done, setDone] = useState<string | null>(null);
  // form DM per il catalogo
  const [draftName, setDraftName] = useState('');
  const [draftMat, setDraftMat] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  const upgrades: SmithUpgrade[] = (s as any).smithUpgrades || [];
  const setUpgrades = (list: SmithUpgrade[]) => update({ smithUpgrades: list } as any);

  const player = s.players.find(pl => pl.id === playerId);
  const item = player?.inventory.find(it => it.id === itemId);
  const upgrade = upgrades.find(u => u.id === upgradeId);
  // Materiale richiesto: cerco nell'inventario del PG scelto un oggetto con quel nome
  const material = upgrade?.material
    ? player?.inventory.find(it => it.name === upgrade.material && (it.qty || 0) > 0)
    : undefined;
  const materialOk = !upgrade?.material || !!material;
  const alreadyApplied = !!(item && upgrade && ((item as any).upgrades || []).some((u: any) => u.name === upgrade.name));
  const freeSlot = !!(item && ((item as any).enhUsed ?? 0) < ((item as any).enhSlots ?? 0));
  const ready = !!(player && item && upgrade && materialOk && !alreadyApplied && freeSlot);

  const forge = () => {
    if (!ready || !player || !item || !upgrade) return;
    update(prev => ({
      players: prev.players.map(pl => {
        if (pl.id !== player.id) return pl;
        let inventory = pl.inventory.map(it =>
          it.id === item.id
            ? ({ ...it,
                upgrades: [ ...((it as any).upgrades || []), { name: upgrade.name, desc: upgrade.desc } ],
                enhUsed: Math.min(((it as any).enhSlots ?? 0), ((it as any).enhUsed ?? 0) + 1),  // il martelletto si accende da solo
              } as any)
            : it
        );
        if (upgrade.material) {
          inventory = inventory
            .map(it => it.name === upgrade.material ? { ...it, qty: it.qty - 1 } : it)
            .filter(it => !(it.name === upgrade.material && it.qty <= 0));
        }
        return { ...pl, inventory };
      }),
    }));
    sfxComplete();
    setDone(`${item.name} · ${upgrade.name}`);
    setItemId(''); setUpgradeId('');
  };

  return (
    <div className="frame" style={{ position: 'relative', overflow: 'hidden', borderColor: 'var(--ember)' }}>
        {/* Sfondo — immagine piena in alto che sfuma nel riquadro */}
        {open && <div key={bgTick} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ImageSlot slotId="forge-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" hideIfEmpty alt="" />
        </div>}
        {open && <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(30,22,48,0) 0%, rgba(30,22,48,0.55) 25%, rgba(30,22,48,0.92) 50%, rgba(30,22,48,1) 70%)' }} />}

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Testata ripiegabile */}
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: open ? 10 : 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
            <div className="row" style={{ gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="1.5"><path d="M14 4l6 6-2 2-2-1-6.5 6.5a2.1 2.1 0 11-3-3L13 8l-1-2 2-2zM3 21l3-3"/></svg>
              <div className="h2" style={{ color: 'var(--ember)' }}>Fucina di Durna</div>
            </div>
            <span style={{ fontSize: 14, color: 'var(--ember)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : '' }}>▾</span>
          </div>
          {open && <>

          {/* 1 — Chi si presenta alla fucina */}
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>1 · Avventuriero</div>
            <div className="row" style={{ gap: 6 }}>
              {s.players.map(pl => (
                <button key={pl.id} onClick={() => { setPlayerId(pl.id); setItemId(''); setDone(null); }}
                  style={{ flex: 1, padding: 4, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    border: '2px solid ' + (playerId === pl.id ? (pl.color || 'var(--ember)') : 'var(--border)'),
                    background: playerId === pl.id ? 'var(--bg-active)' : 'transparent', transition: 'all .15s' }}>
                  <div style={{ width: 40, height: 40, margin: '0 auto 3px' }}>
                    <ImageSlot slotId={'portrait-' + pl.id} campaignId={campaignId} shape="circle" width={40} height={40} placeholder={(pl.short || pl.name).slice(0, 2)} alt={pl.name} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '.5px', color: playerId === pl.id ? 'var(--text)' : 'var(--gray-purple)' }}>{pl.short || pl.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2 — L'oggetto da portare all'incudine */}
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>2 · Oggetto</div>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, flexShrink: 0 }}>
                {item
                  ? <ImageSlot slotId={'item-' + item.id} campaignId={campaignId} shape="rounded" width={52} height={52} placeholder={item.name.slice(0, 2)} alt={item.name} />
                  : <div className="img-frame" style={{ width: 52, height: 52, borderRadius: 8 }}><div className="img-empty" style={{ borderRadius: 8 }}>?</div></div>}
              </div>
              <select value={itemId} onChange={e => { setItemId(e.target.value); setDone(null); }} className="grow" style={{ fontSize: 13 }}>
                <option value="">— scegli dall'inventario di {player?.short || '…'} —</option>
                {(player?.inventory || []).filter(it => FORGEABLE_TYPES.includes(it.type)).map(it => (
                  <option key={it.id} value={it.id}>{it.name}{((it as any).upgrades || []).length > 0 ? ' ⚒' : ''}</option>
                ))}
              </select>
            </div>
            {item && (
              <div className="small muted" style={{ marginTop: 6 }}>
                Slot: {((item as any).enhUsed ?? 0)} / {((item as any).enhSlots ?? 0)} occupati
                {((item as any).upgrades || []).length > 0 && <> · {((item as any).upgrades || []).map((u: any) => u.name).join(', ')}</>}
              </div>
            )}
          </div>

          {/* 3 — Il potenziamento */}
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>3 · Potenziamento</div>
            <select value={upgradeId} onChange={e => { setUpgradeId(e.target.value); setDone(null); }} style={{ fontSize: 13, marginBottom: upgrade ? 8 : 0 }}>
              <option value="">— scegli il lavoro di fucina —</option>
              {upgrades.map(u => (
                <option key={u.id} value={u.id}>{u.name}{u.material ? ` (richiede: ${u.material})` : ''}</option>
              ))}
            </select>
            {upgrade && (
              <div className="small" style={{ color: 'var(--text-card)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--ember)', fontWeight: 600 }}>{upgrade.name}</span> — {upgrade.desc || 'nessun effetto descritto'}
              </div>
            )}
          </div>

          {/* 4 — Il materiale, se il lavoro lo esige */}
          {upgrade?.material && (
            <div className="card">
              <div className="label" style={{ marginBottom: 6 }}>4 · Materiale richiesto</div>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, flexShrink: 0 }}>
                  {material
                    ? <ImageSlot slotId={'item-' + material.id} campaignId={campaignId} shape="rounded" width={44} height={44} placeholder={material.name.slice(0, 2)} alt={material.name} />
                    : <div className="img-frame" style={{ width: 44, height: 44, borderRadius: 8 }}><div className="img-empty" style={{ borderRadius: 8 }}>✕</div></div>}
                </div>
                {material
                  ? <div className="small">{material.name} <span className="muted">× {material.qty} nell'inventario — ne verrà consumato 1</span></div>
                  : <div className="small" style={{ color: 'var(--red)' }}>{upgrade.material} — non presente nell'inventario di {player?.short}</div>}
              </div>
            </div>
          )}

          {/* Creazione */}
          <button className="btn btn-primary" disabled={!ready}
            style={{ width: '100%', fontSize: 12, marginBottom: 10, opacity: ready ? 1 : 0.45,
              borderColor: 'var(--ember)', color: ready ? undefined : 'var(--gray-purple)' }}
            onClick={forge}>
            {alreadyApplied ? 'Potenziamento già applicato' : (item && !freeSlot ? 'Nessuno slot di potenziamento libero' : 'Creazione')}
          </button>
          {done && (
            <div className="card" style={{ borderColor: 'var(--green)', textAlign: 'center' }}>
              <span className="small" style={{ color: 'var(--green-light)' }}>Il martello ha parlato: <strong>{done}</strong></span>
            </div>
          )}

          {/* Catalogo dei lavori — solo DM */}
          {s.dmMode && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="label" style={{ marginBottom: 6 }}>Catalogo della fucina (DM)</div>
              {upgrades.map(u => (
                <div key={u.id} className="row" style={{ gap: 6, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="small grow">{u.name}{u.material ? <span className="muted"> · {u.material}</span> : ''}</span>
                  <button className="btn btn-danger btn-ghost" style={{ padding: '0 6px', fontSize: 10 }}
                    onClick={() => { if (confirm('Rimuovere "' + u.name + '" dal catalogo?')) setUpgrades(upgrades.filter(x => x.id !== u.id)); }}>&times;</button>
                </div>
              ))}
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                <input value={draftName} placeholder="Potenziamento (es. Potenzia il taglio)" onChange={e => setDraftName(e.target.value)} style={{ fontSize: 12, flex: '1 1 100%' }} />
                <input value={draftMat} placeholder="Materiale richiesto (opz., es. Pelliccia)" onChange={e => setDraftMat(e.target.value)} style={{ fontSize: 12, flex: '1 1 100%' }} />
                <textarea value={draftDesc} placeholder="Effetto testuale (comparirà sull'oggetto)…" onChange={e => setDraftDesc(e.target.value)} style={{ minHeight: 40, fontSize: 12, flex: '1 1 100%' }} />
                <button className="btn" style={{ fontSize: 10, width: '100%' }}
                  onClick={() => { if (!draftName.trim()) return; setUpgrades([...upgrades, { id: uid('sm'), name: draftName.trim(), desc: draftDesc.trim(), material: draftMat.trim() || undefined }]); setDraftName(''); setDraftMat(''); setDraftDesc(''); }}>Aggiungi al catalogo</button>
              </div>
            </div>
          )}

          {/* Sfondo — solo DM */}
          {s.dmMode && (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div className="label" style={{ fontSize: 9 }}>Sfondo</div>
              <div style={{ width: 72, height: 44 }}>
                <ImageSlot slotId="forge-bg" campaignId={campaignId} shape="rounded" width="100%" height="100%" dmMode placeholder="Sfondo" alt="" onUploaded={() => setBgTick(t => t + 1)} />
              </div>
              <span className="small muted">Unico per la fucina; sfuma nel pannello.</span>
            </div>
          )}
          </>}
        </div>
    </div>
  );
}
