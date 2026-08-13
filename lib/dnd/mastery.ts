// ─── PADRONANZE D'ARMA (regolamento 2024) ────────────────────
// Le otto padronanze canoniche, con i nomi dell'edizione italiana.
//
// Il catalogo vive nello stato della campagna (`masteries`) e non sul
// singolo oggetto: l'arma registra soltanto il riferimento alla voce, così
// correggendo una descrizione la si aggiorna ovunque, invece di lasciare
// otto copie divergenti sparse per gli inventari. Il DM può modificare i
// testi e aggiungerne di propri dall'Armeria.
//
// L'accesso è la seconda metà del meccanismo: nel regolamento la padronanza
// è una proprietà dell'arma, ma il personaggio la sfrutta solo se la sua
// classe gliene concede l'uso e se quell'arma rientra fra quelle scelte.
// Perciò il personaggio dichiara nei Talenti con quali armi ha padronanza
// (`masteryWeapons`), e la scheda dell'oggetto mostra la padronanza accesa
// o spenta di conseguenza.

export interface MasteryEntry {
  id: string;
  name: string;
  desc: string;
  custom?: boolean;   // aggiunta dal DM, non fa parte delle otto canoniche
}

export const DEFAULT_MASTERIES: MasteryEntry[] = [
  { id: 'm-striscio', name: 'Colpo di striscio', desc: 'Se il tiro per colpire manca il bersaglio, questi subisce comunque danni pari al modificatore della caratteristica usata per il tiro. Il tipo di danno è quello dell\'arma, e non si applicano bonus di alcun genere a questo danno.' },
  { id: 'm-fendente', name: 'Doppio fendente', desc: 'Se si colpisce una creatura con un attacco con arma corpo a corpo, si può effettuare un ulteriore attacco con la stessa arma contro una seconda creatura entro 1,5 metri dalla prima e a portata. Il secondo tiro per colpire usa lo stesso bonus del primo, ma il danno non beneficia del modificatore di caratteristica, salvo che sia negativo. Si può usare una sola volta per turno.' },
  { id: 'm-graffio', name: 'Graffio', desc: 'Quando si effettua l\'attacco extra concesso dall\'azione di Attacco con un\'arma leggera, quell\'attacco può essere svolto come parte della stessa azione anziché come azione bonus. Si può usare una sola volta per turno.' },
  { id: 'm-lentezza', name: 'Lentezza', desc: 'Se si colpisce una creatura con questa arma e le si infliggono danni, la sua velocità è ridotta di 3 metri fino all\'inizio del proprio turno successivo. Se la creatura viene colpita più volte, l\'effetto non si cumula.' },
  { id: 'm-prosciugamento', name: 'Prosciugamento', desc: 'Se si colpisce una creatura con questa arma e le si infliggono danni, quella creatura subisce svantaggio al suo prossimo tiro per colpire, fino alla fine del proprio turno successivo.' },
  { id: 'm-rovesciamento', name: 'Rovesciamento', desc: 'Se si colpisce una creatura con questa arma e le si infliggono danni, si può costringerla a effettuare un tiro salvezza su Costituzione. La CD è 8 + modificatore della caratteristica usata per l\'attacco + bonus di competenza. Se il tiro fallisce, la creatura cade a terra prona.' },
  { id: 'm-spinta', name: 'Spinta', desc: 'Se si colpisce una creatura con questa arma e le si infliggono danni, la si può spingere fino a 3 metri di distanza da sé, purché la sua taglia sia Grande o inferiore.' },
  { id: 'm-vessazione', name: 'Vessazione', desc: 'Se si colpisce una creatura con questa arma e le si infliggono danni, si ottiene vantaggio al prossimo tiro per colpire contro quella stessa creatura, entro la fine del proprio turno successivo.' },
];

/** Catalogo effettivo: quello redatto dal DM, o le otto canoniche se assente. */
export function masteriesOf(s: any): MasteryEntry[] {
  const list = (s as any)?.masteries;
  return Array.isArray(list) && list.length ? list : DEFAULT_MASTERIES;
}

export function masteryById(s: any, id?: string): MasteryEntry | undefined {
  return id ? masteriesOf(s).find(m => m.id === id) : undefined;
}

/** Confronto tollerante fra nomi d'arma: ignora maiuscole e spazi in eccesso. */
export const normWeapon = (n?: string) => (n || '').trim().toLowerCase();

/**
 * Il personaggio può sfruttare la padronanza di quest'arma?
 * Vero se il nome dell'arma figura fra quelle dichiarate nei Talenti.
 */
export function canUseMastery(player: any, item: any): boolean {
  const list: string[] = (player?.masteryWeapons || []).map(normWeapon);
  return list.includes(normWeapon(item?.name));
}
