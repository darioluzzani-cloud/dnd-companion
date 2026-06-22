/**
 * Effetti sonori D&D Companion — Web Audio API
 * Nessuna dipendenza esterna, funziona in tutti i browser moderni
 */

let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Effetto sonoro: lancio di dadi
 * Sequenza di click metallici + thud finale
 */
export function sfxDice(): void {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    // Click rapidi (dado che rimbalza)
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 800 + Math.random() * 1200;
      gain.gain.setValueAtTime(0.08, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.06);
    }

    // Thud finale (dado che si ferma)
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = "triangle";
    thud.frequency.value = 200 + Math.random() * 100;
    thudGain.gain.setValueAtTime(0.12, now + 0.25);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now + 0.25);
    thud.stop(now + 0.5);
  } catch (e) {
    // Web Audio non disponibile, ignora silenziosamente
  }
}

/**
 * Effetto sonoro: rivelazione (quest/lore svelata)
 * Accordo caldo + arpeggio pentatonico + chime finale
 */
export function sfxReveal(): void {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    // Pad (accordo di quinta, stile Zelda apertura forziere)
    [262, 330, 392].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.15);
      gain.gain.setValueAtTime(0.05, now + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.5);
    });

    // Arpeggio melodico — pentatonica minore, tipo arpa
    [392, 466, 523, 622, 784, 932].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.22);
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.22);
      osc.stop(now + i * 0.22 + 0.6);
    });

    // Chime alto alla fine
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = "sine";
    chime.frequency.value = 1175;
    chimeGain.gain.setValueAtTime(0, now + 1.4);
    chimeGain.gain.linearRampToValueAtTime(0.06, now + 1.5);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);
    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(now + 1.4);
    chime.stop(now + 2.4);

    // Campana all'ottava
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = "sine";
    bell.frequency.value = 1568;
    bellGain.gain.setValueAtTime(0, now + 1.6);
    bellGain.gain.linearRampToValueAtTime(0.04, now + 1.7);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(now + 1.6);
    bell.stop(now + 2.5);
  } catch (e) {
    // Ignora
  }
}

/**
 * Effetto sonoro: quest completata
 * Fanfara trionfale stile JRPG (~2.5 secondi)
 * Struttura: arpeggio ascendente → accordo pieno → risoluzione melodica → shimmer
 */
export function sfxComplete(): void {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    // === FASE 1: Arpeggio ascendente (0.0s – 0.6s) ===
    // Do-Mi-Sol-Do⁵ — arpa che sale, ogni nota staccata e chiara
    [262, 330, 392, 523].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + i * 0.14;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.setValueAtTime(0.10, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });

    // === FASE 2: Accordo trionfale pieno (0.65s – 1.6s) ===
    // Do-Mi-Sol-Do⁵ simultanei, attacco deciso, sustain caldo
    [262, 330, 392, 523].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + 0.65);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.72);
      gain.gain.setValueAtTime(0.06, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.65);
      osc.stop(now + 1.85);
    });
    // Quinta bassa di rinforzo (Sol₃) per dare corpo
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = 196;
    bassGain.gain.setValueAtTime(0, now + 0.65);
    bassGain.gain.linearRampToValueAtTime(0.05, now + 0.72);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.start(now + 0.65);
    bass.stop(now + 1.65);

    // === FASE 3: Risoluzione melodica (1.1s – 1.9s) ===
    // Re⁵-Mi⁵-Sol⁵ — tre note ascendenti che risolvono sull'alto
    [587, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + 1.1 + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.10, t + 0.03);
      gain.gain.setValueAtTime(0.08, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });

    // === FASE 4: Nota finale sostenuta + shimmer (1.7s – 2.5s) ===
    // Do⁶ — la nota trionfale che chiude tutto
    const finale = ctx.createOscillator();
    const finaleGain = ctx.createGain();
    finale.type = 'sine';
    finale.frequency.value = 1047; // Do⁶
    finaleGain.gain.setValueAtTime(0, now + 1.7);
    finaleGain.gain.linearRampToValueAtTime(0.08, now + 1.78);
    finaleGain.gain.setValueAtTime(0.06, now + 2.0);
    finaleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    finale.connect(finaleGain);
    finaleGain.connect(ctx.destination);
    finale.start(now + 1.7);
    finale.stop(now + 2.55);

    // Shimmer: ottava alta sottile che brilla sopra
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 2093; // Do⁷
    shimmerGain.gain.setValueAtTime(0, now + 1.8);
    shimmerGain.gain.linearRampToValueAtTime(0.025, now + 1.88);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.start(now + 1.8);
    shimmer.stop(now + 2.55);

    // Pad armonico di chiusura — Sol⁴+Do⁵ che si dissolve
    [392, 523].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + 1.7);
      gain.gain.linearRampToValueAtTime(0.035, now + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 1.7);
      osc.stop(now + 2.55);
    });

  } catch (e) {
    // Web Audio non disponibile, ignora silenziosamente
  }
}
