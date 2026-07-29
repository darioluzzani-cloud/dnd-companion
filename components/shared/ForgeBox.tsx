'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot, registerStorageFile } from '@/components/ImageSlot';
import { supabase } from '@/lib/supabase';
import { sfxComplete } from '@/lib/dnd/sounds';

const FORGEABLE_TYPES = ['arma', 'armatura', 'unico', 'magico'];

export type SmithCat = 'base' | 'avanzato' | 'nanico';

export const SMITH_CATS: { k: SmithCat; l: string; c: string }[] = [
  { k: 'base',     l: 'Base',     c: 'var(--ember)' },
  { k: 'avanzato', l: 'Avanzato', c: 'var(--gold)' },
  { k: 'nanico',   l: 'Nanico',   c: 'var(--blue)' },
];

export interface SmithMaterial { name: string; qty: number }

export interface SmithUpgrade {
  id: string;
  name: string;
  desc: string;                 // effetto testuale, finirà sull'oggetto potenziato
  cat?: SmithCat;               // catalogo di appartenenza (assente = base)
  materials?: SmithMaterial[];  // fino a tre materiali, con quantità
  material?: string;            // forma antica a materiale singolo: conservata e letta
}

/** Materiali richiesti in forma normalizzata, qualunque sia la stesura della voce. */
function reqMats(u?: SmithUpgrade): SmithMaterial[] {
  if (!u) return [];
  if (u.materials && u.materials.length) return u.materials.filter(m => m.name && m.name.trim());
  if (u.material && u.material.trim()) return [{ name: u.material.trim(), qty: 1 }];
  return [];
}

// ─── FUCINA DI DURNA — riquadro autonomo della tab Base ─────
export function ForgeBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  const [open, setOpen] = useState(false);
  const [bgTick, setBgTick] = useState(0);
  const [playerId, setPlayerId] = useState<string>(s.activePlayer || s.players[0]?.id || '');
  const [itemId, setItemId] = useState<string>('');
  const [upgradeId, setUpgradeId] = useState<string>('');
  const [cat, setCat] = useState<SmithCat>('base');
  const [done, setDone] = useState<{ itemId: string; itemName: string; upgName: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  const upgrades: SmithUpgrade[] = (s as any).smithUpgrades || [];
  const setUpgrades = (list: SmithUpgrade[]) => update({ smithUpgrades: list } as any);
  const patchUpg = (id: string, p: Partial<SmithUpgrade>) => setUpgrades(upgrades.map(u => u.id === id ? { ...u, ...p } : u));

  const player = s.players.find(pl => pl.id === playerId);
  const item = player?.inventory.find(it => it.id === itemId);
  const upgrade = upgrades.find(u => u.id === upgradeId);
  const catOf = (u: SmithUpgrade): SmithCat => u.cat || 'base';
  const inCat = upgrades.filter(u => catOf(u) === cat);

  // Un materiale può essere illustrato dall'oggetto omonimo di un inventario
  // qualsiasi o dalla voce d'armeria: basta un identificativo per lo slot.
  const findMatIllustration = (name: string): any => {
    for (const pl of s.players) {
      const f = (pl.inventory || []).find((it: any) => it.name === name);
      if (f) return f;
    }
    return ((s as any).armory || []).find((a: any) => a.name === name) || null;
  };

  const mats = reqMats(upgrade);
  const matState = mats.map(m => {
    const owned = player?.inventory.find(it => it.name === m.name);
    const have = owned?.qty || 0;
    return { ...m, owned, have, ok: have >= m.qty, illus: owned || findMatIllustration(m.name) };
  });
  const materialsOk = matState.every(m => m.ok);
  const alreadyApplied = !!(item && upgrade && ((item as any).upgrades || []).some((u: any) => u.name === upgrade.name));
  const freeSlot = !!(item && ((item as any).enhUsed ?? 0) < ((item as any).enhSlots ?? 0));
  const ready = !!(player && item && upgrade && materialsOk && !alreadyApplied && freeSlot);

  const forge = () => {
    if (!ready || !player || !item || !upgrade) return;
    const consume = reqMats(upgrade);
    update(prev => ({
      players: prev.players.map(pl => {
        if (pl.id !== player.id) return pl;
        let inventory = pl.inventory.map(it =>
          it.id === item.id
            ? ({ ...it,
                upgrades: [ ...((it as any).upgrades || []), { name: upgrade.name, desc: upgrade.desc } ],
                enhUsed: Math.min(((it as any).enhSlots ?? 0), ((it as any).enhUsed ?? 0) + 1),
              } as any)
            : it
        );
        for (const m of consume) {
          inventory = inventory
            .map(it => it.name === m.name ? { ...it, qty: (it.qty || 0) - m.qty } : it)
            .filter(it => !(it.name === m.name && (it.qty || 0) <= 0));
        }
        return { ...pl, inventory };
      }),
    }));
    sfxComplete();
    setDone({ itemId: item.id, itemName: item.name, upgName: upgrade.name });
    setItemId(''); setUpgradeId('');
  };

  return (
    <div className="frame" style={{ position: 'relative', overflow: 'hidden', borderColor: 'var(--ember)', padding: 0, minHeight: open ? undefined : 76 }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <div data-slot="forge-bg" style={{ width: '100%', height: '100%' }}>
            <ImageSlot key={(open ? 'o' : 'c') + bgTick} slotId="forge-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="Fucina di Durna" />
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: open
          ? 'linear-gradient(180deg, rgba(30,22,48,0) 0%, rgba(30,22,48,0.55) 25%, rgba(30,22,48,0.92) 50%, rgba(30,22,48,1) 70%)'
          : 'linear-gradient(90deg, rgba(11,8,20,.92) 0%, rgba(11,8,20,.4) 50%, rgba(11,8,20,0) 100%)' }} />

        <div style={{ position: 'relative', zIndex: 2, padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer', marginBottom: open ? 10 : 0 }} onClick={() => setOpen(!open)}>
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
                {(player?.inventory || []).filter(it => FORGEABLE_TYPES.includes(it.type) && (s.dmMode || (it as any).revealed !== false)).map(it => (
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

          {/* 3 — Il potenziamento, scelto entro uno dei tre cataloghi */}
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>3 · Potenziamento</div>
            <div className="row" style={{ gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
              {SMITH_CATS.map(c => {
                const n = upgrades.filter(u => catOf(u) === c.k).length;
                const on = cat === c.k;
                return (
                  <button key={c.k} className="pill" style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 9, flex: 1,
                    color: on ? c.c : 'var(--gray-purple-deep)', borderColor: on ? c.c : 'var(--border)',
                    background: on ? 'var(--bg-active)' : 'transparent' }}
                    onClick={() => { setCat(c.k); setUpgradeId(''); setDone(null); }}>
                    {c.l}{n > 0 ? ` · ${n}` : ''}
                  </button>
                );
              })}
            </div>
            <select value={upgradeId} onChange={e => { setUpgradeId(e.target.value); setDone(null); }} style={{ fontSize: 13, marginBottom: upgrade ? 8 : 0 }}>
              <option value="">— scegli il lavoro di fucina —</option>
              {inCat.map(u => {
                const rm = reqMats(u);
                return <option key={u.id} value={u.id}>{u.name}{rm.length ? ` (${rm.map(m => m.qty > 1 ? `${m.name} ×${m.qty}` : m.name).join(', ')})` : ''}</option>;
              })}
            </select>
            {inCat.length === 0 && <div className="small muted" style={{ fontStyle: 'italic' }}>Nessun lavoro in questo catalogo.</div>}
            {upgrade && (
              <div className="small" style={{ color: 'var(--text-card)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--ember)', fontWeight: 600 }}>{upgrade.name}</span> — {upgrade.desc || 'nessun effetto descritto'}
              </div>
            )}
          </div>

          {/* 4 — I materiali, se il lavoro li esige */}
          {mats.length > 0 && (
            <div className="card">
              <div className="label" style={{ marginBottom: 6 }}>4 · Materiali richiesti</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {matState.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 76 }}>
                    <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden',
                      border: `2px solid ${m.ok ? 'var(--green)' : 'var(--red)'}`,
                      opacity: m.ok ? 1 : .55, filter: m.ok ? 'none' : 'grayscale(.6)' }}>
                      {m.illus
                        ? <ImageSlot slotId={'item-' + m.illus.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder={m.name.slice(0, 2)} alt={m.name} />
                        : <div className="img-empty" style={{ width: '100%', height: '100%' }}>{m.name.slice(0, 2).toUpperCase()}</div>}
                      <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 9, fontWeight: 700, color: m.ok ? '#fff' : 'var(--red)', textShadow: '0 1px 3px #000' }}>
                        {m.have}/{m.qty}
                      </span>
                    </div>
                    <span style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.2, color: m.ok ? 'var(--text)' : 'var(--red)' }}>{m.name}</span>
                  </div>
                ))}
              </div>
              {!materialsOk && <div className="small" style={{ color: 'var(--red)', marginTop: 6 }}>Materiali insufficienti nell'inventario di {player?.short}.</div>}
            </div>
          )}

          {/* Creazione */}
          <button className="btn btn-primary" disabled={!ready}
            style={{ width: '100%', fontSize: 12, marginBottom: 10, opacity: ready ? 1 : 0.45,
              borderColor: 'var(--ember)', color: ready ? undefined : 'var(--gray-purple)' }}
            onClick={forge}>
            {alreadyApplied ? 'Potenziamento già applicato' : (item && !freeSlot ? 'Nessuno slot di potenziamento libero' : 'Creazione')}
          </button>

          {/* Lavoro compiuto: l'oggetto esce dall'incudine ancora caldo */}
          {done && (
            <div className="card" style={{ borderColor: 'var(--ember)', textAlign: 'center', padding: '14px 12px',
              background: 'linear-gradient(180deg, rgba(198,110,42,.12), transparent)' }}>
              <div style={{ width: 96, height: 96, margin: '0 auto 8px', borderRadius: 12, overflow: 'hidden',
                border: '2px solid var(--ember)', boxShadow: '0 0 26px rgba(216,140,60,.75), inset 0 0 18px rgba(216,140,60,.35)' }}>
                <ImageSlot slotId={'item-' + done.itemId} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder={done.itemName.slice(0, 2)} alt={done.itemName} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ember)' }}>{done.itemName}</div>
              <div className="small" style={{ color: 'var(--gold-light)', marginTop: 2 }}>⚒ {done.upgName}</div>
              <div className="small muted" style={{ marginTop: 4, fontStyle: 'italic' }}>Il martello ha parlato.</div>
            </div>
          )}

          {/* Catalogo dei lavori — solo DM, con redazione */}
          {s.dmMode && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="label" style={{ marginBottom: 6 }}>Catalogo della fucina (DM) · {SMITH_CATS.find(c => c.k === cat)?.l}</div>
              {inCat.map(u => {
                const editing = editId === u.id;
                const ms = u.materials && u.materials.length ? u.materials : reqMats(u);
                const setMat = (i: number, p: Partial<SmithMaterial>) => {
                  const next = [...ms]; next[i] = { ...next[i], ...p };
                  patchUpg(u.id, { materials: next.filter(x => x.name && x.name.trim()), material: undefined });
                };
                return (
                  <div key={u.id} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <span className="small grow" style={{ cursor: 'pointer' }} onClick={() => setEditId(editing ? null : u.id)}>
                        {editing ? '▾' : '▸'} {u.name}
                        {ms.length > 0 && <span className="muted"> · {ms.map(m => m.qty > 1 ? `${m.name} ×${m.qty}` : m.name).join(', ')}</span>}
                      </span>
                      <button className="btn btn-danger btn-ghost" style={{ padding: '0 6px', fontSize: 10 }}
                        onClick={() => { if (confirm('Rimuovere "' + u.name + '" dal catalogo?')) setUpgrades(upgrades.filter(x => x.id !== u.id)); }}>&times;</button>
                    </div>
                    {editing && (
                      <div style={{ padding: '6px 0 8px' }}>
                        <input value={u.name} onChange={e => patchUpg(u.id, { name: e.target.value })}
                          style={{ fontSize: 12, width: '100%', marginBottom: 4 }} />
                        <div className="row" style={{ gap: 4, marginBottom: 4 }}>
                          {SMITH_CATS.map(c => (
                            <button key={c.k} className="pill" style={{ cursor: 'pointer', padding: '3px 9px', fontSize: 8, flex: 1,
                              color: catOf(u) === c.k ? c.c : 'var(--gray-purple-deep)', borderColor: catOf(u) === c.k ? c.c : 'var(--border)' }}
                              onClick={() => patchUpg(u.id, { cat: c.k })}>{c.l}</button>
                          ))}
                        </div>
                        <textarea value={u.desc} placeholder="Effetto testuale (comparirà sull'oggetto)…"
                          onChange={e => patchUpg(u.id, { desc: e.target.value })}
                          style={{ minHeight: 44, fontSize: 12, width: '100%', marginBottom: 4 }} />
                        <div className="label" style={{ fontSize: 8, marginBottom: 3 }}>Materiali (fino a tre)</div>
                        {[0, 1, 2].map(i => (
                          <div key={i} className="row" style={{ gap: 4, marginBottom: 3 }}>
                            <input value={ms[i]?.name || ''} placeholder={`Materiale ${i + 1} (nome esatto)`}
                              onChange={e => {
                                const next = [...ms];
                                while (next.length <= i) next.push({ name: '', qty: 1 });
                                next[i] = { ...next[i], name: e.target.value };
                                patchUpg(u.id, { materials: next.filter(x => x.name && x.name.trim()), material: undefined });
                              }}
                              style={{ flex: 1, fontSize: 11, padding: '3px 6px' }} />
                            <input type="number" min={1} value={ms[i]?.qty || 1} disabled={!ms[i]?.name}
                              onChange={e => setMat(i, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                              style={{ width: 46, textAlign: 'center', fontSize: 11, padding: '3px 4px' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                <input value={draftName} placeholder="Nuovo lavoro (es. Potenzia il taglio)" onChange={e => setDraftName(e.target.value)} style={{ fontSize: 12, flex: '1 1 100%' }} />
                <textarea value={draftDesc} placeholder="Effetto testuale…" onChange={e => setDraftDesc(e.target.value)} style={{ minHeight: 38, fontSize: 12, flex: '1 1 100%' }} />
                <button className="btn" style={{ fontSize: 10, width: '100%' }}
                  onClick={() => {
                    if (!draftName.trim()) return;
                    const id = uid('sm');
                    setUpgrades([...upgrades, { id, name: draftName.trim(), desc: draftDesc.trim(), cat, materials: [] }]);
                    setDraftName(''); setDraftDesc(''); setEditId(id);
                  }}>Aggiungi al catalogo «{SMITH_CATS.find(c => c.k === cat)?.l}»</button>
              </div>
            </div>
          )}

          {/* Sfondo — solo DM */}
          {s.dmMode && (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div className="label" style={{ fontSize: 9 }}>Sfondo</div>
              <label className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10, cursor: 'pointer', color: 'var(--ember)', borderColor: 'var(--ember)' }} title="Immagine della fucina (chiuso e aperto)">
                📷 Carica sfondo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file || !campaignId) return;
                  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
                  const folder = campaignId;
                  const slotId = 'forge-bg';
                  try {
                    const { data: ex } = await supabase.storage.from('campaign-images').list(folder, { search: slotId });
                    const rm = (ex || []).filter((f: any) => f.name.startsWith(slotId + '.')).map((f: any) => `${folder}/${f.name}`);
                    if (rm.length) await supabase.storage.from('campaign-images').remove(rm);
                    const vName = `${slotId}.${Date.now().toString(36)}.${ext}`;
                    await supabase.storage.from('campaign-images').upload(`${folder}/${vName}`, file, { upsert: true, cacheControl: '31536000', contentType: file.type });
                    await registerStorageFile(campaignId, vName);
                    window.location.reload();
                  } catch (err: any) { alert('Errore: ' + (err.message || err)); }
                  e.target.value = '';
                }} />
              </label>
              <span className="small muted">Un'unica immagine per il box chiuso e aperto.</span>
            </div>
          )}
          </>}
        </div>
    </div>
  );
}
