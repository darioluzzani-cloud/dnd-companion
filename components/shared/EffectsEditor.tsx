'use client';
import { Aptitude, EffectKind, EFFECT_KINDS, SHOP_OF, SHOP_LABEL, activitiesOf, productsOf, kindOf, describeEffect } from '@/lib/dnd/village';

// ─── EDITOR DEGLI EFFETTI ────────────────────────────────────
// Bonus e malus di un PNG, uno per riga: dove deve lavorare perché valgano,
// che cosa cambiano, di quanto, e — dove serve — su quale oggetto o bottega.
// Il testo resta per il colore; ciò che conta per l'app è il tipo.
// Lo usano il catalogo dei forestieri e la scheda dei PNG.

const NEEDS_TARGET: Partial<Record<EffectKind, true>> = { yield: true, product: true, craft: true };

export function EffectsEditor({ s, list, onChange }: { s: any; list?: Aptitude[]; onChange: (next: Aptitude[]) => void }) {
  const fx = list || [];
  const acts = activitiesOf(s);
  const armory: any[] = ((s?.armory || []) as any[]).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const patch = (i: number, p: Partial<Aptitude>) => onChange(fx.map((a, k) => k === i ? { ...a, ...p } : a));
  const sel = { fontSize: 11, padding: '3px 4px' } as const;
  const num = { fontSize: 11, padding: '3px 4px', width: 54, textAlign: 'center' } as const;

  return (
    <div>
      {fx.map((a, i) => {
        const kind = kindOf(a);
        const meta = EFFECT_KINDS.find(k => k.k === kind);
        const act = acts.find(x => x.id === a.activityId);
        const prods = productsOf(act).map(p => armory.find(e => e.id === p.armoryId)).filter(Boolean);
        const d = describeEffect(s, a);
        return (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 7px', marginBottom: 5 }}>
            <div className="row" style={{ gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="small muted" style={{ fontSize: 9.5 }}>se tiene</span>
              <select value={a.activityId} onChange={e => patch(i, { activityId: e.target.value })} style={{ ...sel, flex: '0 1 118px' }} title="Attività che deve tenere perché l'effetto valga">
                {acts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                {!act && <option value={a.activityId}>(attività rimossa)</option>}
              </select>
              <select value={kind} onChange={e => patch(i, { kind: e.target.value as EffectKind, target: undefined, every: undefined })} style={{ ...sel, flex: '1 1 150px' }} title="Che cosa cambia">
                {EFFECT_KINDS.map(k => <option key={k.k} value={k.k}>{k.label}</option>)}
              </select>
              {kind !== 'note' && <>
                <input type="number" value={a.mod ?? 0} onChange={e => patch(i, { mod: parseInt(e.target.value) || 0 })} style={num}
                  title={kind === 'product' ? 'Quanti pezzi' : 'Positivo è un bonus, negativo un malus'} />
                <span className="small muted" style={{ fontSize: 9.5 }}>{meta?.unit}</span>
              </>}
              <button className="btn btn-danger btn-ghost" style={{ padding: '1px 7px', fontSize: 10, marginLeft: 'auto' }} onClick={() => onChange(fx.filter((_, k) => k !== i))}>&times;</button>
            </div>

            {NEEDS_TARGET[kind] && (
              <div className="row" style={{ gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 5 }}>
                {kind === 'yield' && (
                  <select value={a.target || ''} onChange={e => patch(i, { target: e.target.value || undefined })} style={{ ...sel, flex: '1 1 160px' }} title="Prodotto della bottega su cui contano i pezzi">
                    <option value="">sul primo prodotto della bottega</option>
                    {prods.map((e: any) => <option key={e.id} value={e.id}>su {e.name}</option>)}
                    {a.target && !prods.some((e: any) => e.id === a.target) && <option value={a.target}>(non più fra i prodotti: vale sul primo)</option>}
                  </select>
                )}
                {kind === 'product' && <>
                  <select value={a.target || ''} onChange={e => patch(i, { target: e.target.value || undefined })} style={{ ...sel, flex: '1 1 160px' }} title="Oggetto d'armeria che soltanto questa persona sa fare">
                    <option value="">— scegli l'oggetto dall'armeria —</option>
                    {armory.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <span className="small muted" style={{ fontSize: 9.5 }}>ogni</span>
                  <input type="number" min={1} value={a.every || 1} onChange={e => patch(i, { every: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...num, width: 44 }} title="Ogni quanti mercati arriva in magazzino" />
                  <span className="small muted" style={{ fontSize: 9.5 }}>mercati</span>
                </>}
                {kind === 'craft' && (
                  <select value={a.target || SHOP_OF[a.activityId] || 'forge'} onChange={e => patch(i, { target: e.target.value })} style={{ ...sel, flex: '0 1 140px' }} title="Bottega le cui commesse cambiano durata">
                    {Object.entries(SHOP_LABEL).map(([k, l]) => <option key={k} value={k}>commesse della {l}</option>)}
                  </select>
                )}
              </div>
            )}

            <input value={a.text || ''} placeholder="Che cosa porta, in parole (es. «sa preparare il sale consacrato»)" onChange={e => patch(i, { text: e.target.value })}
              style={{ fontSize: 11, padding: '3px 6px', width: '100%', marginTop: 5 }} />
            {d && <div className="small muted" style={{ fontSize: 10, marginTop: 3 }}>→ {d}</div>}
          </div>
        );
      })}
      <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 9 }}
        onClick={() => onChange([...fx, { activityId: acts[0]?.id || '', kind: 'yield', text: '', mod: 1 }])}>+ effetto</button>
    </div>
  );
}
