'use client';
import { useState } from 'react';
import { CampaignState } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { ImageSlot, registerStorageFile } from '@/components/ImageSlot';
import { ItemDetailBody, itemViewProps } from '@/components/shared/ItemDetail';
import { lookupByName, priceOf, goldOf, paysGold, itemFromArmory, cloneImage, normName, GOLD_NAME } from '@/lib/dnd/catalog';
import { U } from '@/components/shared/common';
import { isMarketDay, formatDateShort } from '@/lib/dnd/calendar';
import { DEFAULT_STALLS, DEFAULT_RUMORS, MARKET_LEVELS, MarketStall, MarketRumor, marketLevelFromBuilding, rollMarket, drawItems, drawGoods, MarketGood, DrawnGood, DEFAULT_MAX_SHOWN, resalePct, resaleValue, RESALE_BASE } from '@/lib/dnd/market';
import { ITEM_TYPES } from '@/components/shared/common';
import { rollDice } from '@/components/shared/DiceOverlay';

// ─── MERCATO DI OLMOBIANCO ───────────────────────────────────
// Box ripiegabile sul modello della Fucina. Sempre visibile al DM;
// ai giocatori compare solo nel giorno di mercato (6º giorno della
// settimana velmorana) e solo se la Piazza ha raggiunto il Livello 2.
// Il mercato tirato è condiviso via Supabase (chiave 'market') e resta
// valido finché il dateKey coincide con la data del calendario.

const NATURE_COLORS: Record<string, string> = {
  'Vera': 'var(--green)', 'Colore': 'var(--gray-purple)', 'Inquietante': 'var(--blue)',
};
const natureColor = (n: string) => NATURE_COLORS[n] || (n.startsWith('Vera') ? 'var(--green)' : 'var(--gray-purple)');

export function MarketBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  // Merce aperta in scheda. Le voci delle bancarelle sono testo scritto dal
  // DM: dove quel testo coincide con una voce d'armeria — la dispensa
  // canonica — la merce diventa un oggetto vero, con immagine, effetto e
  // descrizione. Dove non coincide, e «Armi semplici» è una categoria e non
  // un oggetto, resta testo semplice come prima.
  const [detailName, setDetailName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Scelta delle merci: quale bancarella sta pescando, con ricerca e filtro.
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [pickQ, setPickQ] = useState('');
  const [pickType, setPickType] = useState('');
  // Chi compra: di norma il personaggio attivo sul dispositivo, ma il DM
  // deve poter acquistare per conto di chiunque.
  const [buyerId, setBuyerId] = useState<string>('');
  const [sellAt, setSellAt] = useState<string | null>(null);        // banco aperto alla rivendita
  const [sellDone, setSellDone] = useState<{ name: string; roll: number; pct: number; gain: number } | null>(null);
  const [bgTick, setBgTick] = useState(0);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showRumors, setShowRumors] = useState(false);

  const cal = s.calendar;
  const d = cal?.date;
  const dateKey = d ? `${d.day}/${d.month}/${d.year}` : '';
  const marketToday = !!d && isMarketDay(d);

  const buildings: any[] = (s as any).buildings || [];
  const plaza = buildings.find((b: any) => b.id === s.marketBuildingId);
  const mktLevel = plaza ? marketLevelFromBuilding(plaza.level || 0) : 0;

  const stalls: MarketStall[] = (s.marketStalls && s.marketStalls.length) ? s.marketStalls : DEFAULT_STALLS;
  const rumors: MarketRumor[] = (s.marketRumors && s.marketRumors.length) ? s.marketRumors : DEFAULT_RUMORS;
  const market = s.market && s.market.dateKey === dateKey ? s.market : null;

  // Visibilità giocatori: solo giorno di mercato, con mercato attivo (Piazza ≥ L2)
  if (!s.dmMode && (!marketToday || mktLevel === 0)) return null;

  // Copy-on-write: la prima modifica al catalogo materializza i default nello stato
  const setStalls = (next: MarketStall[]) => update({ marketStalls: next } as any);

  // ── Acquisto ──────────────────────────────────────────────
  // Il denaro è l'oggetto «Monete d'oro» nello zaino, non un contatore:
  // comprare scala quella pila. Se non basta, il pulsante resta spento —
  // il controllo sta in `paysGold`, che restituisce null invece di
  // permettere una spesa impossibile.
  const buyer = s.players.find(pl => pl.id === (buyerId || s.activePlayer)) || s.players[0];

  /** Trova la merce esposta oggi, per sapere prezzo e scorta residua. */
  const drawnOf = (name: string): { stallId: string; good: DrawnGood } | null => {
    for (const ms of (market?.stalls || [])) {
      const g = (ms.goods || []).find(x => normName(x.name) === normName(name));
      if (g) return { stallId: ms.stallId, good: g };
    }
    return null;
  };

  const buy = (name: string) => {
    const d = drawnOf(name);
    const price = d?.good.price ?? priceOf(s, name);
    if (!buyer || !price || !d || d.good.qty <= 0 || !market) return;
    const paid = paysGold(buyer, price);
    if (!paid) return;
    const built = itemFromArmory(s, name, 1);
    const already = paid.some((it: any) => normName(it.name) === normName(name));
    update(prev => ({
      players: prev.players.map(pl => {
        if (pl.id !== buyer.id) return pl;
        const inv = already
          ? paid.map((it: any) => normName(it.name) === normName(name) ? { ...it, qty: (it.qty || 0) + 1 } : it)
          : [...paid, built.item];
        return { ...pl, inventory: inv };
      }),
      // La scorta del banco cala: comprato l'ultimo esemplare, la merce
      // sparisce dal banco fino al prossimo giorno di mercato.
      market: { ...market, stalls: market.stalls.map(ms => ms.stallId === d.stallId
        ? { ...ms, goods: (ms.goods || []).map(x => normName(x.name) === normName(name) ? { ...x, qty: x.qty - 1 } : x).filter(x => x.qty > 0) }
        : ms) },
    } as any));
    if (!already) cloneImage(campaignId, built.sourceId, built.item.id);
  };

  /** Oggetti del personaggio che questo banco ritira. */
  const sellables = (st: MarketStall) => {
    const kinds = st.buys || [];
    if (!kinds.length || !buyer) return [];
    return (buyer.inventory || []).filter((it: any) =>
      kinds.includes(it.type) && (it.qty ?? 1) > 0 && priceOf(s, it.name) && !it.equipped);
  };

  /**
   * Rivendita: si tira il dado davanti a tutti, la percentuale esce dal
   * tiro e dal carisma, l'oggetto lascia lo zaino e l'oro vi entra.
   */
  const sell = (it: any) => {
    if (!buyer) return;
    const price = priceOf(s, it.name);
    if (!price) return;
    const cha = Math.floor((((buyer as any).abilities?.cha ?? 10) - 10) / 2);
    const roll = rollDice(20, 'Contrattazione · ' + it.name);
    const gain = resaleValue(price, roll, cha);
    update(prev => ({
      players: prev.players.map(pl => {
        if (pl.id !== buyer.id) return pl;
        let inv = (pl.inventory || [])
          .map((x: any) => x.id === it.id ? { ...x, qty: (x.qty ?? 1) - 1 } : x)
          .filter((x: any) => !(x.id === it.id && (x.qty ?? 0) <= 0));
        const coin = inv.find((x: any) => normName(x.name) === normName(GOLD_NAME));
        inv = coin
          ? inv.map((x: any) => x.id === coin.id ? { ...x, qty: (x.qty || 0) + gain } : x)
          : [...inv, { id: 'g' + Math.random().toString(36).slice(2, 9), name: GOLD_NAME, type: 'tesoro', qty: gain, revealed: true }];
        return { ...pl, inventory: inv };
      }),
    } as any));
    setSellDone({ name: it.name, roll, pct: resalePct(roll, cha), gain });
  };

  const renderBuy = (name: string) => {
    const d = drawnOf(name);
    const price = d?.good.price ?? priceOf(s, name);
    if (!price) return (
      <div className="small muted" style={{ fontSize: 10.5, marginTop: 10, fontStyle: 'italic' }}>
        Prezzo non dichiarato: va contrattato al banco.
      </div>
    );
    const gold = goldOf(buyer);
    const stock = d?.good.qty ?? 0;
    const can = !!buyer && gold >= price && stock > 0;
    return (
      <div className="card" style={{ marginTop: 10, padding: '9px 10px', borderColor: 'var(--gold-dim)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap' }}>
          <span className="label" style={{ fontSize: 8 }}>Prezzo</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--gold)' }}>{price}</span>
          <span className="small muted" style={{ fontSize: 10 }}>mo</span>
          <div className="grow" />
          {stock > 0
            ? <span className="small muted" style={{ fontSize: 10 }}>{stock} al banco</span>
            : <span className="small" style={{ fontSize: 10, color: 'var(--red)' }}>esaurito</span>}
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={buyer?.id || ''} onChange={e => setBuyerId(e.target.value)}
            style={{ fontSize: 11, padding: '3px 6px', flex: '1 1 110px' }}>
            {s.players.map(pl => <option key={pl.id} value={pl.id}>{pl.short || pl.name}</option>)}
          </select>
          <span className="small" style={{ fontSize: 10.5, color: gold >= price ? 'var(--gold-light)' : 'var(--red)' }}>
            {gold} mo in borsa
          </span>
          <button className="btn btn-primary" disabled={!can} style={{ fontSize: 11, padding: '4px 14px', opacity: can ? 1 : .45 }}
            onClick={() => buy(name)}>
            {stock <= 0 ? 'Esaurito' : gold < price ? 'Oro insufficiente' : 'Compra'}
          </button>
        </div>
      </div>
    );
  };

  const armory: any[] = ((s as any).armory || []);
  const ARMORY_TYPES = Array.from(new Set(armory.map(e => e.type))).sort();
  const pickResults = armory
    .filter(e => (!pickType || e.type === pickType)
      && (!pickQ.trim() || (e.name || '').toLowerCase().includes(pickQ.trim().toLowerCase())))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const setRumors = (next: MarketRumor[]) => update({ marketRumors: next } as any);

  const doRoll = () => {
    if (mktLevel === 0 || !dateKey) return;
    update({ market: rollMarket(mktLevel as 1 | 2 | 3, stalls, dateKey) } as any);
  };
  const rerollStallItems = (stallId: string) => {
    const st = stalls.find(x => x.id === stallId); if (!st || !market) return;
    update({ market: { ...market, stalls: market.stalls.map(ms => ms.stallId === stallId ? { ...ms, items: drawItems(st), goods: drawGoods(st) } : ms) } } as any);
  };
  const rollRumor = () => {
    if (!market) return;
    update({ market: { ...market, rumorRoll: Math.floor(Math.random() * 100) + 1 } } as any);
  };

  // Upload immagine su uno slot arbitrario, con il pattern collaudato (reload)
  const uploadTo = async (slotId: string, file: File) => {
    if (!campaignId) return;
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    try {
      const { data: ex } = await supabase.storage.from('campaign-images').list(campaignId, { search: slotId });
      const rm = (ex || []).filter((f: any) => f.name.startsWith(slotId + '.')).map((f: any) => `${campaignId}/${f.name}`);
      if (rm.length) await supabase.storage.from('campaign-images').remove(rm);
      const vName = `${slotId}.${Date.now().toString(36)}.${ext}`;
      await supabase.storage.from('campaign-images').upload(`${campaignId}/${vName}`, file, { upsert: true, cacheControl: '31536000', contentType: file.type });
      await registerStorageFile(campaignId, vName);
      window.location.reload();
    } catch (err: any) { alert('Errore: ' + (err.message || err)); }
  };

  const cfg = mktLevel > 0 ? MARKET_LEVELS[mktLevel] : null;

  return (
    <div className="frame" style={{ position: 'relative', overflow: 'hidden', borderColor: 'var(--gold)', padding: 0, minHeight: open ? undefined : 76 }}>
      {/* Sfondo del box */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <ImageSlot key={(open ? 'o' : 'c') + bgTick} slotId="market-bg" campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="" alt="Mercato di Olmobianco" />
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: open
        ? 'linear-gradient(180deg, rgba(11,8,20,0) 0%, rgba(11,8,20,.3) 35%, rgba(11,8,20,.6) 60%, rgba(11,8,20,.9) 85%, rgba(11,8,20,.97) 100%)'
        : 'linear-gradient(90deg, rgba(11,8,20,.92) 0%, rgba(11,8,20,.45) 50%, rgba(11,8,20,0) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 2, padding: 16 }}>
        {/* Testata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
          <div className="grow" style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 8px rgba(0,0,0,.65)' }}>
            <div className="label" style={{ color: 'var(--gold)' }}>Mercato di Olmobianco</div>
            <div className="small" style={{ marginTop: 2, color: 'var(--text)' }}>
              {mktLevel > 0 ? cfg!.label : 'Piazza non ancora costruita — nessun mercato'}
              {d && <> · {formatDateShort(d)}{marketToday ? ' · giorno di mercato' : ''}</>}
            </div>
          </div>
          {s.dmMode && !marketToday && <span className="dm-badge">NON È GIORNO DI MERCATO</span>}
          <span style={{ fontSize: 14, color: 'var(--gold)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : '' }}>▾</span>
        </div>

        {open && (
          <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>

            {/* Controlli DM: edificio di riferimento, immagine box, tiro */}
            {s.dmMode && (
              <div className="card" style={{ marginBottom: 10 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="small muted">Edificio che governa il mercato:</span>
                  <select value={s.marketBuildingId || ''} onChange={e => update({ marketBuildingId: e.target.value } as any)} style={{ fontSize: 12 }}>
                    <option value="">— scegli —</option>
                    {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name} (L{b.level})</option>)}
                  </select>
                  <label className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 9, cursor: 'pointer' }} title="Immagine del box">
                    📷 box
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadTo('market-bg', f); e.target.value = ''; }} />
                  </label>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <button className="btn btn-primary" disabled={mktLevel === 0} onClick={doRoll}>
                    {market ? 'Ritira il mercato' : 'Tira le bancarelle'} ({cfg ? `${cfg.fixed}+1d4` : '—'})
                  </button>
                  {market && <span className="small muted">{market.count} bancarelle uscite</span>}
                  <div className="grow" />
                  <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => setShowCatalog(v => !v)}>{showCatalog ? 'Chiudi catalogo' : 'Catalogo bancarelle'}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => setShowRumors(v => !v)}>{showRumors ? 'Chiudi dicerie' : 'Tabella dicerie'}</button>
                </div>
              </div>
            )}

            {/* Bancarelle del giorno — card verticali stile alchimia */}
            {market ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {market.stalls.map(ms => {
                  const st = stalls.find(x => x.id === ms.stallId); if (!st) return null;
                  // Le merci legate all'armeria hanno la precedenza sulle
                  // stringhe della vecchia stesura, che restano come didascalie.
                  const drawnGoods: DrawnGood[] = (ms.goods ?? (st.goods ? drawGoods(st) : undefined)) ?? [];
                  const cap = Math.max(1, st.maxShown ?? DEFAULT_MAX_SHOWN);
                  const shownItems = (ms.items ?? st.items).slice(0, Math.max(0, cap - drawnGoods.length));
                  const isTales = st.kind === 'tales';
                  return (
                    <div key={ms.stallId} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ position: 'relative', aspectRatio: '1 / 1' }}>
                        <ImageSlot slotId={'stall-' + st.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder="🏪" alt={st.name} />
                        {s.dmMode && (
                          <label className="btn btn-ghost" style={{ position: 'absolute', top: 4, right: 4, padding: '1px 5px', fontSize: 9, cursor: 'pointer', background: 'rgba(11,8,20,.7)' }} title="Immagine bancarella">
                            📷
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadTo('stall-' + st.id, f); e.target.value = ''; }} />
                          </label>
                        )}
                      </div>
                      <div style={{ padding: '8px 10px', flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--gold-light)' }}>{st.name}</div>
                        <div className="small muted" style={{ marginTop: 3, fontStyle: 'italic' }}>{st.desc}</div>
                        {drawnGoods.length > 0 && (
                          <div style={{ margin: '7px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {drawnGoods.map((g, i) => {
                              const found = lookupByName(s, g.name);
                              return (
                                <button key={i} className="market-good" onClick={() => found && setDetailName(g.name)}
                                  title={found ? 'Esamina la merce' : 'Voce non presente in armeria'}
                                  style={{ cursor: found ? 'pointer' : 'default' }}>
                                  <span className="market-good-img">
                                    {found
                                      ? <ImageSlot slotId={'item-' + found.entry.id} campaignId={campaignId} shape="rect"
                                          width="100%" height="100%" dmMode={false}
                                          placeholder={g.name.slice(0, 2).toUpperCase()} alt={g.name} />
                                      : <span className="img-empty" style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{g.name.slice(0, 2).toUpperCase()}</span>}
                                  </span>
                                  <span className="grow" style={{ fontSize: 11, lineHeight: 1.3, textAlign: 'left', minWidth: 0 }}>
                                    {g.name}
                                    {(() => { const pr = g.price ?? priceOf(s, g.name); return pr
                                      ? <span className="small" style={{ display: 'block', fontSize: 9, color: 'var(--gold-light)' }}>{pr} mo</span> : null; })()}
                                  </span>
                                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--gold)', flexShrink: 0 }}>×{g.qty}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Rivendita: compare solo nei giorni di mercato e
                            solo se il banco ritira qualcosa che il
                            personaggio possiede. */}
                        {(st.buys || []).length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {sellAt === st.id ? (
                              <div className="card" style={{ padding: '8px 9px', borderColor: 'var(--gold-dim)' }}>
                                <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                                  <span className="label" style={{ fontSize: 8 }}>Rivendi</span>
                                  <select value={buyer?.id || ''} onChange={e => { setBuyerId(e.target.value); setSellDone(null); }}
                                    style={{ fontSize: 11, padding: '3px 6px', flex: '1 1 100px' }}>
                                    {s.players.map(pl => <option key={pl.id} value={pl.id}>{pl.short || pl.name}</option>)}
                                  </select>
                                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }}
                                    onClick={() => { setSellAt(null); setSellDone(null); }}>chiudi</button>
                                </div>
                                <div className="small muted" style={{ fontSize: 9.5, marginBottom: 6 }}>
                                  Il banco ritira: {(st.buys || []).join(', ')}. Offerta: {RESALE_BASE}% del listino, più il tiro e il modificatore di Carisma.
                                </div>
                                {sellDone && (
                                  <div className="card" style={{ padding: '6px 8px', marginBottom: 6, borderColor: 'var(--green)' }}>
                                    <span className="small" style={{ fontSize: 10.5, color: 'var(--green)' }}>
                                      {sellDone.name} venduto · d20 = {sellDone.roll} → {sellDone.pct}% → <b>{sellDone.gain} mo</b>
                                    </span>
                                  </div>
                                )}
                                {sellables(st).length === 0
                                  ? <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10 }}>
                                      Nessun oggetto con prezzo di listino, fra quelli che questo banco ritira.
                                    </div>
                                  : sellables(st).map((it: any) => {
                                    const pr = priceOf(s, it.name) || 0;
                                    return (
                                      <div key={it.id} className="row" style={{ gap: 7, alignItems: 'center', marginBottom: 4 }}>
                                        <span className="market-good-img" style={{ width: 26, height: 26 }}>
                                          <ImageSlot slotId={'item-' + it.id} campaignId={campaignId} shape="rect" width="100%" height="100%"
                                            dmMode={false} placeholder={it.name.slice(0, 2).toUpperCase()} alt={it.name} />
                                        </span>
                                        <span className="grow" style={{ fontSize: 11, minWidth: 0 }}>
                                          {it.name}{(it.qty ?? 1) > 1 ? ` ×${it.qty}` : ''}
                                          <span className="small muted" style={{ display: 'block', fontSize: 9 }}>listino {pr} mo</span>
                                        </span>
                                        <button className="btn" style={{ fontSize: 10, padding: '3px 10px', borderColor: 'var(--gold-dim)', color: 'var(--gold)' }}
                                          onClick={() => sell(it)}>rivendi</button>
                                      </div>
                                    );
                                  })}
                              </div>
                            ) : (
                              <button className="btn btn-ghost" style={{ fontSize: 10, borderColor: 'var(--gold-dim)', color: 'var(--gold)' }}
                                onClick={() => { setSellAt(st.id); setSellDone(null); }}>⇄ Rivendi a questo banco</button>
                            )}
                          </div>
                        )}

                        {shownItems.length > 0 && (
                          <div style={{ margin: '7px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {shownItems.map((it, i) => {
                              const found = lookupByName(s, it);
                              if (!found) return (
                                <div key={i} className="row" style={{ gap: 6, alignItems: 'center', paddingLeft: 2 }}>
                                  <span style={{ color: 'var(--gray-purple-deep)', fontSize: 9 }}>·</span>
                                  <span style={{ fontSize: 11, lineHeight: 1.4 }}>{it}</span>
                                </div>
                              );
                              return (
                                <button key={i} className="market-good" onClick={() => setDetailName(it)}
                                  title="Esamina la merce">
                                  <span className="market-good-img">
                                    <ImageSlot slotId={'item-' + found.entry.id} campaignId={campaignId} shape="rect"
                                      width="100%" height="100%" dmMode={false}
                                      placeholder={it.slice(0, 2).toUpperCase()} alt={it} />
                                  </span>
                                  <span className="grow" style={{ fontSize: 11, lineHeight: 1.3, textAlign: 'left', minWidth: 0 }}>{it}</span>
                                  <span style={{ fontSize: 9, color: 'var(--gold-dim)', flexShrink: 0 }}>esamina ▸</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {s.dmMode && st.randomize && (
                          <button className="btn btn-ghost" style={{ fontSize: 9, marginTop: 6 }} onClick={() => rerollStallItems(st.id)}>⟳ ripesca oggetti</button>
                        )}
                        {isTales && (
                          <div style={{ marginTop: 8 }}>
                            <button className="btn" style={{ fontSize: 10, color: 'var(--blue)', borderColor: 'var(--blue)' }} onClick={rollRumor}>Tira d100 dicerie</button>
                            {market.rumorRoll != null && (() => {
                              const r = rumors.find(x => market.rumorRoll! >= x.from && market.rumorRoll! <= x.to);
                              return r ? (
                                <div className="card" style={{ marginTop: 6, padding: '6px 8px', borderLeft: '3px solid var(--blue)' }}>
                                  <div className="small muted">d100: {market.rumorRoll}</div>
                                  <div style={{ fontSize: 11, marginTop: 2 }}>{r.text}</div>
                                  {s.dmMode && <div className="small" style={{ marginTop: 3, color: natureColor(r.nature) }}>{r.nature} — {r.dmNote}</div>}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card muted small" style={{ textAlign: 'center' }}>
                {mktLevel === 0 ? 'La Piazza non ha ancora un mercato.' : s.dmMode ? 'Nessun mercato tirato per oggi.' : 'Le bancarelle non sono ancora state disposte.'}
              </div>
            )}

            {/* Catalogo bancarelle — editing DM */}
            {s.dmMode && showCatalog && (
              <div style={{ marginTop: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>Catalogo bancarelle</div>
                {stalls.map(st => (
                  <div key={st.id} className="card" style={{ marginBottom: 6 }}>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <input value={st.name} style={{ fontWeight: 600, fontSize: 12, flex: 1 }}
                        onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, name: e.target.value } : x))} />
                      <span className="small muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {[1, 2, 3].map(l => st.ranges[l] ? `L${l}:${st.ranges[l]![0]}–${st.ranges[l]![1]}` : null).filter(Boolean).join(' · ')}
                      </span>
                      <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!st.randomize}
                          onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, randomize: e.target.checked } : x))} /> random
                      </label>
                      <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Quante merci al massimo si vedono su questo banco in una giornata">
                        max
                        <input type="number" min={1} max={20} value={st.maxShown ?? DEFAULT_MAX_SHOWN}
                          onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, maxShown: Math.max(1, Math.min(20, parseInt(e.target.value) || DEFAULT_MAX_SHOWN)) } : x))}
                          style={{ width: 42, textAlign: 'center', fontSize: 11, padding: '2px 3px' }} />
                      </label>
                    </div>
                    <textarea value={st.desc} style={{ fontSize: 11, marginTop: 4, minHeight: 26, width: '100%' }}
                      onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, desc: e.target.value } : x))} />
                    {/* Merci legate all'armeria: griglia di miniature, con
                        intervallo di quantità e probabilità di comparsa per
                        ciascuna. È questo che rende il banco diverso ogni
                        giorno di mercato senza riscrivere il catalogo. */}
                    <div className="label" style={{ fontSize: 8, margin: '7px 0 4px' }}>Ritira (rivendita)</div>
                    <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                      {ITEM_TYPES.map(ty => {
                        const on = (st.buys || []).includes(ty);
                        return (
                          <button key={ty} className="pill" style={{ padding: '2px 8px', fontSize: 8.5, cursor: 'pointer',
                            color: on ? 'var(--gold)' : 'var(--gray-purple-deep)',
                            borderColor: on ? 'var(--gold)' : 'var(--border)',
                            background: on ? 'var(--bg-active)' : 'transparent' }}
                            onClick={() => setStalls(stalls.map(x => x.id === st.id
                              ? { ...x, buys: on ? (x.buys || []).filter(k => k !== ty) : [...(x.buys || []), ty] } : x))}>
                            {ty}
                          </button>
                        );
                      })}
                    </div>

                    <div className="label" style={{ fontSize: 8, margin: '7px 0 4px' }}>Merci d'armeria</div>
                    {(st.goods || []).length === 0 && (
                      <div className="small muted" style={{ fontSize: 10, fontStyle: 'italic', marginBottom: 4 }}>
                        Nessuna merce agganciata. Scegline qui sotto: ogni voce compare con la sua probabilità e in quantità variabile.
                      </div>
                    )}
                    {(st.goods || []).map((g, gi) => {
                      const found = lookupByName(s, g.name);
                      const setGood = (patch: Partial<MarketGood>) => setStalls(stalls.map(x => x.id === st.id
                        ? { ...x, goods: (x.goods || []).map((y, j) => j === gi ? { ...y, ...patch } : y) } : x));
                      return (
                        <div key={gi} className="row" style={{ gap: 5, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                          <span className="market-good-img" style={{ width: 26, height: 26 }}>
                            {found && <ImageSlot slotId={'item-' + found.entry.id} campaignId={campaignId} shape="rect"
                              width="100%" height="100%" dmMode={false} placeholder={g.name.slice(0, 2).toUpperCase()} alt={g.name} />}
                          </span>
                          <span className="grow" style={{ fontSize: 11, minWidth: 70, color: found ? 'var(--text)' : 'var(--gray-purple-deep)' }}>
                            {g.name}{!found && ' (fuori armeria)'}
                          </span>
                          <span className="small muted" style={{ fontSize: 8 }}>q.tà</span>
                          <input type="number" min={1} value={g.min} title="Quantità minima"
                            onChange={e => setGood({ min: Math.max(1, parseInt(e.target.value) || 1) })}
                            style={{ width: 40, textAlign: 'center', fontSize: 11, padding: '2px 3px' }} />
                          <span className="small muted" style={{ fontSize: 9 }}>–</span>
                          <input type="number" min={1} value={g.max} title="Quantità massima"
                            onChange={e => setGood({ max: Math.max(1, parseInt(e.target.value) || 1) })}
                            style={{ width: 40, textAlign: 'center', fontSize: 11, padding: '2px 3px' }} />
                          <span className="small muted" style={{ fontSize: 8 }}>%</span>
                          <input type="number" min={1} max={100} value={g.chance} title="Probabilità di comparsa"
                            onChange={e => setGood({ chance: Math.max(1, Math.min(100, parseInt(e.target.value) || 100)) })}
                            style={{ width: 46, textAlign: 'center', fontSize: 11, padding: '2px 3px' }} />
                          <span className="small muted" style={{ fontSize: 8 }}>mo</span>
                          <input type="number" min={0} value={g.price ?? ''} placeholder={String(priceOf(s, g.name) ?? '—')}
                            title="Prezzo di questo banco; vuoto = prezzo di listino dell'armeria"
                            onChange={e => setGood({ price: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0) })}
                            style={{ width: 52, textAlign: 'center', fontSize: 11, padding: '2px 3px' }} />
                          <button className="btn btn-danger btn-ghost" style={{ padding: '0 6px', fontSize: 10 }}
                            onClick={() => setStalls(stalls.map(x => x.id === st.id ? { ...x, goods: (x.goods || []).filter((_, j) => j !== gi) } : x))}>&times;</button>
                        </div>
                      );
                    })}

                    {/* Aggiunta: ricerca e filtro sull'armeria, scelta per miniatura */}
                    {pickFor === st.id ? (
                      <div className="card" style={{ padding: '7px 8px', marginTop: 5 }}>
                        <div className="row" style={{ gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                          <input className="grow" value={pickQ} placeholder="Cerca in armeria…" autoFocus
                            onChange={e => setPickQ(e.target.value)} style={{ fontSize: 11, padding: '3px 7px', minWidth: 100 }} />
                          <select value={pickType} onChange={e => setPickType(e.target.value)} style={{ fontSize: 10, padding: '3px 5px' }}>
                            <option value="">tutte</option>
                            {ARMORY_TYPES.map(ty => <option key={ty} value={ty}>{ty}</option>)}
                          </select>
                          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => setPickFor(null)}>chiudi</button>
                        </div>
                        <div className="market-pick-grid">
                          {pickResults.slice(0, 48).map((e: any) => (
                            <button key={e.id} className="market-pick" title={e.name}
                              onClick={() => setStalls(stalls.map(x => x.id === st.id
                                ? { ...x, goods: [...(x.goods || []), { name: e.name, min: 1, max: 1, chance: 100 }] } : x))}>
                              <span className="market-pick-img">
                                <ImageSlot slotId={'item-' + e.id} campaignId={campaignId} shape="rect" width="100%" height="100%"
                                  dmMode={false} placeholder={e.name.slice(0, 2).toUpperCase()} alt={e.name} />
                              </span>
                              <span className="market-pick-name">{e.name}</span>
                            </button>
                          ))}
                          {pickResults.length === 0 && (
                            <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10 }}>Nessuna voce corrisponde.</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-ghost" style={{ fontSize: 10, marginTop: 5, borderColor: 'var(--gold-dim)', color: 'var(--gold)' }}
                        onClick={() => { setPickFor(st.id); setPickQ(''); setPickType(''); }}>+ merce dall'armeria</button>
                    )}

                    {/* Voci libere della vecchia stesura: didascalie, non oggetti */}
                    <div className="label" style={{ fontSize: 8, margin: '8px 0 3px' }}>Voci libere (didascalie)</div>
                    <textarea value={st.items.join('\n')} placeholder="Una per riga — testo che non corrisponde a un oggetto…" style={{ fontSize: 11, minHeight: 30, width: '100%' }}
                      onChange={e => setStalls(stalls.map(x => x.id === st.id ? { ...x, items: e.target.value.split('\n').filter(v => v.trim() !== '') } : x))} />
                  </div>
                ))}
              </div>
            )}

            {/* Tabella dicerie completa — stile meteo, riservata al DM */}
            {s.dmMode && showRumors && (
              <div style={{ marginTop: 12, fontSize: 12 }}>
                <div className="label" style={{ marginBottom: 6 }}>Dicerie della Marca (d100)</div>
                {rumors.map((r, i) => {
                  const isHit = market?.rumorRoll != null && market.rumorRoll >= r.from && market.rumorRoll <= r.to;
                  return (
                    <div key={i} className="card" style={{ padding: '8px 10px', marginBottom: 3,
                      borderLeft: isHit ? '3px solid var(--blue)' : '1px solid var(--border)',
                      background: isHit ? 'var(--bg-active)' : 'var(--bg-input)' }}>
                      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--gray-purple)', minWidth: 44 }}>
                          {r.from === r.to ? String(r.from).padStart(2, '0') : `${String(r.from).padStart(2, '0')}–${String(r.to).padStart(2, '0')}`}
                        </span>
                        <div className="grow">
                          <input value={r.text} style={{ fontSize: 11, width: '100%', background: 'transparent', border: 'none', padding: 0 }}
                            onChange={e => setRumors(rumors.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                          <div className="row" style={{ gap: 6, marginTop: 3 }}>
                            <input value={r.nature} style={{ fontSize: 10, width: 100, color: natureColor(r.nature) }}
                              onChange={e => setRumors(rumors.map((x, j) => j === i ? { ...x, nature: e.target.value } : x))} />
                            <input value={r.dmNote} style={{ fontSize: 10, flex: 1, fontStyle: 'italic' }}
                              onChange={e => setRumors(rumors.map((x, j) => j === i ? { ...x, dmNote: e.target.value } : x))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    {/* Scheda della merce: la stessa che il giocatore vedrebbe se l'oggetto
        fosse già suo, in sola lettura — nessun comando di quantità, usura,
        trasferimento o consumo, perché la merce non è ancora di nessuno. */}
    {detailName && (() => {
      const found = lookupByName(s, detailName);
      if (!found) return null;
      const e = found.entry;
      const shown = { ...e, qty: undefined };
      return (
        <div className="alchemy-overlay" onClick={ev => { if (ev.target === ev.currentTarget) setDetailName(null); }}>
          <div className="alchemy-popup sheet-popup" style={{ borderColor: 'var(--gold-dim)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                <span style={{ color: 'var(--gold)', fontSize: 14 }}>🏪</span>
                <div className="h2" style={{ fontSize: 15, color: 'var(--gold)', minWidth: 0 }}>{e.name}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setDetailName(null)} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
            </div>
            <ItemDetailBody item={shown} campaignId={campaignId} accent="var(--gold)" slotPrefix="market"
              {...itemViewProps(s, null, shown)} />
            {renderBuy(detailName)}
            <div className="small muted" style={{ fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
              {found.source === 'armory'
                ? "Scheda dal catalogo dell'armeria."
                : 'Scheda ricavata da un esemplare già in circolazione.'}
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  );
}
