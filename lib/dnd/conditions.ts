/**
 * Condizioni D&D 5e — usate nel combat tracker
 */

export interface DndCondition {
  id: string;
  label: string;
  color: string;
}

export const CONDITIONS: DndCondition[] = [
  { id: "avvelenato", label: "Avvelenato", color: "#62b98a" },
  { id: "stordito", label: "Stordito", color: "#d8b45c" },
  { id: "paralizzato", label: "Paralizzato", color: "#ecca74" },
  { id: "accecato", label: "Accecato", color: "#6d5f8c" },
  { id: "assordato", label: "Assordato", color: "#7d6fa0" },
  { id: "spaventato", label: "Spaventato", color: "#a489dd" },
  { id: "affascinato", label: "Affascinato", color: "#d6647a" },
  { id: "incapacitato", label: "Incapacitato", color: "#e0809e" },
  { id: "prono", label: "Prono", color: "#9686b3" },
  { id: "trattenuto", label: "Trattenuto", color: "#82c4a0" },
  { id: "invisibile", label: "Invisibile", color: "#c0aee0" },
  { id: "pietrificato", label: "Pietrificato", color: "#8a7a5a" },
];

/**
 * Mappa rapida id → condizione
 */
export const CONDITION_MAP = Object.fromEntries(
  CONDITIONS.map((c) => [c.id, c])
) as Record<string, DndCondition>;
