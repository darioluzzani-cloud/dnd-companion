/**
 * Tabelle slot incantesimo per tipo di caster (D&D 5e)
 * 
 * Indice = livello del personaggio (0 = non usato, 1-20)
 * Ogni array interno: [slot_livello_1, slot_livello_2, ..., slot_livello_9]
 * undefined/null = non ha slot a quel livello
 */

type SlotTable = (number[] | null)[];

export const SPELL_SLOTS: Record<"full" | "half" | "third", SlotTable> = {
  full: [
    null,           // 0 (non usato)
    [2],            // Lv 1
    [3],            // Lv 2
    [4, 2],         // Lv 3
    [4, 3],         // Lv 4
    [4, 3, 2],      // Lv 5
    [4, 3, 3],      // Lv 6
    [4, 3, 3, 1],   // Lv 7
    [4, 3, 3, 2],   // Lv 8
    [4, 3, 3, 3, 1],         // Lv 9
    [4, 3, 3, 3, 2],         // Lv 10
    [4, 3, 3, 3, 2, 1],      // Lv 11
    [4, 3, 3, 3, 2, 1],      // Lv 12
    [4, 3, 3, 3, 2, 1, 1],   // Lv 13
    [4, 3, 3, 3, 2, 1, 1],   // Lv 14
    [4, 3, 3, 3, 2, 1, 1, 1],     // Lv 15
    [4, 3, 3, 3, 2, 1, 1, 1],     // Lv 16
    [4, 3, 3, 3, 2, 1, 1, 1, 1],  // Lv 17
    [4, 3, 3, 3, 3, 1, 1, 1, 1],  // Lv 18
    [4, 3, 3, 3, 3, 2, 1, 1, 1],  // Lv 19
    [4, 3, 3, 3, 3, 2, 2, 1, 1],  // Lv 20
  ],

  half: [
    null,           // 0
    [],             // Lv 1 - nessuno slot
    [2],            // Lv 2
    [3],            // Lv 3
    [3],            // Lv 4
    [4, 2],         // Lv 5
    [4, 2],         // Lv 6
    [4, 3],         // Lv 7
    [4, 3],         // Lv 8
    [4, 3, 2],      // Lv 9
    [4, 3, 2],      // Lv 10
    [4, 3, 3],      // Lv 11
    [4, 3, 3],      // Lv 12
    [4, 3, 3, 1],   // Lv 13
    [4, 3, 3, 1],   // Lv 14
    [4, 3, 3, 2],   // Lv 15
    [4, 3, 3, 2],   // Lv 16
    [4, 3, 3, 3, 1],// Lv 17
    [4, 3, 3, 3, 1],// Lv 18
    [4, 3, 3, 3, 2],// Lv 19
    [4, 3, 3, 3, 2],// Lv 20
  ],

  third: [
    null,           // 0
    [],             // Lv 1
    [],             // Lv 2
    [2],            // Lv 3
    [3],            // Lv 4
    [3],            // Lv 5
    [3],            // Lv 6
    [4, 2],         // Lv 7
    [4, 2],         // Lv 8
    [4, 2],         // Lv 9
    [4, 3],         // Lv 10
    [4, 3],         // Lv 11
    [4, 3],         // Lv 12
    [4, 3, 2],      // Lv 13
    [4, 3, 2],      // Lv 14
    [4, 3, 2],      // Lv 15
    [4, 3, 3],      // Lv 16
    [4, 3, 3],      // Lv 17
    [4, 3, 3],      // Lv 18
    [4, 3, 3, 1],   // Lv 19
    [4, 3, 3, 1],   // Lv 20
  ],
};

export type CasterType = "full" | "half" | "third" | "none";

/**
 * Restituisce gli slot totali per un personaggio dato il tipo di caster e il livello.
 * Record<slotLevel, totalSlots> — es. { 1: 4, 2: 3, 3: 2 }
 */
export function getSlotTotals(
  casterType: CasterType,
  level: number
): Record<number, number> {
  if (casterType === "none") return {};

  const table = SPELL_SLOTS[casterType];
  const lv = Math.max(1, Math.min(20, level));
  const slots = table[lv] || [];

  const result: Record<number, number> = {};
  slots.forEach((count, index) => {
    if (count > 0) {
      result[index + 1] = count;
    }
  });

  return result;
}
