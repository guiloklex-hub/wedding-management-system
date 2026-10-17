import { describe, expect, it } from "vitest";
import { mobileExtra, webAttachment, webExtraColumns } from "./portable-fields";

describe("mapeamento de campos extras web ⇄ Android", () => {
  it("normaliza booleanos, datas e nulos da linha web para o Android", () => {
    expect(mobileExtra("guest", { isVIP: 1, isChild: 0, checkedInAt: null, side: "NOIVA", city: "Recife" }))
      .toEqual({ isVIP: true, isChild: false, side: "NOIVA", city: "Recife" });
    expect(mobileExtra("contract", { expiresAt: Date.UTC(2027, 2, 10), version: 2 }))
      .toEqual({ expiresAt: "2027-03-10", version: 2 });
  });

  it("converte valores do Android v1.1.0 para os enums web", () => {
    expect(webExtraColumns("guest", { side: "BRIDE", isPadrinho: true })).toEqual({ side: "NOIVA", isPadrinho: 1 });
    expect(webExtraColumns("payment", { method: "CREDIT_CARD", lateFeePercent: "2,5" }))
      .toEqual({ method: "CREDIT", lateFeePercent: 2.5 });
    expect(webExtraColumns("honeymoon_item", { itemKind: "HOTEL" })).toEqual({ kind: "HOTEL" });
    expect(webExtraColumns("trousseau", { room: "Cozinha", priority: "HIGH" }))
      .toEqual({ room: "KITCHEN", priority: "ESSENTIAL" });
  });

  it("descarta valores inválidos e colunas desconhecidas", () => {
    expect(webExtraColumns("vendor", { rating: 9, password: "x", tags: "  " })).toEqual({ tags: null });
    expect(webExtraColumns("contract", { expiresAt: "1712345678" })).toEqual({ expiresAt: 1_712_345_678_000 });
    expect(webExtraColumns("contract", { expiresAt: "não é data" })).toEqual({});
  });
});

describe("webAttachment", () => {
  it("mantém tipos válidos da web e a versão do PDF de contrato", () => {
    expect(webAttachment({ kind: "receipt", version: 3 }, "vendor")).toEqual({ kind: "RECEIPT", version: 3 });
    expect(webAttachment({ kind: "CONTRACT", version: 2 }, "contract")).toEqual({ kind: "CONTRACT", version: 2 });
  });

  it("converte o tipo genérico do Android e versões inválidas", () => {
    expect(webAttachment({ kind: "ATTACHMENT", version: 1 }, "vendor")).toEqual({ kind: "OTHER", version: 1 });
    expect(webAttachment({ kind: "ATTACHMENT" }, "contract")).toEqual({ kind: "CONTRACT", version: 1 });
    expect(webAttachment({ kind: "PHOTO", version: 0 }, "venue")).toEqual({ kind: "PHOTO", version: 1 });
    expect(webAttachment({ kind: "PHOTO", version: 2.5 }, "venue")).toEqual({ kind: "PHOTO", version: 1 });
  });
});
