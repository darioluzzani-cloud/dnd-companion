/**
 * Sistema meteo D&D 5.5 — Marca di Velmora
 * 4 biomi × 4 stagioni × 19 condizioni
 * d100 al mattino per l'intera giornata
 */

export interface WeatherCondition {
  n: string;
  i: 'lieve' | 'moderata' | 'grave' | 'estrema' | null;
  ef: string;
}

export interface WeatherDetail {
  k: string;
  n: string;
  c: string;
  i: string;
  vs: string;
  mb: string;
  sv: string[];
  va: string[];
  id: { t: string; d: string };
  sp: string[];
}

export interface WeatherRow {
  id: string;
  w: number;
}

// ── Condizioni base ──
export const COND: Record<string, WeatherCondition> = {
  sereno: { n: "Sereno", i: null, ef: "—" },
  nuvoloso: { n: "Nuvoloso / variabile", i: null, ef: "—" },
  pioggia_leggera: { n: "Pioggia leggera", i: "lieve", ef: "Svan. Percezione (vista) oltre 18 m" },
  pioggia_battente: { n: "Pioggia battente", i: "moderata", ef: "Svan. attacchi a dist. · terr. difficile" },
  grandine: { n: "Grandine", i: "moderata", ef: "1 danno contr./round · svan. Percezione" },
  tempesta_elettrica: { n: "Tempesta elettrica", i: "grave", ef: "Rischio fulmine · TS Cos CD 14 ogni 2h" },
  neve_leggera: { n: "Neve leggera", i: "lieve", ef: "Svan. Percezione (vista) · terr. difficile" },
  freddo_pungente: { n: "Freddo pungente", i: "moderata", ef: "TS Cos CD 10 ogni 1h o +1 Ind." },
  bufera_neve: { n: "Bufera di neve", i: "estrema", ef: "Cecità funz. · +1 Ind. automatico ogni 2h" },
  gelo_estremo: { n: "Gelo estremo", i: "estrema", ef: "+1 Ind. automatico/1h · 1d6 danni freddo" },
  vento_forte: { n: "Vento forte", i: "moderata", ef: "Svan. attacchi a dist. · torce spente" },
  tempesta_vento: { n: "Tempesta di vento", i: "grave", ef: "Terr. diff. · cr. Piccole TS For CD 12" },
  uragano: { n: "Uragano", i: "estrema", ef: "+1 Ind. automatico/1h · vel. max 6 m" },
  nebbia_leggera: { n: "Nebbia leggera", i: "lieve", ef: "Svan. Percezione (vista) oltre 18 m" },
  nebbia_fitta: { n: "Nebbia fitta", i: "grave", ef: "Cecità funz. oltre 1,5 m" },
  caldo_intenso: { n: "Caldo intenso", i: "moderata", ef: "TS Cos CD 15 ogni 1h senza acqua" },
  arsura_estrema: { n: "Arsura estrema", i: "estrema", ef: "+1 Ind. automatico/1h · vel. –3 m" },
  tempesta_sabbia: { n: "Tempesta di sabbia", i: "estrema", ef: "+1 Ind. automatico/1h · 1 taglio/round" },
  mare_mosso: { n: "Mare mosso", i: "moderata", ef: "Acrobazia CD 12 a bordo" },
  nebbia_costiera: { n: "Nebbia costiera", i: "grave", ef: "Vis. 6 m · rischio collisione" },
  tempesta_mare: { n: "Tempesta in mare", i: "estrema", ef: "Auto/TS Ind. · rischio naufragio" },
};

// ── Tabelle d100 per bioma/stagione ──
export const DT: Record<string, Record<string, WeatherRow[]>> = {
  temperato: {
    primavera: [{ id: "sereno", w: 30 }, { id: "nuvoloso", w: 15 }, { id: "pioggia_leggera", w: 20 }, { id: "pioggia_battente", w: 12 }, { id: "nebbia_leggera", w: 8 }, { id: "nebbia_fitta", w: 4 }, { id: "vento_forte", w: 5 }, { id: "grandine", w: 3 }, { id: "tempesta_elettrica", w: 2 }, { id: "caldo_intenso", w: 1 }],
    estate: [{ id: "sereno", w: 40 }, { id: "nuvoloso", w: 10 }, { id: "pioggia_leggera", w: 12 }, { id: "pioggia_battente", w: 8 }, { id: "caldo_intenso", w: 12 }, { id: "nebbia_leggera", w: 5 }, { id: "vento_forte", w: 5 }, { id: "grandine", w: 4 }, { id: "tempesta_elettrica", w: 4 }],
    autunno: [{ id: "sereno", w: 25 }, { id: "nuvoloso", w: 15 }, { id: "pioggia_leggera", w: 22 }, { id: "pioggia_battente", w: 15 }, { id: "nebbia_leggera", w: 8 }, { id: "nebbia_fitta", w: 5 }, { id: "vento_forte", w: 5 }, { id: "tempesta_vento", w: 2 }, { id: "grandine", w: 2 }, { id: "tempesta_elettrica", w: 1 }],
    inverno: [{ id: "sereno", w: 25 }, { id: "nuvoloso", w: 15 }, { id: "neve_leggera", w: 20 }, { id: "freddo_pungente", w: 15 }, { id: "pioggia_leggera", w: 8 }, { id: "nebbia_leggera", w: 6 }, { id: "nebbia_fitta", w: 4 }, { id: "vento_forte", w: 4 }, { id: "tempesta_elettrica", w: 1 }, { id: "bufera_neve", w: 2 }],
  },
  artico: {
    primavera: [{ id: "sereno", w: 25 }, { id: "nuvoloso", w: 10 }, { id: "neve_leggera", w: 20 }, { id: "freddo_pungente", w: 15 }, { id: "pioggia_leggera", w: 10 }, { id: "nebbia_leggera", w: 8 }, { id: "vento_forte", w: 7 }, { id: "tempesta_vento", w: 3 }, { id: "bufera_neve", w: 2 }],
    estate: [{ id: "sereno", w: 35 }, { id: "nuvoloso", w: 15 }, { id: "pioggia_leggera", w: 20 }, { id: "freddo_pungente", w: 10 }, { id: "nebbia_leggera", w: 8 }, { id: "vento_forte", w: 6 }, { id: "tempesta_elettrica", w: 4 }, { id: "grandine", w: 2 }],
    autunno: [{ id: "sereno", w: 20 }, { id: "nuvoloso", w: 10 }, { id: "neve_leggera", w: 20 }, { id: "freddo_pungente", w: 18 }, { id: "pioggia_leggera", w: 8 }, { id: "nebbia_leggera", w: 7 }, { id: "vento_forte", w: 8 }, { id: "tempesta_vento", w: 5 }, { id: "bufera_neve", w: 3 }, { id: "gelo_estremo", w: 1 }],
    inverno: [{ id: "sereno", w: 15 }, { id: "neve_leggera", w: 15 }, { id: "freddo_pungente", w: 20 }, { id: "bufera_neve", w: 18 }, { id: "gelo_estremo", w: 12 }, { id: "vento_forte", w: 8 }, { id: "tempesta_vento", w: 7 }, { id: "nebbia_leggera", w: 3 }, { id: "uragano", w: 2 }],
  },
  desertico: {
    primavera: [{ id: "sereno", w: 45 }, { id: "caldo_intenso", w: 25 }, { id: "vento_forte", w: 12 }, { id: "nebbia_leggera", w: 8 }, { id: "tempesta_sabbia", w: 6 }, { id: "arsura_estrema", w: 4 }],
    estate: [{ id: "sereno", w: 30 }, { id: "caldo_intenso", w: 30 }, { id: "arsura_estrema", w: 20 }, { id: "vento_forte", w: 8 }, { id: "tempesta_sabbia", w: 10 }, { id: "tempesta_elettrica", w: 2 }],
    autunno: [{ id: "sereno", w: 45 }, { id: "caldo_intenso", w: 20 }, { id: "vento_forte", w: 15 }, { id: "nebbia_leggera", w: 8 }, { id: "tempesta_sabbia", w: 8 }, { id: "pioggia_leggera", w: 4 }],
    inverno: [{ id: "sereno", w: 40 }, { id: "nuvoloso", w: 15 }, { id: "vento_forte", w: 15 }, { id: "nebbia_leggera", w: 12 }, { id: "pioggia_leggera", w: 10 }, { id: "freddo_pungente", w: 6 }, { id: "tempesta_sabbia", w: 2 }],
  },
  marittimo: {
    primavera: [{ id: "sereno", w: 30 }, { id: "nebbia_costiera", w: 15 }, { id: "nebbia_leggera", w: 10 }, { id: "vento_forte", w: 12 }, { id: "mare_mosso", w: 12 }, { id: "pioggia_leggera", w: 10 }, { id: "pioggia_battente", w: 6 }, { id: "tempesta_elettrica", w: 3 }, { id: "tempesta_mare", w: 2 }],
    estate: [{ id: "sereno", w: 40 }, { id: "nebbia_leggera", w: 8 }, { id: "nebbia_costiera", w: 8 }, { id: "vento_forte", w: 12 }, { id: "mare_mosso", w: 12 }, { id: "pioggia_leggera", w: 10 }, { id: "caldo_intenso", w: 5 }, { id: "tempesta_elettrica", w: 3 }, { id: "tempesta_mare", w: 2 }],
    autunno: [{ id: "sereno", w: 22 }, { id: "nebbia_costiera", w: 15 }, { id: "nebbia_leggera", w: 8 }, { id: "vento_forte", w: 12 }, { id: "mare_mosso", w: 15 }, { id: "pioggia_leggera", w: 10 }, { id: "pioggia_battente", w: 8 }, { id: "tempesta_elettrica", w: 5 }, { id: "tempesta_mare", w: 5 }],
    inverno: [{ id: "sereno", w: 15 }, { id: "nebbia_costiera", w: 15 }, { id: "vento_forte", w: 12 }, { id: "tempesta_vento", w: 8 }, { id: "mare_mosso", w: 15 }, { id: "pioggia_battente", w: 12 }, { id: "tempesta_elettrica", w: 8 }, { id: "tempesta_mare", w: 12 }, { id: "neve_leggera", w: 3 }],
  },
};

// ── Catalogo completo effetti dettagliati ──
export const WEATHER_DETAILS: WeatherDetail[] = [
  { k: "pioggia_leggera", n: "Pioggia leggera", c: "precipitazioni", i: "lieve", vs: "Normale (svan. vista oltre 18 m)", mb: "Nessun effetto", sv: ["Sag (Percezione) basata sulla vista oltre 18 m"], va: [], id: { t: "n", d: "—" }, sp: ["Torce: difficili da mantenere accese", "Fuochi ordinari: Sopravvivenza CD 12 per mantenerli"] },
  { k: "pioggia_battente", n: "Pioggia battente", c: "precipitazioni", i: "moderata", vs: "9 m", mb: "Terreno difficile all'aperto (fango)", sv: ["Attacchi a distanza con armi", "Sag (Percezione) vista e udito", "Des (Furtività) visiva"], va: ["Sag (Sopravvivenza) per seguire tracce fresche nel fango"], id: { t: "ts", d: "Ogni 4h senza riparo → TS Cos CD 12 o +1 Ind." }, sp: ["Torce spente; fuochi all'aperto impossibili", "Tracce su terreno morbido rimangono visibili a lungo"] },
  { k: "grandine", n: "Grandine", c: "precipitazioni", i: "moderata", vs: "9 m", mb: "Terreno difficile all'aperto", sv: ["Attacchi a distanza", "Sag (Percezione) vista e udito"], va: [], id: { t: "n", d: "—" }, sp: ["Senza copertura: 1 danno contundente/round (intensa: 1d4)", "Rumore intenso: svantaggio aggiuntivo Percezione (udito)"] },
  { k: "tempesta_elettrica", n: "Tempesta elettrica", c: "precipitazioni", i: "grave", vs: "3 m", mb: "Terreno difficile all'aperto", sv: ["Attacchi a distanza con armi", "Sag (Percezione) vista e udito", "Tutti i check For all'aperto"], va: [], id: { t: "ts", d: "Ogni 2h all'aperto → TS Cos CD 14 o +1 Ind." }, sp: ["Volare impossibile", "Ogni 10 round all'aperto: TS Des CD 15 o 4d6 danni da fulmine", "Concentrazione: TS Cos CD 14 ogni round all'aperto", "Torce e fuochi impossibili"] },
  { k: "neve_leggera", n: "Neve leggera", c: "neve", i: "lieve", vs: "18 m (area leg. oscurata)", mb: "Terreno difficile in zone con neve profonda", sv: ["Sag (Percezione) vista"], va: ["Sag (Sopravvivenza) per seguire tracce nella neve"], id: { t: "ts", d: "Senza equip. freddo → TS Cos CD 10 ogni 4h o +1 Ind." }, sp: ["Le tracce rimangono visibili a lungo", "Rischio scivolamento in zone ghiacciate"] },
  { k: "freddo_pungente", n: "Freddo pungente", c: "neve", i: "moderata", vs: "Normale", mb: "Nessun effetto diretto", sv: ["Des (check con mani nude in esposizione prolungata)"], va: [], id: { t: "ts", d: "Senza equip. freddo → TS Cos CD 10 ogni 1h o +1 Ind." }, sp: ["Liquidi gelano in esposizione prolungata", "Respiro visibile: svantaggio Furtività in silenzio", "Oggetti metallici: rischio aderenza alla pelle"] },
  { k: "bufera_neve", n: "Bufera di neve", c: "neve", i: "estrema", vs: "1,5 m (cecità funzionale)", mb: "Terreno difficile; velocità dimezzata per tutti", sv: ["Tutti gli attacchi a distanza", "Sag (Percezione) vista e udito", "Sag (Sopravvivenza) orientamento"], va: [], id: { t: "a", d: "AUTOMATICO: +1 ogni 2h senza riparo; ogni 1h senza equip. freddo" }, sp: ["Orientamento: Sopravvivenza CD 18 ogni ora o ci si perde", "Concentrazione: TS Cos CD 15 per incantesimi all'aperto", "Rischio valanga in zone montuose"] },
  { k: "gelo_estremo", n: "Gelo estremo", c: "neve", i: "estrema", vs: "Normale", mb: "Terreno difficile (ghiaccio diffuso); velocità –3 m", sv: ["Tutti i check Des", "Tutti i check For con mani nude"], va: [], id: { t: "a", d: "AUTOMATICO: +1 ogni 1h senza equip.; equip. parziale → TS Cos CD 15 ogni 1h" }, sp: ["1d6 danni da freddo ogni ora senza protezione", "Scivolamento diffuso", "Vulnerabilità al freddo: danni raddoppiati"] },
  { k: "vento_forte", n: "Vento forte", c: "vento", i: "moderata", vs: "Normale", mb: "Nessun effetto diretto", sv: ["Attacchi a distanza con armi", "Sag (Percezione) udito"], va: [], id: { t: "n", d: "—" }, sp: ["Torce spente; nebbia/fumo si disperdono in 1d4 round", "Volare: TS Des CD 10 ogni round o caduta di 3 m"] },
  { k: "tempesta_vento", n: "Tempesta di vento", c: "vento", i: "grave", vs: "6 m (detriti in volo)", mb: "Terreno diff. (cr. Piccole); vel. ÷2 (cr. Medie)", sv: ["Attacchi a distanza", "Sag (Percezione) udito e vista", "For (cr. Piccole per restare in piedi)"], va: [], id: { t: "ts", d: "Ogni 4h senza riparo → TS Cos CD 12 o +1 Ind." }, sp: ["Cr. Piccole e inf.: TS For CD 12 ogni round o spinte 3 m + prone", "Volare impossibile", "Concentrazione: TS Cos CD 12"] },
  { k: "uragano", n: "Uragano", c: "vento", i: "estrema", vs: "1,5 m", mb: "Terreno difficile per tutti; vel. massima 6 m", sv: ["Tutti gli attacchi", "Tutti i check For e Des", "Sag (Percezione)"], va: [], id: { t: "a", d: "AUTOMATICO: +1 Indebolimento ogni 1h all'aperto" }, sp: ["Cr. Medie e inf.: TS For CD 16 ogni round o spinte 6 m + prone", "Detriti: 2d6 contr. (TS Des CD 14 per dimezzare) ogni 5 round", "Volare impossibile", "Concentrazione: TS Cos CD 16"] },
  { k: "nebbia_leggera", n: "Nebbia leggera", c: "visibilita", i: "lieve", vs: "18 m (area leg. oscurata)", mb: "Nessun effetto", sv: ["Sag (Percezione) vista oltre 18 m"], va: [], id: { t: "n", d: "—" }, sp: ["Furtività lievemente facilitata (copertura leggera)"] },
  { k: "nebbia_fitta", n: "Nebbia fitta", c: "visibilita", i: "grave", vs: "1,5 m (condizione Cieco)", mb: "Velocità ÷2 consigliata (rischio ostacoli)", sv: ["Tutti gli attacchi oltre 1,5 m (condizione Cieco)"], va: ["Il difensore ottiene vantaggio vs attaccante che non lo vede"], id: { t: "n", d: "—" }, sp: ["Condizione Cieco funzionale per attacchi oltre 1,5 m", "Navigazione: Sopravvivenza CD 15 ogni ora", "Imboscate: vantaggio automatico per chi attende in posizione"] },
  { k: "caldo_intenso", n: "Caldo intenso", c: "temperature", i: "moderata", vs: "Normale (miraggi a distanza)", mb: "Nessun effetto diretto", sv: ["Check For e Cos per sforzo prolungato (oltre 10 min)"], va: [], id: { t: "ts", d: "Ogni 1h senza acqua → TS Cos CD 15 (+2 CD/ora succ.) o +1 Ind." }, sp: ["Armature pesanti: CD Indebolimento aumentata di 3", "Miraggi possibili: Investigazione CD 12 per distinguere"] },
  { k: "arsura_estrema", n: "Arsura estrema", c: "temperature", i: "estrema", vs: "Normale con miraggi frequenti", mb: "Terreno difficile; velocità –3 m", sv: ["Check For, Cos e Sag", "Sag (Percezione) vista (calore distorcente)"], va: [], id: { t: "a", d: "AUTOMATICO: +1 ogni 1h senza acqua; acqua scarsa → TS Cos CD 15 ogni 1h" }, sp: ["Miraggi frequenti: Investigazione CD 14", "Senza acqua per 8h: TS Cos CD 15 ogni ora", "Trovare acqua: Sopravvivenza CD 18", "Armature pesanti: CD Indebolimento +5"] },
  { k: "tempesta_sabbia", n: "Tempesta di sabbia", c: "desertico", i: "estrema", vs: "3 m", mb: "Terreno difficile; velocità ÷2", sv: ["Tutti gli attacchi", "Sag (Percezione) vista", "Sag (Sopravvivenza) orientamento"], va: [], id: { t: "a", d: "AUTOMATICO ogni 1h senza protezione al volto; con protezione → TS Cos CD 13 ogni 1h" }, sp: ["1 danno tagliante/round senza protezione corporea", "Bussola inutile (interferenza particolato)", "Concentrazione: TS Cos CD 14", "Attrezzatura organica: CD 12 o deterioramento dopo 4h"] },
  { k: "mare_mosso", n: "Mare mosso", c: "marittimo", i: "moderata", vs: "Normale", mb: "A bordo: Acrobazia CD 12 per ogni azione oltre il movimento", sv: ["Acrobazia a bordo", "Attacchi a distanza dalla nave (rollio)"], va: [], id: { t: "n", d: "—" }, sp: ["Mal di mare: TS Cos CD 12 ogni 1h → fail: svantaggio su tutti i check fino a riposo breve", "Cadere in acqua: Atletica CD 15 ogni round per stare a galla", "Ipotermia in acque fredde: applica regole Freddo pungente"] },
  { k: "nebbia_costiera", n: "Nebbia costiera", c: "marittimo", i: "grave", vs: "6 m (area fortemente oscurata)", mb: "Navigazione: velocità max dimezzata", sv: ["Sag (Percezione) vista", "Strumenti Navigatore senza punti di riferimento"], va: ["Furtività in mare: vantaggio (navi difficilmente avvistate)"], id: { t: "n", d: "—" }, sp: ["Rischio collisione: Strumenti Navigatore CD 14 ogni ora o pericolo", "Imboscate navali facilitatissime"] },
  { k: "tempesta_mare", n: "Tempesta in mare", c: "marittimo", i: "estrema", vs: "3 m", mb: "A bordo: terreno difficile; nuotare impossibile", sv: ["Tutti gli attacchi", "Sag (Percezione)", "Acrobazia a bordo"], va: [], id: { t: "m", d: "All'aperto: TS Cos CD 14 ogni 2h o +1 Ind. | In acqua senza soccorso: AUTOMATICO +1 ogni 1h" }, sp: ["Rischio naufragio: Strumenti Navigatore CD 18 ogni ora", "Onde alte: 3d6 contr. (TS For CD 16 per dimezzare)", "Volare impossibile", "Concentrazione: TS Cos CD 15"] },
];

export const WEATHER_MAP: Record<string, WeatherDetail> = {};
WEATHER_DETAILS.forEach(d => { WEATHER_MAP[d.k] = d; });

export const BIOMES = [
  { id: 'temperato', label: 'Temperato' },
  { id: 'artico', label: 'Artico / Montagna' },
  { id: 'desertico', label: 'Desertico' },
  { id: 'marittimo', label: 'Marittimo' },
];

export const SEASONS = [
  { id: 'primavera', label: 'Primavera' },
  { id: 'estate', label: 'Estate' },
  { id: 'autunno', label: 'Autunno' },
  { id: 'inverno', label: 'Inverno' },
];

export const EFFECT_CATS: Record<string, string> = {
  precipitazioni: "Precipitazioni",
  neve: "Neve & Ghiaccio",
  vento: "Vento",
  visibilita: "Visibilità ridotta",
  temperature: "Temperature estreme",
  desertico: "Ambiente desertico",
  marittimo: "Ambiente marittimo",
};

export const INTENSITY_COLORS: Record<string, string> = {
  lieve: '#639922',
  moderata: '#BA7517',
  grave: '#D85A30',
  estrema: '#E24B4A',
};
