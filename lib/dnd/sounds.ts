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
 * Arpeggio ascendente trionfale
 */
export function sfxComplete(): void {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    [330, 392, 466, 523].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.13);
      gain.gain.setValueAtTime(0.09, now + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.13);
      osc.stop(now + i * 0.13 + 0.45);
    });

    // Nota finale sostenuta
    const sustain = ctx.createOscillator();
    const sustainGain = ctx.createGain();
    sustain.type = "sine";
    sustain.frequency.value = 698;
    sustainGain.gain.setValueAtTime(0.04, now + 0.45);
    sustainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    sustain.connect(sustainGain);
    sustainGain.connect(ctx.destination);
    sustain.start(now + 0.45);
    sustain.stop(now + 1);
  } catch (e) {
    // Ignora
  }
}
