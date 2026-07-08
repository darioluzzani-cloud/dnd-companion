/**
 * Mercato settimanale di Olmobianco — dati canonici e logica di tiro.
 * Fonte: scheda DM "Mercato Settimanale e Dicerie della Marca".
 *
 * I tre livelli del mercato si àncorano al livello dell'edificio Piazza:
 * Piazza L1 → Mercato 1 (d6, 1 fisso + 1d4)
 * Piazza L2 → Mercato 2 (d12, 2 fissi + 1d4)
 * Piazza L3 → Mercato 3 (d20, 3 fissi + 1d4)
 *
 * I default vivono qui; se lo stato Supabase contiene marketStalls /
 * marketRumors personalizzati, quelli prevalgono (copy-on-write dal DM).
 */

export interface MarketStall {
  id: string;
  name: string;
  desc: string;                       // offerta descrittiva
  ranges: Record<number, [number, number] | undefined>; // fasce dado per livello mercato 1..3
  items: string[];                    // pool oggetti (a schermo max 5)
  randomize?: boolean;                // se true, pesca 5 casuali dal pool a ogni mercato
  kind?: 'stall' | 'tales' | 'double';// tales = Cantastorie (tabella dicerie); double = grande affluenza
}

export interface MarketRumor {
  from: number; to: number;
  text: string;
  nature: string;                     // Vera / Colore / Inquietante / Vera (parziale) …
  dmNote: string;
}

export interface MarketDay {
  dateKey: string;                    // "g/m/a" velmorano del giorno di mercato
  level: 1 | 2 | 3;
  count: number;                      // bancarelle uscite
  stalls: { stallId: string; items?: string[] }[];  // items = pescata random congelata
  rumorRoll?: number | null;          // ultimo tiro dicerie del cantastorie
}

export const MARKET_LEVELS: Record<number, { die: number; fixed: number; label: string }> = {
  1: { die: 6,  fixed: 1, label: 'Mercato 1 · Piazza L1 · d6'  },
  2: { die: 12, fixed: 2, label: 'Mercato 2 · Piazza L2 · d12' },
  3: { die: 20, fixed: 3, label: 'Mercato 3 · Piazza L3 · d20' },
};

/** Livello mercato derivato dal livello dell'edificio Piazza (0 = nessun mercato). */
export function marketLevelFromBuilding(buildingLevel: number): 0 | 1 | 2 | 3 {
  if (buildingLevel >= 3) return 3;
  if (buildingLevel === 2) return 2;
  if (buildingLevel === 1) return 1;
  return 0;
}

export const DEFAULT_STALLS: MarketStall[] = [
  { id: 'st-vettovaglie', name: 'Vettovaglie da viaggio', desc: 'Razioni comuni, massimo 30 acquistabili per visita.',
    ranges: { 1: [1, 2], 2: [1, 2], 3: [1, 2] },
    items: ['Razioni comuni (max 30 per visita)'] },
  { id: 'st-erbe', name: 'Erbe alchemiche comuni', desc: 'Il banco erboristico di base del mercato.',
    ranges: { 1: [3, 4], 2: [3, 4], 3: [3, 4] },
    items: ['Sanguinella', 'Genziana', 'Semi di achillea', 'Resina di sorbo', 'Veltrina', 'Salcipunta', 'Crespino amaro', 'Muschio ferroso', 'Bacche di ginepro'],
    randomize: true },
  { id: 'st-pellami', name: 'Pellami e armi semplici', desc: 'Pelli conciate di base, coltelli, asce da lavoro, armi semplici.',
    ranges: { 1: [5, 6], 2: [5, 6], 3: [5, 6] },
    items: ['Pelli conciate di base', 'Coltelli', 'Asce da lavoro', 'Armi semplici'] },
  { id: 'st-libraio', name: 'Libraio itinerante', desc: 'Libri usati, pergamene, mappe vecchie.',
    ranges: { 2: [7, 7], 3: [7, 7] },
    items: ['Libri usati', 'Pergamene', 'Mappe vecchie'] },
  { id: 'st-cantastorie', name: 'Cantastorie', desc: 'Nessun oggetto: dicerie e racconti. Tira sulla tabella delle Dicerie della Marca.',
    ranges: { 2: [8, 8], 3: [8, 8] },
    items: [], kind: 'tales' },
  { id: 'st-orafo', name: 'Orafo', desc: 'Gioielli semplici, argenteria.',
    ranges: { 2: [9, 9], 3: [9, 9] },
    items: ['Gioielli semplici', 'Argenteria'] },
  { id: 'st-cuoio', name: 'Cuoio e zanne', desc: 'Cuoio conciato di qualità, zanne e trofei di caccia grossa.',
    ranges: { 2: [10, 10], 3: [10, 10] },
    items: ['Cuoio conciato di qualità', 'Zanne', 'Trofei di caccia grossa'] },
  { id: 'st-amuleti', name: 'Amuleti magici minori', desc: 'Piccoli oggetti magici di basso rango, assortimento a discrezione del DM.',
    ranges: { 2: [11, 11], 3: [11, 11] },
    items: [], randomize: true },
  { id: 'st-equip', name: 'Equipaggiamento e armi competenti', desc: 'Armi marziali, armature leggere e medie.',
    ranges: { 2: [12, 12], 3: [12, 13] },
    items: ['Armi marziali', 'Armature leggere', 'Armature medie'] },
  { id: 'st-erborista', name: 'Erborista con erbe rare', desc: 'Le tre rarità del sistema alchemico.',
    ranges: { 3: [14, 14] },
    items: ['Verbena notturna ★', 'Resina di abete nero ★', 'Radice di pietraghiaccio ★'] },
  { id: 'st-pozionista', name: 'Pozionista', desc: 'Pozioni preparate.',
    ranges: { 3: [15, 15] },
    items: [], randomize: true },
  { id: 'st-animali', name: 'Venditore di animali da fattoria', desc: 'Bestiame minuto e da lavoro.',
    ranges: { 3: [16, 16] },
    items: ['Bestiame minuto', 'Animali da lavoro'] },
  { id: 'st-curiosita', name: 'Collezionista di curiosità', desc: 'Pietre incise, manufatti antichi — canale coerente col metodo di mappatura dei Sondatori.',
    ranges: { 3: [17, 17] },
    items: [], randomize: true },
  { id: 'st-reliquiario', name: 'Reliquiario itinerante', desc: 'Oggetti "benedetti", cimeli da santuari maggiori.',
    ranges: { 3: [18, 18] },
    items: [], randomize: true },
  { id: 'st-affluenza', name: 'Giornata di grande affluenza', desc: 'Tira due bancarelle aggiuntive su questa stessa tabella.',
    ranges: { 3: [19, 19] },
    items: [], kind: 'double' },
  { id: 'st-fatato', name: 'Il Mercante Fatato', desc: 'Oggetti impossibili, pagati in ricordi o promesse, mai in oro.',
    ranges: { 3: [20, 20] },
    items: [] },
];

export const DEFAULT_RUMORS: MarketRumor[] = [
  { from: 1,  to: 4,  text: 'La Gilda delle Bilance litiga su chi controlli le rotte a ovest.', nature: 'Colore', dmNote: 'Tensioni interne generiche' },
  { from: 5,  to: 8,  text: "Un uomo con la cicatrice sul sopracciglio beve da solo in un'osteria di Geronia.", nature: 'Vera', dmNote: 'Corvan Brugh, avvistamento' },
  { from: 9,  to: 12, text: 'La miniera di Caraschiena è di nuovo abitata di notte, da qualcuno che non fa rumore.', nature: 'Vera', dmNote: 'Nuova cellula della Mano di Fuliggine, se decidi di farla ripartire' },
  { from: 13, to: 16, text: "Il fiume Ermoro, a luna calante, sussurra un nome che nessuno ricorda al mattino.", nature: 'Inquietante', dmNote: 'Filo aperto sulla liturgia elfica di Velmo' },
  { from: 17, to: 20, text: 'A Valdrasco il pesce non abbocca più da settimane.', nature: 'Vera', dmNote: 'Sigillo di Valdrasco in scadenza' },
  { from: 21, to: 24, text: 'A Pietrafonda i goblin scendono in numero mai visto, e qualcuno li comanda.', nature: 'Vera', dmNote: 'Deterioramento del sigillo di Pietrafonda' },
  { from: 25, to: 28, text: 'Un Camminante senza bastone chiede notizie di uno rubato due anni fa.', nature: 'Vera', dmNote: 'Eira, la Custode derubata' },
  { from: 29, to: 32, text: 'I conti della Gilda non tornano mai del tutto: qualcuno tiene un secondo libro mastro.', nature: 'Vera (parziale)', dmNote: 'Esistenza dei Sondatori, non confermata' },
  { from: 33, to: 36, text: 'A Castelferro la Casa delle Bilance ha assunto guardie private per sorvegliare gli archivi di notte.', nature: 'Vera (parziale)', dmNote: 'Paranoia dei Sondatori, senza esporre Edda' },
  { from: 37, to: 40, text: 'Un fabbro di montagna ha sepolto di nuovo qualcosa che non doveva trovare.', nature: 'Colore', dmNote: 'Nessuno sviluppo, per scelta esplicita' },
  { from: 41, to: 44, text: 'Una vedova sogna finalmente il marito con il suo vero volto.', nature: 'Vera', dmNote: 'Eco di Elsbeth, la voce si sparge' },
  { from: 45, to: 48, text: 'La Via dei Mercanti vicino a Olmobianco è più sicura di un tempo.', nature: 'Vera', dmNote: 'Reputazione crescente dei PG' },
  { from: 49, to: 52, text: 'La banda di Corvan si è divisa, Brasca non risponde più agli ordini.', nature: 'Vera', dmNote: 'Sviluppo aperto' },
  { from: 53, to: 56, text: 'Le cappellette di Santa Mira sulla via per Geronia sono state ripulite da mano ignota.', nature: 'Inquietante', dmNote: 'Ambiguo di proposito' },
  { from: 57, to: 60, text: 'Un giudice di Geronia ha archiviato in fretta un caso di sparizione.', nature: 'Vera (parziale)', dmNote: 'Metodo di rapimento dei Sondatori' },
  { from: 61, to: 64, text: 'Il decotto di sanguinella cura meno del solito, la pianta sembra stanca.', nature: 'Vera', dmNote: 'Indicatore naturale della salute di un sigillo vicino' },
  { from: 65, to: 68, text: "Luci sotto la superficie del Selce, dove l'acqua non dovrebbe essere così profonda.", nature: 'Vera (riserva)', dmNote: 'Sigillo orfano: colpo di scena, non in coda' },
  { from: 69, to: 72, text: 'Lo stesso corvo incrociato tre volte, in tre luoghi lontani.', nature: 'Inquietante', dmNote: 'Eco della bufera, presagio' },
  { from: 73, to: 76, text: 'Un antiquario di Castelferro paga bene pietre incise, senza fare domande.', nature: 'Vera', dmNote: 'Metodo di mappatura dei Sondatori' },
  { from: 77, to: 80, text: 'Una nana forgiatrice racconta di aver conosciuto Durna sotto un altro nome.', nature: 'Colore', dmNote: 'Nessuno sviluppo, per scelta esplicita' },
  { from: 81, to: 84, text: 'Si offrono taglie doppie per chi cattura vivo un membro della Mano di Fuliggine.', nature: 'Vera', dmNote: 'La Gilda vuole informazioni dalla Mano' },
  { from: 85, to: 88, text: 'A Valdrasco il vecchio traghettatore rifiuta di attraversare il lago dopo il tramonto.', nature: 'Vera (parziale)', dmNote: 'Rinforza da un altro angolo il sigillo in scadenza' },
  { from: 89, to: 92, text: 'Il tribunale di Geronia non accetta più cause di sparizione dalle valli a nord.', nature: 'Vera (parziale)', dmNote: 'Pattern sistemico, lega Geronia ai metodi dei Sondatori' },
  { from: 93, to: 96, text: "Quest'anno i pellegrini di Mira sono più numerosi sulle strade minori, e alcuni camminano con un passo diverso da quello dei pellegrini comuni.", nature: 'Inquietante', dmNote: "Prepara l'arrivo di un Camminante, senza svelare chi né quando" },
  { from: 97, to: 99, text: "Una carovana è sparita sulla strada per Pietrafonda, e nessuno l'ha cercata.", nature: 'Vera', dmNote: 'Aggravamento della situazione, urgenza crescente' },
  { from: 100, to: 100, text: 'In un pozzo abbandonato si sente un battito regolare sotto la pietra, quattro secondi esatti.', nature: 'Vera (pesante)', dmNote: "Eco del villaggio senza nome: un'altra iterazione del reticolo si risveglia altrove" },
];

const roll = (die: number) => Math.floor(Math.random() * die) + 1;

/** Pesca fino a 5 oggetti dal pool, mescolati (per le bancarelle randomizzate). */
export function drawItems(stall: MarketStall): string[] | undefined {
  if (!stall.randomize) return undefined;
  const pool = [...stall.items];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 5);
}

/**
 * Tira il mercato del giorno: numero di bancarelle (fissi + 1d4), poi
 * assegnazione sulle fasce del dado di livello. Doppioni ritirati (ogni
 * bancarella al massimo una volta); "grande affluenza" aggiunge due tiri
 * e non conta come banco; se il numero eccede i banchi disponibili, si tronca.
 */
export function rollMarket(level: 1 | 2 | 3, stalls: MarketStall[], dateKey: string): MarketDay {
  const cfg = MARKET_LEVELS[level];
  const eligible = stalls.filter(st => st.ranges[level]);
  const findByRoll = (n: number) => eligible.find(st => { const r = st.ranges[level]!; return n >= r[0] && n <= r[1]; });

  let toDraw = cfg.fixed + roll(4);
  const drawn: { stallId: string; items?: string[] }[] = [];
  const used = new Set<string>();
  let doubleTriggered = false;
  let guard = 200;

  while (drawn.length < toDraw && guard-- > 0) {
    const realStalls = eligible.filter(st => st.kind !== 'double');
    if (used.size >= realStalls.length) break;           // banchi esauriti
    const st = findByRoll(roll(cfg.die));
    if (!st || used.has(st.id)) continue;                // buco di fascia o doppione: ritira
    if (st.kind === 'double') {
      if (doubleTriggered) continue;                     // affluenza già uscita: ritira
      doubleTriggered = true;
      toDraw += 2;
      continue;                                          // non è un banco
    }
    used.add(st.id);
    drawn.push({ stallId: st.id, items: drawItems(st) });
  }
  return { dateKey, level, count: drawn.length, stalls: drawn, rumorRoll: null };
}
