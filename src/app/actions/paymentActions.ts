"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/types";

const PaymentMethodSchema = z.enum(["PIX", "BOLETO", "CREDIT", "TRANSFER", "CASH"]);

const optionalInstallment = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce
    .number({ message: "Parcela deve ser um número" })
    .int("Parcela deve ser inteira")
    .min(1, "Parcela deve ser pelo menos 1")
    .max(999, "Parcela acima do limite (máx. 999)")
    .optional(),
);

const PaymentBaseSchema = z.object({
  amount: z.coerce
    .number({ message: "Valor inválido" })
    .min(0.01, "Valor deve ser maior que zero"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  status: z.enum(["PENDING", "PAID"]),
  method: PaymentMethodSchema,
  installmentNumber: optionalInstallment,
  totalInstallments: optionalInstallment,
  vendorId: z.string().min(1, "Selecione um fornecedor"),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

const PaymentCreateSchema = PaymentBaseSchema.superRefine((data, ctx) => {
  if (
    data.installmentNumber != null &&
    data.totalInstallments != null &&
    data.installmentNumber > data.totalInstallments
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["installmentNumber"],
      message: "Parcela atual não pode ser maior que o total de parcelas",
    });
  }
});

const PaymentUpdateSchema = PaymentBaseSchema.extend({
  id: z.string().min(1),
}).superRefine((data, ctx) => {
  if (
    data.installmentNumber != null &&
    data.totalInstallments != null &&
    data.installmentNumber > data.totalInstallments
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["installmentNumber"],
      message: "Parcela atual não pode ser maior que o total de parcelas",
    });
  }
});

const SplitPaymentSchema = z.object({
  depositAmount: z.coerce.number().min(0.01),
  depositMethod: PaymentMethodSchema,
  finalAmount: z.coerce.number().min(0.01),
  finalDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  finalMethod: PaymentMethodSchema.default("PIX"),
  vendorId: z.string().min(1),
});

export async function createPayment(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const data = Object.fromEntries(formData.entries());
  const parsed = PaymentCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const dueDate = new Date(parsed.data.dueDate);

  try {
    const vendor = await prisma.vendor.findFirst({
      where: { id: parsed.data.vendorId, deletedAt: null },
    });
    if (!vendor) return { success: false, error: "Fornecedor não encontrado" };

    const created = await prisma.payment.create({
      data: {
        amount: parsed.data.amount,
        dueDate,
        status: parsed.data.status,
        method: parsed.data.method,
        installmentNumber: parsed.data.installmentNumber,
        totalInstallments: parsed.data.totalInstallments,
        notes: parsed.data.notes,
        vendorId: parsed.data.vendorId,
        paidAt: parsed.data.status === "PAID" ? new Date() : null,
      },
    });

    await audit("Payment", created.id, "CREATE", { vendorId: vendor.id, amount: created.amount });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (err) {
    console.error("[createPayment]", err);
    return { success: false, error: "Erro ao criar pagamento" };
  }
}

export async function updatePayment(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const data = Object.fromEntries(formData.entries());
  const parsed = PaymentUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const dueDate = new Date(parsed.data.dueDate);

  try {
    const existing = await prisma.payment.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    });
    if (!existing) return { success: false, error: "Pagamento não encontrado" };

    const wasPaid = existing.status === "PAID";
    const nowPaid = parsed.data.status === "PAID";

    await prisma.payment.update({
      where: { id: parsed.data.id },
      data: {
        amount: parsed.data.amount,
        dueDate,
        status: parsed.data.status,
        method: parsed.data.method,
        installmentNumber: parsed.data.installmentNumber,
        totalInstallments: parsed.data.totalInstallments,
        notes: parsed.data.notes,
        vendorId: parsed.data.vendorId,
        paidAt: nowPaid ? existing.paidAt ?? new Date() : null,
      },
    });

    await audit("Payment", parsed.data.id, "UPDATE", { wasPaid, nowPaid });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (err) {
    console.error("[updatePayment]", err);
    return { success: false, error: "Erro ao atualizar pagamento" };
  }
}

export async function markPaymentAsPaid(paymentId: string): Promise<ActionResult> {
  try {
    const result = await prisma.payment.updateMany({
      where: { id: paymentId, deletedAt: null, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Pagamento não encontrado ou já pago" };

    await audit("Payment", paymentId, "MARK_PAID");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (err) {
    console.error("[markPaymentAsPaid]", err);
    return { success: false, error: "Erro ao quitar pagamento" };
  }
}

export async function undoPaymentPaid(paymentId: string): Promise<ActionResult> {
  try {
    const result = await prisma.payment.updateMany({
      where: { id: paymentId, deletedAt: null, status: "PAID" },
      data: { status: "PENDING", paidAt: null },
    });
    if (result.count === 0) return { success: false, error: "Não é possível estornar este pagamento" };

    await audit("Payment", paymentId, "UNDO_PAID");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (err) {
    console.error("[undoPaymentPaid]", err);
    return { success: false, error: "Erro ao estornar pagamento" };
  }
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  try {
    const result = await prisma.payment.updateMany({
      where: { id: paymentId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: "Pagamento não encontrado" };

    await audit("Payment", paymentId, "DELETE");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (err) {
    console.error("[deletePayment]", err);
    return { success: false, error: "Erro ao excluir pagamento" };
  }
}

export async function createSplitPayment(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const data = Object.fromEntries(formData.entries());
  const parsed = SplitPaymentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos para split" };
  }

  const finalDue = new Date(parsed.data.finalDueDate);

  try {
    const vendor = await prisma.vendor.findFirst({
      where: { id: parsed.data.vendorId, deletedAt: null },
    });
    if (!vendor) return { success: false, error: "Fornecedor não encontrado" };

    const now = new Date();
    const [deposit, balance] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          amount: parsed.data.depositAmount,
          dueDate: now,
          paidAt: now,
          status: "PAID",
          method: parsed.data.depositMethod,
          vendorId: parsed.data.vendorId,
          installmentNumber: 1,
          totalInstallments: 2,
        },
      }),
      prisma.payment.create({
        data: {
          amount: parsed.data.finalAmount,
          dueDate: finalDue,
          status: "PENDING",
          method: parsed.data.finalMethod,
          vendorId: parsed.data.vendorId,
          installmentNumber: 2,
          totalInstallments: 2,
        },
      }),
    ]);

    await audit("Payment", deposit.id, "CREATE", { type: "split-deposit" });
    await audit("Payment", balance.id, "CREATE", { type: "split-balance" });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/payments");
    return { success: true };
  } catch (err) {
    console.error("[createSplitPayment]", err);
    return { success: false, error: "Erro ao criar pagamentos divididos" };
  }
}
