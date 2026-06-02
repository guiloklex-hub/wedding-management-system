import { describe, it, expect } from "vitest";
import {
  buildSaveTheDateRecipients,
  joinNames,
  type RecipientSourceGroup,
  type RecipientSourceGuest,
} from "./recipients";

describe("joinNames", () => {
  it("formats one, two and three+ names", () => {
    expect(joinNames(["Ana"])).toBe("Ana");
    expect(joinNames(["Ana", "Lucas"])).toBe("Ana e Lucas");
    expect(joinNames(["Ana", "Beto", "Lucas"])).toBe("Ana, Beto e Lucas");
  });

  it("ignores empty entries", () => {
    expect(joinNames(["Ana", "", "  "])).toBe("Ana");
    expect(joinNames([])).toBe("");
  });
});

describe("buildSaveTheDateRecipients", () => {
  const group = (over: Partial<RecipientSourceGroup>): RecipientSourceGroup => ({
    id: "g1",
    name: "Família Silva",
    contactPhone: "+5511999990000",
    contactEmail: null,
    memberNames: ["Ana", "Lucas"],
    ...over,
  });
  const guest = (over: Partial<RecipientSourceGuest>): RecipientSourceGuest => ({
    id: "u1",
    name: "Convidado",
    phone: "+5511888880000",
    email: null,
    language: null,
    ...over,
  });

  it("one message per group citing members, one per ungrouped guest", () => {
    const out = buildSaveTheDateRecipients([group({})], [guest({})]);
    expect(out).toHaveLength(2);
    const grp = out.find((r) => r.refType === "GuestGroup")!;
    expect(grp.status).toBe("PENDING");
    expect(grp.memberNames).toBe("Ana e Lucas");
    const gst = out.find((r) => r.refType === "Guest")!;
    expect(gst.status).toBe("PENDING");
    expect(gst.memberNames).toBe("Convidado");
  });

  it("skips recipients without phone and without email", () => {
    const out = buildSaveTheDateRecipients(
      [group({ contactPhone: null, contactEmail: null })],
      [guest({ phone: null, email: null })],
    );
    expect(out.every((r) => r.status === "SKIPPED" && r.skipReason === "NO_CONTACT")).toBe(true);
  });

  it("keeps a recipient that has only email", () => {
    const out = buildSaveTheDateRecipients(
      [group({ contactPhone: null, contactEmail: "fam@example.com" })],
      [],
    );
    expect(out[0].status).toBe("PENDING");
  });

  it("deduplicates a phone shared between a group and an ungrouped guest", () => {
    const out = buildSaveTheDateRecipients(
      [group({ contactPhone: "+55 11 99999-0000" })],
      [guest({ phone: "5511999990000" })],
    );
    expect(out[0].status).toBe("PENDING");
    expect(out[1].status).toBe("SKIPPED");
    expect(out[1].skipReason).toBe("DUPLICATE_PHONE");
  });

  it("falls back to group name when there are no members", () => {
    const out = buildSaveTheDateRecipients([group({ memberNames: [] })], []);
    expect(out[0].memberNames).toBe("Família Silva");
  });
});
