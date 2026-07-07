'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET = 'campaign-images';

/* ─────────────────────────────────────────────────────────────
   Indice di cartella condiviso: UN solo list() per sessione.
   Tutte le istanze di ImageSlot consultano la stessa mappa
   slotId → nome file, costruita al primo bisogno e paginata
   (il list() di Supabase restituisce al massimo 100 voci per
   pagina: senza paginazione, i file oltre il centesimo
   sparirebbero silenziosamente).
   ───────────────────────────────────────────────────────────── */
const folderIndexCache = new Map<string, Promise<Map<string, string>>>();

function slotKeyOf(filename: string): string {
  const dot = filename.indexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

export function getFolderIndex(folder: string): Promise<Map<string, string>> {
  let cached = folderIndexCache.get(folder);
  if (!cached) {
    cached = (async () => {
      const index = new Map<string, string>();
      const PAGE = 1000;
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase.storage.from(BUCKET)
          .list(folder, { limit: PAGE, offset, sortBy: { column: 'created_at', order: 'asc' } });
        if (error || !data) break;
        for (const f of data) index.set(slotKeyOf(f.name), f.name); // in caso di doppioni vince il più recente
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      return index;
    })();
    folderIndexCache.set(folder, cached);
  }
  return cached;
}

/** Registra nell'indice condiviso un file caricato da flussi esterni a ImageSlot,
    così le istanze già montate lo trovano senza ricaricare la pagina. */
export async function registerStorageFile(campaignId: string | null, filename: string) {
  const folder = campaignId || '_default';
  const index = await getFolderIndex(folder);
  index.set(slotKeyOf(filename), filename);
}

interface Props {
  slotId: string;
  campaignId: string | null;
  shape?: 'circle' | 'rounded' | 'rect';
  width?: string | number;
  height?: string | number;
  dmMode?: boolean;
  placeholder?: string;
  alt?: string;
  hideIfEmpty?: boolean;  // se true, il riquadro è invisibile finché non c'è un'immagine (salvo modalità DM)
  onUploaded?: () => void; // notifica il genitore a upload completato
}

export function ImageSlot({ slotId, campaignId, shape = 'rounded', width, height, dmMode, placeholder, alt, hideIfEmpty, onUploaded }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const folder = campaignId || '_default';

  const refresh = useCallback(async () => {
    if (!slotId || !campaignId) return;
    try {
      const index = await getFolderIndex(folder);
      const filename = index.get(slotId);
      if (filename) {
        // getPublicUrl è pura costruzione di stringa: nessuna chiamata di rete.
        // URL stabile e immutabile: il browser può cachearlo a lungo termine.
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${filename}`);
        setUrl(pub.publicUrl);
      } else {
        setUrl(null);
      }
    } catch { setUrl(null); }
  }, [slotId, campaignId, folder]);

  useEffect(() => { refresh(); }, [refresh]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !campaignId) return;
    setUploading(true);
    try {
      const index = await getFolderIndex(folder);
      // Rimuovo il file precedente noto all'indice (niente list() aggiuntivo)
      const previous = index.get(slotId);
      if (previous) await supabase.storage.from(BUCKET).remove([`${folder}/${previous}`]);
      // Nome versionato: URL nuovo a ogni sostituzione → cache del browser
      // aggressiva senza alcun rischio di immagini stantie.
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const versioned = `${slotId}.${Date.now().toString(36)}.${ext}`;
      await supabase.storage.from(BUCKET).upload(`${folder}/${versioned}`, file, {
        upsert: true, contentType: file.type, cacheControl: '31536000',
      });
      index.set(slotId, versioned);
      await refresh();
      onUploaded?.();
    } catch (err: unknown) {
      alert('Errore upload: ' + (err instanceof Error ? err.message : err));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Nascosto se richiesto, vuoto e non in modalità DM (il DM deve poterlo vedere per caricare)
  if (hideIfEmpty && !dmMode && !url) return null;

  const borderRadius = shape === 'circle' ? '50%' : shape === 'rect' ? '0' : '8px';
  const style: React.CSSProperties = { width: width || '100%', height: height || '100%', borderRadius };

  return (
    <div className="img-frame" style={style}>
      {url
        ? <img src={url} alt={alt || ''} className="img-slot" style={{ borderRadius }} loading="lazy" />
        : <div className="img-empty" style={{ borderRadius }}>{placeholder || alt?.slice(0, 2).toUpperCase() || 'IMG'}</div>
      }
      {dmMode && (
        <div className="img-upload-overlay" onClick={() => inputRef.current?.click()}>
          <span>{uploading ? 'Carico…' : url ? 'Sostituisci' : 'Carica'}</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPick} />
    </div>
  );
}
