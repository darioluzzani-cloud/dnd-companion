'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const BUCKET = 'campaign-images';

interface Props {
  slotId: string;
  campaignId: string | null;
  shape?: 'circle' | 'rounded' | 'rect';
  width?: string | number;
  height?: string | number;
  dmMode?: boolean;
  placeholder?: string;
  alt?: string;
}

export function ImageSlot({ slotId, campaignId, shape = 'rounded', width, height, dmMode, placeholder, alt }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const folder = campaignId || '_default';
  const prefix = `${folder}/${slotId}`;

  const refresh = useCallback(async () => {
    if (!slotId || !campaignId) return;
    try {
      const { data } = await supabase.storage.from(BUCKET).list(folder, { search: slotId });
      const match = (data || []).find(f => f.name.startsWith(slotId + '.'));
      if (match) {
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${match.name}`);
        setUrl(pub.publicUrl + '?t=' + Date.now());
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
      // Rimuovi file precedenti
      const { data: existing } = await supabase.storage.from(BUCKET).list(folder, { search: slotId });
      const toRemove = (existing || []).filter(f => f.name.startsWith(slotId + '.')).map(f => `${folder}/${f.name}`);
      if (toRemove.length) await supabase.storage.from(BUCKET).remove(toRemove);
      // Upload nuovo
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      await supabase.storage.from(BUCKET).upload(`${prefix}.${ext}`, file, { upsert: true, contentType: file.type });
      await refresh();
    } catch (err: unknown) {
      alert('Errore upload: ' + (err instanceof Error ? err.message : err));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const borderRadius = shape === 'circle' ? '50%' : shape === 'rect' ? '0' : '8px';
  const style: React.CSSProperties = { width: width || '100%', height: height || '100%', borderRadius };

  return (
    <div className="img-frame" style={style}>
      {url
        ? <img src={url} alt={alt || ''} className="img-slot" style={{ borderRadius }} />
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
