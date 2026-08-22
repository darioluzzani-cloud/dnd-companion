'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  SnapshotMeta, SNAPSHOT_KEEP, SNAPSHOT_SQL,
  listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot, snapshotsAvailable,
} from '@/lib/snapshots';

// ─── POPUP: PUNTI DI RIPRISTINO ──────────────────────────────
// Il rimedio all'unico guasto davvero irreversibile: un errore in modalità
// DM durante una sessione dal vivo. Prima di questo, l'unica rete era
// l'esportazione manuale, che nessuno si ricorda di fare proprio nelle sere
// in cui servirebbe.

export function SnapshotsPopup({ campaignId, onClose }: { campaignId: string | null; onClose: () => void }) {
  const [list, setList] = useState<SnapshotMeta[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const reload = useCallback(async () => {
    if (!campaignId) return;
    try { setList(await listSnapshots(campaignId)); setErr(null); }
    catch (e: any) { setErr(e.message || String(e)); }
  }, [campaignId]);

  useEffect(() => {
    (async () => {
      if (!campaignId) { setReady(false); return; }
      const ok = await snapshotsAvailable(campaignId);
      setReady(ok);
      if (ok) reload();
    })();
  }, [campaignId, reload]);

  const scatta = async (auto = false, text?: string) => {
    if (!campaignId) return;
    setBusy('new');
    try { await createSnapshot(campaignId, text ?? label, auto); setLabel(''); await reload(); }
    catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(null); }
  };

  const ripristina = async (m: SnapshotMeta) => {
    if (!campaignId) return;
    const quando = fmt(m.created_at);
    if (!confirm(`Riportare la campagna allo stato del ${quando}?\n\nTutto ciò che è cambiato dopo — inventari, scenari, punti ferita, lavorazioni — verrà sostituito su tutti i dispositivi. Dello stato attuale viene comunque scattata una fotografia di sicurezza.`)) return;
    setBusy(m.id);
    try {
      await restoreSnapshot(campaignId, m.id);
      alert('Ripristino compiuto. La pagina viene ricaricata; gli altri dispositivi vanno ricaricati a mano.');
      window.location.reload();
    } catch (e: any) { setErr(e.message || String(e)); setBusy(null); }
  };

  const elimina = async (m: SnapshotMeta) => {
    if (!confirm('Eliminare questa fotografia?')) return;
    setBusy(m.id);
    try { await deleteSnapshot(m.id); await reload(); }
    catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="alchemy-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="alchemy-popup sheet-popup" style={{ borderColor: 'var(--blue)' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.5">
              <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" strokeLinecap="round" /><path d="M3 3v5h5" strokeLinecap="round" />
            </svg>
            <div className="h2" style={{ color: 'var(--blue)' }}>Punti di ripristino</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
        </div>

        {ready === false && (
          <div className="card" style={{ borderColor: 'var(--gold)' }}>
            <div className="small" style={{ lineHeight: 1.6 }}>
              La tabella dei punti di ripristino non esiste ancora. Va creata una sola volta, dall'editor SQL di Supabase.
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 10, marginTop: 8 }} onClick={() => setShowSql(v => !v)}>
              {showSql ? 'Nascondi' : 'Mostra'} il comando SQL
            </button>
            {showSql && (
              <>
                <pre style={{ fontSize: 10, lineHeight: 1.5, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 6, padding: 9, marginTop: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{SNAPSHOT_SQL}</pre>
                <button className="btn" style={{ fontSize: 10, marginTop: 6 }}
                  onClick={() => { navigator.clipboard?.writeText(SNAPSHOT_SQL); alert('Comando copiato.'); }}>Copia</button>
              </>
            )}
          </div>
        )}

        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><span className="small" style={{ color: 'var(--red)' }}>{err}</span></div>}

        {ready && (
          <>
            <div className="card">
              <div className="label" style={{ marginBottom: 6 }}>Scatta una fotografia</div>
              <div className="row" style={{ gap: 6 }}>
                <input className="grow" value={label} placeholder="Etichetta (es. prima dell'assalto)…"
                  onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') scatta(); }} style={{ fontSize: 13 }} />
                <button className="btn btn-primary" disabled={busy === 'new'} onClick={() => scatta()}>
                  {busy === 'new' ? '…' : 'Scatta'}
                </button>
              </div>
              <div className="small muted" style={{ fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
                Fotografa ciò che è salvato sul server: stato condiviso e schede dei personaggi. Le ultime {SNAPSHOT_KEEP} restano, le più vecchie si potano da sole. Un buon momento è l'inizio di ogni sessione.
              </div>
            </div>

            {list.length === 0 && (
              <div className="card small muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                Nessuna fotografia. Scattane una adesso: sarà il punto a cui tornare stasera.
              </div>
            )}

            {list.map(m => (
              <div key={m.id} className="card" style={{ padding: '9px 11px' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {m.label || <span className="muted" style={{ fontStyle: 'italic' }}>senza etichetta</span>}
                      {m.auto && <span className="pill" style={{ marginLeft: 6, padding: '1px 6px', fontSize: 8, color: 'var(--gray-purple)', borderColor: 'var(--border)' }}>automatica</span>}
                    </div>
                    <div className="small muted" style={{ fontSize: 10 }}>{fmt(m.created_at)} · {m.players} personaggi</div>
                  </div>
                  <button className="btn" style={{ fontSize: 10, padding: '3px 10px', borderColor: 'var(--blue)' }}
                    disabled={!!busy} onClick={() => ripristina(m)}>{busy === m.id ? '…' : 'Ripristina'}</button>
                  <button className="btn btn-danger btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}
                    disabled={!!busy} onClick={() => elimina(m)}>&times;</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
