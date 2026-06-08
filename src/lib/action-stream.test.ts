import { describe, it, expect } from "vitest";
import { aggregateActionStream, type ActionStreamInput } from "./action-stream";

const TODAY = new Date("2026-06-08T12:00:00.000Z");

function daysFromToday(n: number): Date {
  return new Date(TODAY.getTime() + n * 86_400_000);
}

function baseInput(overrides: Partial<ActionStreamInput> = {}): ActionStreamInput {
  return {
    today: TODAY,
    payments: [],
    tasks: [],
    contracts: [],
    rsvpPending: 0,
    giftsPendingThank: 0,
    ...overrides,
  };
}

describe("aggregateActionStream", () => {
  it("retorna vazio quando não há nada pendente", () => {
    expect(aggregateActionStream(baseInput())).toEqual([]);
  });

  it("inclui pagamento atrasado com prioridade acima de vencimento próximo", () => {
    const items = aggregateActionStream(
      baseInput({
        payments: [
          { id: "p1", vendorName: "Buffet", amount: 2000, dueDate: daysFromToday(-3), status: "PENDING" },
          { id: "p2", vendorName: "DJ", amount: 800, dueDate: daysFromToday(5), status: "PENDING" },
        ],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["PAYMENT_OVERDUE", "PAYMENT_DUE"]);
    expect(items[0].params).toMatchObject({ vendor: "Buffet", amount: 2000, days: 3 });
    expect(items[0].finance).toBe(true);
  });

  it("ignora pagamento PAID e vencimento fora da janela", () => {
    const items = aggregateActionStream(
      baseInput({
        dueSoonDays: 14,
        payments: [
          { id: "p1", vendorName: "Pago", amount: 100, dueDate: daysFromToday(-1), status: "PAID" },
          { id: "p2", vendorName: "Longe", amount: 100, dueDate: daysFromToday(40), status: "PENDING" },
        ],
      }),
    );
    expect(items).toEqual([]);
  });

  it("tarefa atrasada vem antes de tarefa próxima; HIGH ganha bump", () => {
    const items = aggregateActionStream(
      baseInput({
        tasks: [
          { id: "t1", title: "Provar bolo", priority: "MEDIUM", status: "TODO", deadline: daysFromToday(2) },
          { id: "t2", title: "Pagar cartório", priority: "HIGH", status: "TODO", deadline: daysFromToday(-1) },
          { id: "t3", title: "Sem prazo", priority: "HIGH", status: "TODO", deadline: null },
          { id: "t4", title: "Concluída", priority: "HIGH", status: "DONE", deadline: daysFromToday(-5) },
        ],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["TASK_OVERDUE", "TASK_DUE"]);
    expect(items[0].params.title).toBe("Pagar cartório");
  });

  it("contrato a expirar dentro da janela entra; já expirado ou assinado não", () => {
    const items = aggregateActionStream(
      baseInput({
        contractExpiryDays: 30,
        contracts: [
          { id: "c1", vendorName: "Foto", status: "DRAFT", expiresAt: daysFromToday(10) },
          { id: "c2", vendorName: "Assinado", status: "SIGNED", expiresAt: daysFromToday(5) },
          { id: "c3", vendorName: "Expirado", status: "DRAFT", expiresAt: daysFromToday(-2) },
          { id: "c4", vendorName: "Longe", status: "DRAFT", expiresAt: daysFromToday(60) },
        ],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["CONTRACT_EXPIRING"]);
    expect(items[0].params.vendor).toBe("Foto");
  });

  it("agrega RSVP pendente e agradecimentos como itens únicos de baixa prioridade", () => {
    const items = aggregateActionStream(
      baseInput({ rsvpPending: 12, giftsPendingThank: 3 }),
    );
    expect(items.map((i) => i.kind)).toEqual(["RSVP_PENDING", "GIFT_THANK"]);
    expect(items[0].params.count).toBe(12);
    expect(items[1].params.count).toBe(3);
  });

  it("não cria RSVP/agradecimento quando contagem é zero", () => {
    const items = aggregateActionStream(baseInput({ rsvpPending: 0, giftsPendingThank: 0 }));
    expect(items).toEqual([]);
  });

  it("ordena a lista completa por urgência (overdue > due > expiring > rsvp > gift)", () => {
    const items = aggregateActionStream(
      baseInput({
        payments: [
          { id: "p1", vendorName: "Atrasado", amount: 1, dueDate: daysFromToday(-1), status: "PENDING" },
          { id: "p2", vendorName: "Próximo", amount: 1, dueDate: daysFromToday(3), status: "PENDING" },
        ],
        tasks: [{ id: "t1", title: "Atrasada", priority: "LOW", status: "TODO", deadline: daysFromToday(-1) }],
        contracts: [{ id: "c1", vendorName: "Foto", status: "DRAFT", expiresAt: daysFromToday(10) }],
        rsvpPending: 5,
        giftsPendingThank: 2,
      }),
    );
    expect(items.map((i) => i.kind)).toEqual([
      "PAYMENT_OVERDUE",
      "TASK_OVERDUE",
      "PAYMENT_DUE",
      "CONTRACT_EXPIRING",
      "RSVP_PENDING",
      "GIFT_THANK",
    ]);
  });
});
