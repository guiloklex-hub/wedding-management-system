import { describe, it, expect } from "vitest";
import {
  buildAnnouncementRecipients,
  guestMatchesAudience,
  type AnnouncementSourceGroup,
  type AnnouncementSourceGuest,
  type BuildAnnouncementInput,
} from "./announcement-recipients";
import { DEFAULT_AUDIENCE, type Audience } from "./announcement-config";

function guest(over: Partial<AnnouncementSourceGuest> & { id: string }): AnnouncementSourceGuest {
  return {
    name: over.id,
    groupId: null,
    rsvpStatus: "CONFIRMED",
    side: null,
    isPadrinho: false,
    tagIds: [],
    language: null,
    phone: null,
    email: null,
    hasPin: true,
    ...over,
  };
}

function group(over: Partial<AnnouncementSourceGroup> & { id: string }): AnnouncementSourceGroup {
  return { name: over.id, contactPhone: null, contactEmail: null, hasPin: true, ...over };
}

function build(over: Partial<BuildAnnouncementInput>) {
  return buildAnnouncementRecipients({
    groups: [],
    guests: [],
    audience: DEFAULT_AUDIENCE,
    channel: "AUTO",
    excludedRefs: [],
    requirePin: false,
    defaultLocale: "pt-BR",
    ...over,
  });
}

const aud = (over: Partial<Audience>): Audience => ({ ...DEFAULT_AUDIENCE, ...over });

describe("guestMatchesAudience", () => {
  it("NOT_INVITED nunca entra, mesmo pedindo todos os status", () => {
    const all = aud({ rsvpStatuses: ["CONFIRMED", "INVITED", "MAYBE", "DECLINED"] });
    expect(guestMatchesAudience(guest({ id: "a", rsvpStatus: "NOT_INVITED" }), all)).toBe(false);
    expect(guestMatchesAudience(guest({ id: "b", rsvpStatus: "DECLINED" }), all)).toBe(true);
  });

  it("tags de inclusão (qualquer) e exclusão", () => {
    const g = guest({ id: "a", tagIds: ["fam", "trab"] });
    expect(guestMatchesAudience(g, aud({ includeTagIds: ["fam"] }))).toBe(true);
    expect(guestMatchesAudience(g, aud({ includeTagIds: ["amigos"] }))).toBe(false);
    expect(guestMatchesAudience(g, aud({ excludeTagIds: ["trab"] }))).toBe(false);
  });

  it("lado UNSET casa com lado vazio ou desconhecido", () => {
    expect(guestMatchesAudience(guest({ id: "a" }), aud({ sides: ["UNSET"] }))).toBe(true);
    expect(guestMatchesAudience(guest({ id: "b", side: "NOIVA" }), aud({ sides: ["UNSET"] }))).toBe(false);
    expect(guestMatchesAudience(guest({ id: "c", side: "NOIVA" }), aud({ sides: ["NOIVA"] }))).toBe(true);
  });

  it("modos de padrinhos", () => {
    const p = guest({ id: "p", isPadrinho: true });
    const n = guest({ id: "n" });
    expect(guestMatchesAudience(p, aud({ padrinhos: "ONLY" }))).toBe(true);
    expect(guestMatchesAudience(n, aud({ padrinhos: "ONLY" }))).toBe(false);
    expect(guestMatchesAudience(p, aud({ padrinhos: "EXCLUDE" }))).toBe(false);
  });
});

describe("buildAnnouncementRecipients", () => {
  it("família parcialmente confirmada cita só os confirmados e usa o contato do grupo", () => {
    const { rows, summary } = build({
      groups: [group({ id: "g1", name: "Família Silva", contactPhone: "11 98888-7777" })],
      guests: [
        guest({ id: "ana", name: "Ana", groupId: "g1" }),
        guest({ id: "beto", name: "Beto", groupId: "g1", rsvpStatus: "INVITED" }),
        guest({ id: "caio", name: "Caio", groupId: "g1" }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      refType: "GuestGroup",
      refId: "g1",
      members: ["Ana", "Caio"],
      memberNames: "Ana e Caio",
      phone: "+5511988887777",
      plannedChannel: "WHATSAPP",
      status: "PENDING",
    });
    expect(summary.guestsReached).toBe(2);
  });

  it("família sem nenhum membro elegível fica fora da lista", () => {
    const { rows } = build({
      groups: [group({ id: "g1", contactPhone: "11988887777" })],
      guests: [guest({ id: "a", groupId: "g1", rsvpStatus: "DECLINED" })],
    });
    expect(rows).toHaveLength(0);
  });

  it("contato cai para o membro elegível e depois para qualquer membro", () => {
    const { rows } = build({
      groups: [group({ id: "g1" })],
      guests: [
        guest({ id: "a", groupId: "g1", rsvpStatus: "INVITED", phone: "11911112222" }),
        guest({ id: "b", groupId: "g1", phone: null, email: "B@X.COM " }),
      ],
    });
    expect(rows[0].phone).toBe("+5511911112222");
    expect(rows[0].email).toBe("b@x.com");
  });

  it("groupId órfão vira convidado avulso", () => {
    const { rows } = build({
      guests: [guest({ id: "a", groupId: "sumiu", phone: "11911112222" })],
    });
    expect(rows[0]).toMatchObject({ refType: "Guest", refId: "a" });
  });

  it("exclusão manual tira a família e libera o telefone duplicado", () => {
    const groups = [group({ id: "g1", name: "A", contactPhone: "11911112222" })];
    const guests = [
      guest({ id: "x", groupId: "g1" }),
      guest({ id: "solo", name: "Solo", phone: "11911112222" }),
    ];
    const before = build({ groups, guests, channel: "WHATSAPP" });
    expect(before.rows.find((r) => r.refId === "solo")?.skipReason).toBe("DUPLICATE_PHONE");

    const after = build({ groups, guests, channel: "WHATSAPP", excludedRefs: ["GuestGroup:g1"] });
    expect(after.rows.find((r) => r.refId === "g1")?.skipReason).toBe("MANUAL_EXCLUDED");
    expect(after.rows.find((r) => r.refId === "solo")?.status).toBe("PENDING");
    expect(after.summary).toMatchObject({ pending: 1, manualExcluded: 1, skipped: 0 });
  });

  it("motivos de exclusão por canal", () => {
    const guests = [
      guest({ id: "sem", name: "A" }),
      guest({ id: "inv", name: "B", phone: "123" }),
      guest({ id: "mail", name: "C", email: "c@x.com" }),
    ];
    const wa = build({ guests, channel: "WHATSAPP" }).rows.map((r) => r.skipReason);
    expect(wa).toEqual(["NO_PHONE", "INVALID_PHONE", "NO_PHONE"]);
    const em = build({ guests, channel: "EMAIL" }).rows.map((r) => r.skipReason);
    expect(em).toEqual(["NO_EMAIL", "NO_EMAIL", null]);
    const auto = build({ guests, channel: "AUTO" }).rows.map((r) => r.skipReason);
    expect(auto).toEqual(["NO_CONTACT", "INVALID_PHONE", null]);
  });

  it("canal só WhatsApp não guarda e-mail de reserva; só e-mail descarta telefone", () => {
    const guests = [guest({ id: "a", phone: "11911112222", email: "a@x.com" })];
    expect(build({ guests, channel: "WHATSAPP" }).rows[0]).toMatchObject({ email: null });
    expect(build({ guests, channel: "EMAIL" }).rows[0]).toMatchObject({ phone: null, plannedChannel: "EMAIL" });
    expect(build({ guests, channel: "AUTO" }).rows[0]).toMatchObject({
      phone: "+5511911112222",
      email: "a@x.com",
      plannedChannel: "WHATSAPP",
    });
  });

  it("AUTO usa o e-mail quando o telefone já foi usado; grupo tem prioridade", () => {
    const { rows } = build({
      groups: [group({ id: "g1", name: "Z", contactPhone: "11911112222" })],
      guests: [
        guest({ id: "m", groupId: "g1" }),
        guest({ id: "a", name: "A", phone: "11911112222", email: "a@x.com" }),
        guest({ id: "b", name: "B", phone: "11911112222" }),
      ],
    });
    expect(rows.map((r) => [r.refId, r.plannedChannel, r.skipReason])).toEqual([
      ["g1", "WHATSAPP", null],
      ["a", "EMAIL", null],
      ["b", null, "DUPLICATE_PHONE"],
    ]);
  });

  it("e-mail duplicado no canal EMAIL", () => {
    const { rows } = build({
      channel: "EMAIL",
      guests: [guest({ id: "a", name: "A", email: "x@x.com" }), guest({ id: "b", name: "B", email: "X@x.com" })],
    });
    expect(rows[1].skipReason).toBe("DUPLICATE_EMAIL");
  });

  it("NO_PIN só quando o texto exige PIN", () => {
    const guests = [guest({ id: "a", phone: "11911112222", hasPin: false })];
    expect(build({ guests }).rows[0].status).toBe("PENDING");
    expect(build({ guests, requirePin: true }).rows[0].skipReason).toBe("NO_PIN");
  });

  it("locale: primeiro membro elegível com idioma, senão o default", () => {
    const { rows } = build({
      groups: [group({ id: "g1", contactPhone: "11911112222" })],
      guests: [
        guest({ id: "a", name: "Ann", groupId: "g1" }),
        guest({ id: "b", name: "Bob", groupId: "g1", language: "en" }),
      ],
    });
    expect(rows[0].locale).toBe("en");
    expect(rows[0].memberNames).toBe("Ann and Bob");
    const solo = build({ guests: [guest({ id: "c", phone: "11911112222" })] });
    expect(solo.rows[0].locale).toBeNull();
  });
});
