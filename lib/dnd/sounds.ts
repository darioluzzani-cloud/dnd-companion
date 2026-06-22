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
 * Frase melodica unica high fantasy (~2.5s)
 * Pad armonico continuo + melodia ascendente fluida che si dissolve
 */
export function sfxComplete(): void {
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const dur = 2.6;

    // === Pad armonico continuo — quinta aperta medievale, sostiene tutto ===
    [196, 294, 392, 587].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const vol = [0.045, 0.04, 0.035, 0.02][i];
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.3);
      gain.gain.setValueAtTime(vol, now + 1.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.1);
    });

    // === Melodia fluida — ogni nota ha un lungo decay che si sovrappone alla successiva ===
    // Sol₄ → La → Si → Re₅ → Mi → Sol₅ → La → Si → Re₆
    const melody = [
      { f: 392,  t: 0.0  },
      { f: 440,  t: 0.18 },
      { f: 494,  t: 0.34 },
      { f: 587,  t: 0.52 },
      { f: 659,  t: 0.68 },
      { f: 784,  t: 0.88 },
      { f: 880,  t: 1.08 },
      { f: 988,  t: 1.30 },
      { f: 1175, t: 1.55 },
    ];

    melody.forEach((note, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note.f;
      const attack = now + note.t;
      // Volume decresce gradualmente per le note più alte — effetto naturale
      const peak = 0.11 - i * 0.007;
      // Ogni nota dura a lungo e sfuma, creando sovrapposizione
      const noteLen = 0.7 + (i * 0.05);
      gain.gain.setValueAtTime(0, attack);
      gain.gain.linearRampToValueAtTime(peak, attack + 0.035);
      gain.gain.setValueAtTime(peak * 0.7, attack + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, attack + noteLen);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(attack);
      osc.stop(attack + noteLen + 0.05);
    });

    // === Risonanza finale — la nota più alta si allarga con un'armonica ===
    [1175, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const vol = i === 0 ? 0.05 : 0.018;
      gain.gain.setValueAtTime(0, now + 1.6);
      gain.gain.linearRampToValueAtTime(vol, now + 1.7);
      gain.gain.setValueAtTime(vol * 0.8, now + 2.0);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 1.6);
      osc.stop(now + dur + 0.1);
    });

  } catch (e) {
    // Web Audio non disponibile
  }
}
