export type EventPhase = "12m" | "6m" | "3m" | "1m" | "1w" | "past";

/** Fases exibidas na barra de organização, da mais distante à véspera. */
export const EVENT_PHASES = ["12m", "6m", "3m", "1m", "1w"] as const;

/**
 * Mapeia os dias restantes até o evento para a fase de organização.
 * Puro (sem I/O) — seguro para usar em client components.
 */
export function getEventPhase(daysToEvent: number): EventPhase {
  if (daysToEvent < 0) return "past";
  if (daysToEvent <= 7) return "1w";
  if (daysToEvent <= 30) return "1m";
  if (daysToEvent <= 90) return "3m";
  if (daysToEvent <= 180) return "6m";
  return "12m";
}

/** Progresso 0..1 ao longo da jornada de ~12 meses até o evento. */
export function eventProgress(daysToEvent: number): number {
  if (daysToEvent <= 0) return 1;
  if (daysToEvent >= 365) return 0;
  return (365 - daysToEvent) / 365;
}
