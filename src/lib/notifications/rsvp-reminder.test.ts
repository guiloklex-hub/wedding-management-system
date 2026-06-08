import { describe, it, expect } from "vitest";
import {
  selectRsvpReminderTargets,
  type RsvpReminderGroupRow,
  type RsvpReminderGuestRow,
} from "./rsvp-reminder";

const DAY = 86_400_000;
const TODAY = new Date(Date.UTC(2026, 5, 8));
const OLD = new Date(TODAY.getTime() - 30 * DAY); // 30 dias atrás (elegível)
const RECENT = new Date(TODAY.getTime() - 2 * DAY); // recente (não elegível p/ days=7)

function run(
  groups: RsvpReminderGroupRow[],
  guests: RsvpReminderGuestRow[],
  alreadySent: string[] = [],
  days = 7,
) {
  return selectRsvpReminderTargets({
    groups,
    guests,
    days,
    today: TODAY,
    defaultLocale: "pt-BR",
    alreadySent: new Set(alreadySent),
  });
}

const guest = (over: Partial<RsvpReminderGuestRow> = {}): RsvpReminderGuestRow => ({
  id: "g1",
  name: "Ana",
  phone: "11999990000",
  email: null,
  language: null,
  rsvpStatus: "INVITED",
  rsvpToken: "tok-ana",
  createdAt: OLD,
  ...over,
});

const group = (over: Partial<RsvpReminderGroupRow> = {}): RsvpReminderGroupRow => ({
  id: "grp1",
  name: "Família Silva",
  contactName: null,
  contactPhone: "1188888000",
  contactEmail: null,
  rsvpToken: "tok-grp",
  createdAt: OLD,
  guests: [{ name: "Beto", phone: null, email: null, rsvpStatus: "INVITED" }],
  ...over,
});

describe("selectRsvpReminderTargets", () => {
  it("inclui convidado avulso INVITED, antigo, com telefone válido", () => {
    const out = run([], [guest({ phone: "11999990000" })]);
    expect(out).toHaveLength(1);
    expect(out[0].refType).toBe("Guest");
    expect(out[0].kind).toBe("RSVP_REMINDER");
    expect(out[0].phone).toBe("+5511999990000");
    expect(out[0].daysInvitedSince).toBe(30);
  });

  it("ignora convidado convidado recentemente (< days)", () => {
    expect(run([], [guest({ createdAt: RECENT })])).toHaveLength(0);
  });

  it("ignora convidado que já respondeu", () => {
    expect(run([], [guest({ rsvpStatus: "CONFIRMED" })])).toHaveLength(0);
  });

  it("ignora quem não tem contato algum", () => {
    expect(run([], [guest({ phone: null, email: null })])).toHaveLength(0);
  });

  it("respeita o conjunto alreadySent", () => {
    expect(run([], [guest({ id: "g1" })], ["RSVP_REMINDER:Guest:g1"])).toHaveLength(0);
  });

  it("inclui grupo com membro pendente usando o contato do grupo", () => {
    const out = run([group({ contactPhone: "1188888000" })], []);
    expect(out).toHaveLength(1);
    expect(out[0].refType).toBe("GuestGroup");
    expect(out[0].phone).toBe("+551188888000");
    expect(out[0].memberNames).toBe("Beto");
  });

  it("grupo sem contato cai para o telefone do 1º integrante", () => {
    const out = run([
      group({
        contactPhone: null,
        contactEmail: null,
        guests: [
          { name: "Beto", phone: "abc", email: null, rsvpStatus: "INVITED" },
          { name: "Carla", phone: "11977770000", email: null, rsvpStatus: "INVITED" },
        ],
      }),
    ], []);
    expect(out).toHaveLength(1);
    expect(out[0].phone).toBe("+5511977770000");
    expect(out[0].memberNames).toBe("Beto e Carla");
  });

  it("ignora grupo sem ninguém pendente", () => {
    const out = run([
      group({ guests: [{ name: "Beto", phone: null, email: null, rsvpStatus: "CONFIRMED" }] }),
    ], []);
    expect(out).toHaveLength(0);
  });

  it("deduplica telefone entre grupo e avulso (grupo tem prioridade)", () => {
    const out = run(
      [group({ contactPhone: "+5511999990000" })],
      [guest({ id: "g1", phone: "5511999990000" })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].refType).toBe("GuestGroup");
  });

  it("usa o locale do convidado quando definido", () => {
    const out = run([], [guest({ language: "es" })]);
    expect(out[0].locale).toBe("es");
  });
});
