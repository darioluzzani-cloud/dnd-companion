'use client';
import { useState, useEffect } from 'react';

// ─── Markdown minimale ───────────────────────────────────────
// Sottoinsieme volutamente ristretto per le note di gioco:
//   **grassetto**  *corsivo*  _corsivo_  a capo → <br>
// Nessun HTML arbitrario: il testo viene prima neutralizzato (escape),
// poi si applicano solo le tre trasformazioni. Sicuro e prevedibile.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mdToHtml(src: string): string {
  let h = escapeHtml(src ?? '');
  // grassetto **...** o __...__
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // corsivo *...* o _..._ (dopo il grassetto, per non collidere)
  h = h.replace(/(^|[^*])\*(?!\s)(.+?)(?!\s)\*($|[^*])/g, '$1<em>$2</em>$3');
  h = h.replace(/(^|[^_])_(?!\s)(.+?)(?!\s)_($|[^_])/g, '$1<em>$2</em>$3');
  // a capo
  h = h.replace(/\n/g, '<br/>');
  return h;
}

// Rende una stringa Markdown come frammento formattato.
export function Markdown({ text, className, style }: { text?: string; className?: string; style?: React.CSSProperties }) {
  if (!text) return null;
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />;
}

// ─── NumberInput ─────────────────────────────────────────────
// Input numerico che NON forza uno 0 mentre si digita. Mantiene una
// bozza testuale locale: il campo può restare vuoto durante l'editing,
// e solo alla conferma (blur) o a ogni cifra valida propaga un numero.
// Elimina il fastidio dello "013" quando si cancella e si riscrive.
export function NumberInput({ value, onChange, min, max, empty0 = true, style, className, title, placeholder }: {
  value: number; onChange: (n: number) => void;
  min?: number; max?: number; empty0?: boolean;
  style?: React.CSSProperties; className?: string; title?: string; placeholder?: string;
}) {
  const [draft, setDraft] = useState<string>(String(value ?? ''));

  // Sincronizza la bozza se il valore cambia dall'esterno e non stai scrivendo
  useEffect(() => { setDraft(String(value ?? '')); }, [value]);

  const clamp = (n: number) => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };

  return (
    <input
      type="text" inputMode="numeric" pattern="[0-9-]*"
      value={draft} title={title} placeholder={placeholder} className={className} style={style}
      onChange={e => {
        const raw = e.target.value;
        // consenti campo vuoto e segno meno iniziale durante la digitazione
        if (raw === '' || raw === '-') { setDraft(raw); return; }
        if (!/^-?\d+$/.test(raw)) return;         // ignora caratteri non numerici
        const normalized = String(parseInt(raw, 10));  // toglie zeri iniziali (07 → 7)
        setDraft(normalized);
        onChange(clamp(parseInt(normalized, 10)));
      }}
      onBlur={() => {
        if (draft === '' || draft === '-') { const v = empty0 ? 0 : (min ?? 0); setDraft(String(v)); onChange(clamp(v)); }
      }}
    />
  );
}
