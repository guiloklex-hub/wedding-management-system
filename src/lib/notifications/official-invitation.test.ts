import { describe, it, expect } from "vitest";
import {
  validateInvitationMessage,
  resolveRsvpLink,
} from "./official-invitation";

describe("validateInvitationMessage", () => {
  it("passes when all mandatory tags are present and no unknown tags are used", () => {
    const msg = "Olá {nomes}! Seu PIN é {pin}. Confirme até {data-limite} em {link-rsvp}. Evento em {data} no {local}.";
    const res = validateInvitationMessage(msg);
    expect(res.valid).toBe(true);
    expect(res.missingMandatory).toHaveLength(0);
    expect(res.unknownTags).toHaveLength(0);
  });

  it("detects missing mandatory tags", () => {
    const msg = "Olá {nomes}! Confirme em {link-rsvp}.";
    const res = validateInvitationMessage(msg);
    expect(res.valid).toBe(false);
    expect(res.missingMandatory).toContain("pin");
    expect(res.missingMandatory).toContain("data-limite");
  });

  it("detects unknown merge tags", () => {
    const msg = "Olá {nomes}! PIN {pin}, limite {data-limite}, link {link-rsvp}. Tag {tag-invalida} e {outra}.";
    const res = validateInvitationMessage(msg);
    expect(res.valid).toBe(false);
    expect(res.unknownTags).toContain("tag-invalida");
    expect(res.unknownTags).toContain("outra");
  });
});

describe("resolveRsvpLink", () => {
  const appUrl = "http://localhost:3005";

  it("resolves group native link", () => {
    const link = resolveRsvpLink({
      rsvpMode: "NATIVE",
      externalUrl: null,
      refType: "GuestGroup",
      rsvpToken: "grp-tok-123",
      appUrl,
    });
    expect(link).toBe("http://localhost:3005/rsvp/group/grp-tok-123");
  });

  it("resolves individual guest native link", () => {
    const link = resolveRsvpLink({
      rsvpMode: "NATIVE",
      externalUrl: null,
      refType: "Guest",
      rsvpToken: "gst-tok-456",
      appUrl,
    });
    expect(link).toBe("http://localhost:3005/rsvp/gst-tok-456");
  });

  it("resolves external link regardless of refType or token", () => {
    const link = resolveRsvpLink({
      rsvpMode: "EXTERNAL",
      externalUrl: "https://casamento.com/confirmar",
      refType: "GuestGroup",
      rsvpToken: "grp-tok-123",
      appUrl,
    });
    expect(link).toBe("https://casamento.com/confirmar");
  });
});
