'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const prisma = new PrismaClient();

const PaymentSchema = z.object({
  amount: z.coerce.number().min(0.01),
  dueDate: z.string(),
  status: z.enum(['PENDING', 'PAID']),
  method: z.string(),
  installmentNumber: z.coerce.number().optional(),
  totalInstallments: z.coerce.number().optional(),
  vendorId: z.string(),
});

export async function createPayment(state: any, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  
  const method = data.method as string;
  const dueDateLimit = new Date('2026-11-15T00:00:00.000Z');
  const dueDate = new Date(data.dueDate as string);
  
  if (method !== 'CREDIT' && dueDate > dueDateLimit) {
    return { error: 'Pagamentos (exceto crédito) não podem ser posteriores à data do evento.' };
  }

  const parsed = PaymentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: 'Dados inválidos' };
  }

  try {
    await prisma.payment.create({
      data: {
        amount: parsed.data.amount,
        dueDate: new Date(parsed.data.dueDate),
        status: parsed.data.status,
        method: parsed.data.method,
        installmentNumber: parsed.data.installmentNumber,
        totalInstallments: parsed.data.totalInstallments,
        vendorId: parsed.data.vendorId,
      }
    });
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { error: 'Erro ao criar pagamento' };
  }
}

export async function markPaymentAsPaid(paymentId: string) {
  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID' }
    });
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { error: 'Erro ao atualizar pagamento' };
  }
}

const SplitPaymentSchema = z.object({
  depositAmount: z.coerce.number().min(0.01),
  depositMethod: z.string(),
  finalAmount: z.coerce.number().min(0.01),
  finalDueDate: z.string(),
  vendorId: z.string(),
});

export async function createSplitPayment(state: any, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = SplitPaymentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: 'Dados inválidos para split' };
  }
  
  try {
    await prisma.$transaction(async (tx) => {
      // Entrada
      await tx.payment.create({
        data: {
          amount: parsed.data.depositAmount,
          dueDate: new Date(),
          status: 'PAID',
          method: parsed.data.depositMethod,
          vendorId: parsed.data.vendorId,
          installmentNumber: 1,
          totalInstallments: 2,
        }
      });
      // Saldo Final
      await tx.payment.create({
        data: {
          amount: parsed.data.finalAmount,
          dueDate: new Date(parsed.data.finalDueDate),
          status: 'PENDING',
          method: 'PIX', // default, can be edited later
          vendorId: parsed.data.vendorId,
          installmentNumber: 2,
          totalInstallments: 2,
        }
      });
    });
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { error: 'Erro ao criar pagamentos divididos' };
  }
}
