import { describe, expect, it } from "vitest";
import { preserveAndroidFields } from "./portable-export";
import type { MobileRecord } from "./portable-projection";

function record(): MobileRecord {
  return {
    id: "record-1", kind: "guest", title: "Ana", subtitle: "Grupo do aplicativo",
    amountCents: 42, estimatedCents: null, date: "2026-09-27", status: "INVITED",
    parentId: null, guestGroupId: null, seatingTableId: null,
    plusOnesAllowed: 0, plusOnesConfirmed: 0, phone: "", email: "", notes: "",
    extraJson: JSON.stringify({ mobileOnly: "guardado", rsvpPin: "web-original" }),
    createdAt: 1000, updatedAt: 1000, deletedAt: null,
  };
}

describe("projeção web após importação Android", () => {
  it("aplica edições web e conserva campos exclusivos móveis", () => {
    const android = record();
    const projected = {
      ...record(), title: "Ana no web", status: "CONFIRMED", updatedAt: 2000,
      subtitle: "", amountCents: null, date: null,
      extraJson: JSON.stringify({ rsvpPin: "web-atualizado" }),
    };
    const result = preserveAndroidFields(projected, android);
    expect(result).toMatchObject({ title: "Ana no web", status: "CONFIRMED", updatedAt: 2000,
      subtitle: "Grupo do aplicativo", amountCents: 42, date: "2026-09-27" });
    expect(JSON.parse(result.extraJson)).toEqual({ mobileOnly: "guardado", rsvpPin: "web-atualizado" });
  });
});
