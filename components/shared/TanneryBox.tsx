'use client';
import { useState } from 'react';
import { CampaignState, uid } from '@/lib/types';
import { U } from '@/components/shared/common';
import { ImageSlot } from '@/components/ImageSlot';
import { PanelBox, WorkBench, BenchEmpty } from '@/components/shared/PanelBox';
import { CraftJob, TanneryRecipe, tanneryRecipesOf, jobsOf, jobProgress, shopBusy, withJob, withoutJob } from '@/lib/dnd/crafting';
import { absDay } from '@/lib/dnd/calendar';
import { sfxComplete } from '@/lib/dnd/sounds';

// ─── CONCERIA DI MEZZALUNA ───────────────────────────────────
// Trasforma un materiale in un altro: la pelliccia in cuoio, e qualunque
// altra conversione il DM registri nel catalogo. Il banco mostra a sinistra
// ciò che entra e a destra ciò che uscirà; la freccia fra i due si riempie
// col passare dei giorni sul calendario.
//
// La materia prima viene prelevata all'avvio, non alla consegna: chi ha
// affidato le pelli non le ha più, e non può rivenderle mentre sono a bagno.

const TAN_COLOR = 'var(--gold-light)';

export function TanneryBox({ s, update, campaignId }: { s: CampaignState; update: U; campaignId: string | null }) {
  const [playerId, setPlayerId] = useState<string>(s.activePlayer || s.players[0]?.id || '');
  const [recipeId, setRecipeId] = useState<string>('');
  const [editId, setEditId] = useState<string | null>(null);

  const recipes: TanneryRecipe[] = tanneryRecipesOf(s);
  const setRecipes = (list: TanneryRecipe[]) => update({ tanneryRecipes: list } as any);
  const patchRec = (id: string, p: Partial<TanneryRecipe>) => setRecipes(recipes.map(r => r.id === id ? { ...r, ...p } : r));

  const player = s.players.find(pl => pl.id === playerId);
  const recipe = recipes.find(r => r.id === recipeId);
  const today = s.calendar?.date;

  const jobs = jobsOf(s, 'tannery');
  const myJob = jobs.find(j => j.playerId === playerId) || null;
  const blocking = shopBusy(s, 'tannery', playerId);
  const blockedByOther = !!blocking && blocking.playerId !== playerId;

  // Illustrazione di un materiale: si cerca fra gli inventari e in armeria
  const findIllus = (name: string): any => {
    for (const pl of s.players) {
      const f = (pl.inventory || []).find((it: any) => it.name === name);
      if (f) return f;
    }
    return ((s as any).armory || []).find((a: any) => a.name === name) || null;
  };

  const have = recipe ? (player?.inventory.find(it => it.name === recipe.fromName)?.qty || 0) : 0;
  const enough = !!recipe && have >= recipe.fromQty;
  const canStart = !!player && !!recipe && enough && !myJob && !blockedByOther && !!today;

  const start = () => {
    if (!canStart || !player || !recipe || !today) return;
    update(prev => {
      const players = prev.players.map(pl => {
        if (pl.id !== player.id) return pl;
        const inventory = pl.inventory
          .map((it: any) => it.name === recipe.fromName ? { ...it, qty: (it.qty || 0) - recipe.fromQty } : it)
          .filter((it: any) => !(it.name === recipe.fromName && (it.qty || 0) <= 0));
        return { ...pl, inventory };
      });
      const job: CraftJob = {
        id: uid('job'), kind: 'tannery', playerId: player.id,
        startAbs: absDay(today), days: Math.max(1, recipe.days),
        recipeId: recipe.id, fromName: recipe.fromName, fromQty: recipe.fromQty,
        toName: recipe.toName, toQty: recipe.toQty,
      };
      return { players, ...withJob(prev, job) } as any;
    });
    setRecipeId('');
  };

  const collect = (job: CraftJob) => {
    update(prev => {
      const players = prev.players.map(pl => {
        if (pl.id !== job.playerId) return pl;
        const existing = pl.inventory.find((it: any) => it.name === job.toName);
        const inventory = existing
          ? pl.inventory.map((it: any) => it.name === job.toName ? { ...it, qty: (it.qty || 0) + (job.toQty || 1) } : it)
          : [...pl.inventory, { id: uid('i'), name: job.toName!, qty: job.toQty || 1, type: 'altro', revealed: true } as any];
        return { ...pl, inventory };
      });
      return { players, ...withoutJob(prev, job.id) } as any;
    });
    sfxComplete();
  };

  const cancel = (job: CraftJob) => {
    if (!confirm('Ritirare le pelli e annullare la lavorazione? Il materiale torna com\'era.')) return;
    update(prev => {
      const players = prev.players.map(pl => {
        if (pl.id !== job.playerId) return pl;
        const existing = pl.inventory.find((it: any) => it.name === job.fromName);
        const inventory = existing
          ? pl.inventory.map((it: any) => it.name === job.fromName ? { ...it, qty: (it.qty || 0) + (job.fromQty || 1) } : it)
          : [...pl.inventory, { id: uid('i'), name: job.fromName!, qty: job.fromQty || 1, type: 'altro', revealed: true } as any];
        return { ...pl, inventory };
      });
      return { players, ...withoutJob(prev, job.id) } as any;
    });
  };

  // Ciò che il banco mostra: la commessa in corso, o l'anteprima della scelta
  const shown = myJob || (recipe ? {
    fromName: recipe.fromName, fromQty: recipe.fromQty, toName: recipe.toName, toQty: recipe.toQty, days: recipe.days,
  } as any : null);
  const prog = myJob ? jobProgress(myJob, today) : null;

  const cell = (name?: string, qty?: number, dim?: boolean) => {
    if (!name) return <BenchEmpty mark="?" />;
    const illus = findIllus(name);
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', opacity: dim ? .45 : 1, filter: dim ? 'grayscale(.7)' : 'none' }}>
        {illus
          ? <ImageSlot slotId={'item-' + illus.id} campaignId={campaignId} shape="rect" width="100%" height="100%" dmMode={false} placeholder={name.slice(0, 2)} alt={name} />
          : <BenchEmpty mark={name.slice(0, 2).toUpperCase()} />}
        <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}>×{qty ?? 1}</span>
      </div>
    );
  };

  return (
    <PanelBox title="Conceria di Mezzaluna" color={TAN_COLOR} bgSlot="tannery-bg" campaignId={campaignId} dmMode={s.dmMode}
      badge={jobs.length > 0 ? <span className="pill" style={{ padding: '2px 8px', fontSize: 8.5, color: TAN_COLOR, borderColor: TAN_COLOR }}>{jobs.length} in lavorazione</span> : undefined}
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TAN_COLOR} strokeWidth="1.5"><path d="M4 7l4-3 4 2 4-2 4 3-3 3v9a1 1 0 01-1 1H8a1 1 0 01-1-1v-9L4 7z"/></svg>}>

      {/* 1 — Chi porta le pelli */}
      <div className="card">
        <div className="label" style={{ marginBottom: 6 }}>1 · Avventuriero</div>
        <div className="row" style={{ gap: 6 }}>
          {s.players.map(pl => (
            <button key={pl.id} onClick={() => { setPlayerId(pl.id); setRecipeId(''); }}
              style={{ flex: 1, padding: 4, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: '2px solid ' + (playerId === pl.id ? (pl.color || TAN_COLOR) : 'var(--border)'),
                background: playerId === pl.id ? 'var(--bg-active)' : 'transparent', transition: 'all .15s' }}>
              <div style={{ width: 40, height: 40, margin: '0 auto 3px', position: 'relative' }}>
                <ImageSlot slotId={'portrait-' + pl.id} campaignId={campaignId} shape="circle" width={40} height={40} placeholder={(pl.short || pl.name).slice(0, 2)} alt={pl.name} />
                {jobs.some(j => j.playerId === pl.id) && (
                  <span style={{ position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: '50%', background: TAN_COLOR, border: '2px solid var(--bg-card)' }} />
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '.5px', color: playerId === pl.id ? 'var(--text)' : 'var(--gray-purple)' }}>{pl.short || pl.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2 — Il banco */}
      <div className="card">
        <div className="label" style={{ marginBottom: 6 }}>2 · Banco di concia</div>
        {!myJob && (
          <select value={recipeId} onChange={e => setRecipeId(e.target.value)} style={{ fontSize: 13, marginBottom: 8, width: '100%' }}>
            <option value="">— scegli la lavorazione —</option>
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.fromName} ×{r.fromQty} → {r.toName} ×{r.toQty} · {r.days} gg</option>
            ))}
          </select>
        )}

        <WorkBench accent={TAN_COLOR} pct={prog?.pct ?? 0} done={!!prog?.done}
          label={myJob
            ? (prog?.done ? 'pronto al ritiro' : `${prog?.elapsed}/${myJob.days} giorni · ne mancano ${prog?.remaining}`)
            : (recipe ? `${recipe.days} giorni di lavoro` : 'nessuna lavorazione scelta')}
          left={cell(shown?.fromName, shown?.fromQty)}
          right={cell(shown?.toName, shown?.toQty, !prog?.done)} />

        {recipe?.note && !myJob && (
          <div className="small muted" style={{ fontStyle: 'italic', fontSize: 10.5, marginBottom: 6 }}>{recipe.note}</div>
        )}

        {/* Stato e comandi */}
        {myJob ? (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {prog?.done
              ? <button className="btn btn-primary" style={{ flex: 1, fontSize: 12, borderColor: 'var(--green)' }} onClick={() => collect(myJob)}>Ritira il lavoro</button>
              : <div className="small" style={{ flex: 1, color: TAN_COLOR }}>Le pelli sono a bagno: ancora {prog?.remaining} {prog?.remaining === 1 ? 'giorno' : 'giorni'}.</div>}
            <button className="btn btn-danger btn-ghost" style={{ fontSize: 9, padding: '3px 9px' }} onClick={() => cancel(myJob)}>Annulla</button>
          </div>
        ) : (
          <>
            <button className="btn btn-primary" disabled={!canStart}
              style={{ width: '100%', fontSize: 12, opacity: canStart ? 1 : .45, borderColor: TAN_COLOR }}
              onClick={start}>
              {blockedByOther ? 'Bottega occupata' : !recipe ? 'Scegli una lavorazione' : !enough ? `Serve ${recipe.fromName} ×${recipe.fromQty} (ne hai ${have})` : !today ? 'Serve il calendario' : 'Affida il lavoro'}
            </button>
            {blockedByOther && (
              <div className="small muted" style={{ fontSize: 10, marginTop: 6, fontStyle: 'italic' }}>
                Mezzaluna sta già lavorando per {s.players.find(pl => pl.id === blocking!.playerId)?.short || 'un altro'}. Si può cambiare in «uno per personaggio» dalle impostazioni del DM, in fondo alla Fucina.
              </div>
            )}
          </>
        )}
      </div>

      {/* Commesse altrui, perché la coda sia leggibile a tutti */}
      {jobs.filter(j => j.playerId !== playerId).length > 0 && (
        <div className="card">
          <div className="label" style={{ marginBottom: 6 }}>In lavorazione</div>
          {jobs.filter(j => j.playerId !== playerId).map(j => {
            const pr = jobProgress(j, today);
            const who = s.players.find(pl => pl.id === j.playerId);
            return (
              <div key={j.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '3px 0' }}>
                <span className="small" style={{ color: who?.color || 'var(--gray-purple)' }}>{who?.short || '—'}</span>
                <span className="small muted" style={{ fontSize: 10 }}>{j.fromName} → {j.toName}</span>
                <div className="grow" style={{ height: 5, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ height: '100%', width: pr.pct + '%', background: pr.done ? 'var(--green)' : TAN_COLOR }} />
                </div>
                <span className="small muted" style={{ fontSize: 9 }}>{pr.done ? 'pronto' : pr.remaining + ' gg'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Catalogo — solo DM */}
      {s.dmMode && (
        <div className="card">
          <div className="label" style={{ marginBottom: 6 }}>Catalogo della conceria (DM)</div>
          {recipes.map(r => (
            <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="small grow" style={{ cursor: 'pointer' }} onClick={() => setEditId(editId === r.id ? null : r.id)}>
                  {editId === r.id ? '▾' : '▸'} {r.fromName} ×{r.fromQty} → {r.toName} ×{r.toQty}
                  <span className="muted"> · {r.days} gg</span>
                </span>
                <button className="btn btn-danger btn-ghost" style={{ padding: '0 6px', fontSize: 10 }}
                  onClick={() => { if (confirm('Rimuovere questa lavorazione?')) setRecipes(recipes.filter(x => x.id !== r.id)); }}>&times;</button>
              </div>
              {editId === r.id && (
                <div style={{ padding: '6px 0 8px' }}>
                  <div className="row" style={{ gap: 4, marginBottom: 4, alignItems: 'center' }}>
                    <input value={r.fromName} placeholder="Materiale in entrata" onChange={e => patchRec(r.id, { fromName: e.target.value })} style={{ flex: 1, fontSize: 11, padding: '3px 6px' }} />
                    <input type="number" min={1} value={r.fromQty} onChange={e => patchRec(r.id, { fromQty: Math.max(1, parseInt(e.target.value) || 1) })} style={{ width: 46, textAlign: 'center', fontSize: 11, padding: '3px 4px' }} />
                    <span style={{ color: TAN_COLOR }}>→</span>
                    <input value={r.toName} placeholder="Prodotto" onChange={e => patchRec(r.id, { toName: e.target.value })} style={{ flex: 1, fontSize: 11, padding: '3px 6px' }} />
                    <input type="number" min={1} value={r.toQty} onChange={e => patchRec(r.id, { toQty: Math.max(1, parseInt(e.target.value) || 1) })} style={{ width: 46, textAlign: 'center', fontSize: 11, padding: '3px 4px' }} />
                  </div>
                  <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span className="label" style={{ fontSize: 8 }}>Giornate</span>
                    <input type="number" min={1} value={r.days} onChange={e => patchRec(r.id, { days: Math.max(1, parseInt(e.target.value) || 1) })} style={{ width: 56, textAlign: 'center', fontSize: 11, padding: '3px 4px' }} />
                  </div>
                  <textarea value={r.note || ''} placeholder="Nota di colore, mostrata al giocatore…" onChange={e => patchRec(r.id, { note: e.target.value })} style={{ width: '100%', fontSize: 11, padding: '4px 6px', minHeight: 34 }} />
                </div>
              )}
            </div>
          ))}
          <button className="btn" style={{ fontSize: 10, width: '100%', marginTop: 6 }}
            onClick={() => { const id = uid('tan'); setRecipes([...recipes, { id, fromName: '', fromQty: 1, toName: '', toQty: 1, days: 1 }]); setEditId(id); }}>
            + lavorazione
          </button>
        </div>
      )}
    </PanelBox>
  );
}
