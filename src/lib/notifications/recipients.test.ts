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
    memberContacts: [],
    memberTagIds: [],
    hasPadrinho: false,
    ...over,
  });
  const guest = (over: Partial<RecipientSourceGuest>): RecipientSourceGuest => ({
    id: "u1",
    name: "Convidado",
    phone: "+5511888880000",
    email: null,
    language: null,
    tagIds: [],
    isPadrinho: false,
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

  it("deduplicates a phone shared between a group and an ungrouped guest", () => {
    const out = buildSaveTheDateRecipients(
      [group({ contactPhone: "+55 11 99999-0000" })],
      [guest({ phone: "5511999990000" })],
    );
    expect(out[0].status).toBe("PENDING");
    expect(out[1].status).toBe("SKIPPED");
    expect(out[1].skipReason).toBe("DUPLICATE_PHONE");
  });

  it("normalizes phones to E.164 and preserves foreign DDI", () => {
    const out = buildSaveTheDateRecipients(
      [group({ id: "g1", contactPhone: "11999990000" })],
      [guest({ id: "u1", phone: "+34 600 123 456" })],
    );
    expect(out[0].phone).toBe("+5511999990000");
    expect(out[1].phone).toBe("+34600123456");
  });

  it("excludes a group if ANY member has an excluded tag", () => {
    const out = buildSaveTheDateRecipients(
      [group({ memberTagIds: ["t-padrinho", "t-amigo"] })],
      [guest({ tagIds: ["t-amigo"] })],
      { excludeTagIds: ["t-padrinho"] },
    );
    expect(out[0].status).toBe("SKIPPED");
    expect(out[0].skipReason).toBe("EXCLUDED_TAG");
    expect(out[1].status).toBe("PENDING");
  });

  it("excludes by padrinho flag when enabled", () => {
    const out = buildSaveTheDateRecipients(
      [group({ hasPadrinho: true })],
      [guest({ isPadrinho: true })],
      { excludePadrinhos: true },
    );
    expect(out.every((r) => r.skipReason === "EXCLUDED_TAG")).toBe(true);
  });

  it("skips recipients already sent in a previous broadcast", () => {
    const out = buildSaveTheDateRecipients([group({ id: "g1" })], [guest({ id: "u1" })], {
      alreadySentKeys: new Set(["GuestGroup:g1"]),
    });
    expect(out[0].skipReason).toBe("ALREADY_SENT");
    expect(out[1].status).toBe("PENDING");
  });

  it("tag exclusion takes priority over already-sent and contact checks", () => {
    const out = buildSaveTheDateRecipients(
      [group({ id: "g1", contactPhone: null, contactEmail: null, memberTagIds: ["x"] })],
      [],
      { excludeTagIds: ["x"], alreadySentKeys: new Set(["GuestGroup:g1"]) },
    );
    expect(out[0].skipReason).toBe("EXCLUDED_TAG");
  });

  it("falls back to group name when there are no members", () => {
    const out = buildSaveTheDateRecipients([group({ memberNames: [] })], []);
    expect(out[0].memberNames).toBe("Família Silva");
  });

  it("falls back to a member's phone when the group has no contact", () => {
    const out = buildSaveTheDateRecipients(
      [
        group({
          contactPhone: null,
          contactEmail: null,
          memberNames: ["Ana", "Lucas"],
          memberContacts: [
            { phone: null, email: null },
            { phone: "11999990000", email: null },
          ],
        }),
      ],
      [],
    );
    expect(out[0].status).toBe("PENDING");
    expect(out[0].phone).toBe("+5511999990000");
  });

  it("falls back to a member's email when the group has no contact and no member phone", () => {
    const out = buildSaveTheDateRecipients(
      [
        group({
          contactPhone: null,
          contactEmail: null,
          memberContacts: [{ phone: null, email: "ana@example.com" }],
        }),
      ],
      [],
    );
    expect(out[0].status).toBe("PENDING");
    expect(out[0].phone).toBeNull();
    expect(out[0].email).toBe("ana@example.com");
  });

  it("marks an unsendable phone as INVALID_PHONE when there is no email", () => {
    const out = buildSaveTheDateRecipients(
      [],
      [guest({ phone: "12345", email: null })],
    );
    expect(out[0].status).toBe("SKIPPED");
    expect(out[0].skipReason).toBe("INVALID_PHONE");
    expect(out[0].phone).toBeNull();
  });

  it("falls back to email when the phone is unsendable", () => {
    const out = buildSaveTheDateRecipients(
      [],
      [guest({ phone: "12345", email: "convidado@example.com" })],
    );
    expect(out[0].status).toBe("PENDING");
    expect(out[0].phone).toBeNull();
    expect(out[0].email).toBe("convidado@example.com");
  });
});
