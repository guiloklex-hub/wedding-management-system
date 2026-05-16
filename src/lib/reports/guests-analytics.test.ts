import { describe, it, expect } from "vitest";
import { buildGuestsAnalytics } from "./guests-analytics";

describe("buildGuestsAnalytics", () => {
  it("agrega RSVP corretamente", () => {
    const r = buildGuestsAnalytics(
      [
        {
          rsvpStatus: "CONFIRMED",
          plusOnesAllowed: 1,
          plusOnesConfirmed: 1,
          isChild: false,
          isVIP: true,
          isPadrinho: false,
          city: "São Paulo",
          groupId: "g1",
        },
        {
          rsvpStatus: "INVITED",
          plusOnesAllowed: 0,
          plusOnesConfirmed: 0,
          isChild: true,
          isVIP: false,
          isPadrinho: false,
          city: "São Paulo",
          groupId: null,
        },
        {
          rsvpStatus: "DECLINED",
          plusOnesAllowed: 1,
          plusOnesConfirmed: 0,
          isChild: false,
          isVIP: false,
          isPadrinho: true,
          city: null,
          groupId: "g1",
        },
      ],
      [{ id: "g1", name: "Família Noiva" }],
    );

    expect(r.byStatus).toEqual({ INVITED: 1, CONFIRMED: 1, DECLINED: 1, MAYBE: 0 });
    expect(r.children).toBe(1);
    expect(r.vipsConfirmed).toBe(1);
    expect(r.padrinhosConfirmed).toBe(0);
    expect(r.effectiveConfirmed).toBe(2);
    expect(r.byCity[0]).toEqual({ city: "São Paulo", count: 2 });
  });
});
