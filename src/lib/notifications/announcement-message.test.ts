import { describe, it, expect } from "vitest";
import {
  announcementUsesTag,
  findUnknownAnnouncementTags,
  renderAnnouncementText,
  type AnnouncementTagValues,
} from "./announcement-message";
import { parseAnnouncementPayload, newAnnouncementConfig, AnnouncementDraftInputSchema } from "./announcement-config";

const values: AnnouncementTagValues = {
  nomes: "Ana & Beto",
  convidados: "Carla e Davi",
  data: "12 de dezembro de 2026",
  local: "Sítio Bela Vista",
  site: "https://site.com",
  "site-presentes": "https://presentes.com",
  "link-rsvp": "https://app/rsvp/abc",
  pin: "1234",
};

describe("renderAnnouncementText", () => {
  it("aceita texto sem nenhuma tag", () => {
    expect(renderAnnouncementText("Lembrete: traje esporte fino.", values)).toBe(
      "Lembrete: traje esporte fino.",
    );
  });

  it("substitui tags conhecidas e mantém as desconhecidas", () => {
    const out = renderAnnouncementText("Oi {convidados}! {nomes} em {data}, {local}. {foo}", values);
    expect(out).toBe("Oi Carla e Davi! Ana & Beto em 12 de dezembro de 2026, Sítio Bela Vista. {foo}");
  });

  it("não reprocessa valores inseridos (passada única)", () => {
    const out = renderAnnouncementText("{convidados} {site}", { ...values, convidados: "Zé {site}" });
    expect(out).toBe("Zé {site} https://site.com");
  });

  it("diferencia {site} de {site-presentes}", () => {
    expect(renderAnnouncementText("{site-presentes}|{site}", values)).toBe(
      "https://presentes.com|https://site.com",
    );
  });
});

describe("helpers de tags", () => {
  it("lista tags desconhecidas sem repetir", () => {
    expect(findUnknownAnnouncementTags("{nome} {nome} {pin} {x-y}")).toEqual(["nome", "x-y"]);
  });

  it("detecta uso de tag", () => {
    expect(announcementUsesTag("Seu PIN: {pin}", "pin")).toBe(true);
    expect(announcementUsesTag("Sem pin", "pin")).toBe(false);
  });
});

describe("announcement-config", () => {
  it("config nova vem só com confirmados e canal AUTO", () => {
    const cfg = newAnnouncementConfig("Novo aviso");
    expect(cfg.audience.rsvpStatuses).toEqual(["CONFIRMED"]);
    expect(cfg.channel).toBe("AUTO");
    expect(cfg.art).toBeNull();
  });

  it("título não pode ter quebra de linha", () => {
    const base = { message: "", channel: "AUTO", audience: { rsvpStatuses: ["CONFIRMED"] } };
    expect(AnnouncementDraftInputSchema.safeParse({ ...base, title: "Ok" }).success).toBe(true);
    expect(AnnouncementDraftInputSchema.safeParse({ ...base, title: "A\nBcc: x" }).success).toBe(false);
  });

  it("parse rejeita caminho de arte fora da pasta de avisos", () => {
    const payload = (path: string) =>
      JSON.stringify({
        version: 1,
        kind: "ANNOUNCEMENT",
        config: { ...newAnnouncementConfig("t"), art: { path, mime: "image/png", name: "a.png" } },
        context: null,
      });
    expect(parseAnnouncementPayload(payload("announcement/abc/0123456789abcdef_a.png"))).not.toBeNull();
    expect(parseAnnouncementPayload(payload("announcement/abc/.."))).toBeNull();
    expect(parseAnnouncementPayload(payload("contract/abc/x.pdf"))).toBeNull();
    expect(parseAnnouncementPayload(payload("announcement/../contract/x.pdf"))).toBeNull();
    expect(parseAnnouncementPayload("not json")).toBeNull();
  });
});
