/**
 * Calendario della Marca di Velmora
 * 12 mesi × 30 giorni = 360 giorni · settimana di 6 giorni (il 6º è mercato)
 * Gli anni si contano "dal Vespro" (d.V.) — evento fondativo non precisato.
 * Nomi popolari fenomenologici; la Gilda numera i mesi ("il nono mese").
 */

import { DT } from '@/lib/dnd/weather';

export interface VelmoraDate {
  year: number;   // anno d.V.
  month: number;  // 1-12
  day: number;    // 1-30
}

export interface CalendarState {
  date: VelmoraDate;
  biome: string;          // bioma corrente della compagnia (per il tiro meteo giornaliero)
  weatherKey?: string;    // meteo del giorno (chiave di COND in weather.ts)
  weatherRoll?: number;   // il d100 tirato
}

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_WEEK = 6;

export interface VelmoraMonth {
  n: number;        // numerazione di Gilda (1-12)
  name: string;     // nome popolare esteso
  short: string;    // forma breve
  season: string;   // id stagione di weather.ts
}

export const MONTHS: VelmoraMonth[] = [
  { n: 1,  name: 'mese del Disgelo',   short: 'Disgelo',  season: 'primavera' },
  { n: 2,  name: 'mese della Semina',  short: 'Semina',   season: 'primavera' },
  { n: 3,  name: 'mese dei Germogli',  short: 'Germogli', season: 'primavera' },
  { n: 4,  name: 'mese del Fieno',     short: 'Fieno',    season: 'estate' },
  { n: 5,  name: 'mese delle Spighe',  short: 'Spighe',   season: 'estate' },
  { n: 6,  name: 'mese delle Falci',   short: 'Falci',    season: 'estate' },
  { n: 7,  name: 'mese del Mosto',     short: 'Mosto',    season: 'autunno' },
  { n: 8,  name: 'mese delle Nebbie',  short: 'Nebbie',   season: 'autunno' },
  { n: 9,  name: 'mese della Pioggia', short: 'Pioggia',  season: 'autunno' },
  { n: 10, name: 'mese del Gelo',      short: 'Gelo',     season: 'inverno' },
  { n: 11, name: 'mese dei Lupi',      short: 'Lupi',     season: 'inverno' },
  { n: 12, name: 'mese della Fame',    short: 'Fame',     season: 'inverno' },
];

export interface Festivity {
  month: number;
  day: number;
  name: string;
  desc: string;
}

export const FESTIVITIES: Festivity[] = [
  { month: 2, day: 1,  name: 'Il Primo Solco',
    desc: "Benedizione degli attrezzi e apertura dell'anno agricolo." },
  { month: 7, day: 1,  name: 'Il Saldo',
    desc: "La Gilda delle Bilance chiude i conti dell'anno: decime, contratti, carovane in arrivo." },
  { month: 9, day: 30, name: 'I Ritorni',
    desc: "La festa di Mira: chi ha viaggiato si conta al santuario, un lume per chi non è tornato." },
];

export const DEFAULT_CALENDAR: CalendarState = {
  date: { year: 447, month: 10, day: 8 },
  biome: 'temperato',
};

export function monthInfo(m: number): VelmoraMonth {
  return MONTHS[Math.min(MONTHS_PER_YEAR, Math.max(1, m)) - 1];
}

export function seasonForMonth(m: number): string {
  return monthInfo(m).season;
}

// Indice assoluto in giorni dall'anno 0 — usato per aritmetica e distanze
export function absDay(d: VelmoraDate): number {
  return ((d.year * MONTHS_PER_YEAR) + (d.month - 1)) * DAYS_PER_MONTH + (d.day - 1);
}

export function addDays(d: VelmoraDate, n: number): VelmoraDate {
  let total = absDay(d) + n;
  if (total < 0) total = 0;
  const day = (total % DAYS_PER_MONTH) + 1;
  const monthsTotal = Math.floor(total / DAYS_PER_MONTH);
  const month = (monthsTotal % MONTHS_PER_YEAR) + 1;
  const year = Math.floor(monthsTotal / MONTHS_PER_YEAR);
  return { year, month, day };
}

export function formatDate(d: VelmoraDate): string {
  return `${d.day} del ${monthInfo(d.month).name}, ${d.year} d.V.`;
}

export function formatDateShort(d: VelmoraDate): string {
  return `${d.day} ${monthInfo(d.month).short} · ${d.year} d.V.`;
}

export function festivityOn(d: VelmoraDate): Festivity | null {
  return FESTIVITIES.find(f => f.month === d.month && f.day === d.day) || null;
}

export function isMarketDay(d: VelmoraDate): boolean {
  return d.day % DAYS_PER_WEEK === 0;
}

export function nextFestivities(d: VelmoraDate, count = 3): { fest: Festivity; date: VelmoraDate; inDays: number }[] {
  const today = absDay(d);
  const out: { fest: Festivity; date: VelmoraDate; inDays: number }[] = [];
  for (let y = d.year; out.length < count && y <= d.year + 2; y++) {
    for (const f of FESTIVITIES) {
      const fd = { year: y, month: f.month, day: f.day };
      const diff = absDay(fd) - today;
      if (diff > 0) out.push({ fest: f, date: fd, inDays: diff });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays).slice(0, count);
}

/**
 * Tiro meteo giornaliero: d100 cumulato sui pesi della tabella bioma×stagione.
 * Stessa meccanica del popup Meteo (WeatherPopup.doRoll).
 */
export function rollDailyWeather(biome: string, season: string): { key: string; roll: number } {
  const rows = (DT[biome] && DT[biome][season]) || DT['temperato']['primavera'];
  const roll = Math.floor(Math.random() * 100) + 1;
  let cum = 0;
  for (const r of rows) {
    cum += r.w;
    if (roll <= cum) return { key: r.id, roll };
  }
  return { key: rows[rows.length - 1].id, roll };
}
