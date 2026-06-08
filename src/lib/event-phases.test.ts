import { describe, it, expect } from "vitest";
import { getEventPhase, eventProgress, EVENT_PHASES } from "./event-phases";

describe("getEventPhase", () => {
  it("mapeia os dias restantes para a fase correta", () => {
    expect(getEventPhase(400)).toBe("12m");
    expect(getEventPhase(181)).toBe("12m");
    expect(getEventPhase(180)).toBe("6m");
    expect(getEventPhase(91)).toBe("6m");
    expect(getEventPhase(90)).toBe("3m");
    expect(getEventPhase(31)).toBe("3m");
    expect(getEventPhase(30)).toBe("1m");
    expect(getEventPhase(8)).toBe("1m");
    expect(getEventPhase(7)).toBe("1w");
    expect(getEventPhase(0)).toBe("1w");
    expect(getEventPhase(-1)).toBe("past");
  });

  it("todas as fases retornáveis (exceto past) estão em EVENT_PHASES", () => {
    for (const d of [400, 120, 60, 20, 3]) {
      expect(EVENT_PHASES).toContain(getEventPhase(d) as (typeof EVENT_PHASES)[number]);
    }
  });
});

describe("eventProgress", () => {
  it("0 quando longe (>=365), 1 no dia/passado, meio no meio do caminho", () => {
    expect(eventProgress(365)).toBe(0);
    expect(eventProgress(0)).toBe(1);
    expect(eventProgress(-5)).toBe(1);
    expect(eventProgress(182.5)).toBeCloseTo(0.5, 1);
  });
});
