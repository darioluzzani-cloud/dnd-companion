/**
 * Tabella XP → Livello (D&D 5e)
 * XP_TABLE[i] = XP minimo per livello i+1
 */
export const XP_TABLE = [
  0,       // Livello 1
  300,     // Livello 2
  900,     // Livello 3
  2700,    // Livello 4
  6500,    // Livello 5
  14000,   // Livello 6
  23000,   // Livello 7
  34000,   // Livello 8
  48000,   // Livello 9
  64000,   // Livello 10
  85000,   // Livello 11
  100000,  // Livello 12
  120000,  // Livello 13
  140000,  // Livello 14
  165000,  // Livello 15
  195000,  // Livello 16
  225000,  // Livello 17
  265000,  // Livello 18
  305000,  // Livello 19
  355000,  // Livello 20
];

/**
 * Calcola livello, percentuale progresso e testo da XP totali
 */
export function getLevelInfo(xp: number): {
  level: number;
  pct: number;
  text: string;
} {
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
  }
  level = Math.min(20, level);

  if (level >= 20) {
    return {
      level: 20,
      pct: 100,
      text: `${xp.toLocaleString("it-IT")} PE · MAX`,
    };
  }

  const current = XP_TABLE[level - 1];
  const next = XP_TABLE[level];
  const pct = Math.max(
    0,
    Math.min(100, Math.round(((xp - current) / (next - current)) * 100))
  );

  return {
    level,
    pct,
    text: `${xp.toLocaleString("it-IT")} / ${next.toLocaleString("it-IT")} PE`,
  };
}

/**
 * XP minimo per un dato livello
 */
export function xpForLevel(level: number): number {
  const lv = Math.max(1, Math.min(20, level));
  return XP_TABLE[lv - 1];
}
