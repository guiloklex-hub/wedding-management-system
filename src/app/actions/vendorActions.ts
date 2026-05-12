'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const prisma = new PrismaClient();

const VendorSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  status: z.enum(['NEGOTIATION', 'CONTRACTED', 'FINALIZED']),
  contractLink: z.string().optional(),
  estimatedValue: z.coerce.number().min(0, "Valor estimado deve ser positivo"),
});

export async function createVendor(state: any, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = VendorSchema.safeParse(data);
  
  if (!parsed.success) {
    return { error: 'Dados inválidos' };
  }
  
  try {
    await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          status: parsed.data.status,
          contractLink: parsed.data.contractLink,
        }
      });
      
      await tx.budgetItem.create({
        data: {
          title: `Orçamento: ${parsed.data.name}`,
          estimatedValue: parsed.data.estimatedValue,
          vendorId: vendor.id,
        }
      });
    });
    
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { error: 'Erro ao criar fornecedor' };
  }
}

export async function updateVendorStatus(vendorId: string, status: string, actualValue?: number) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendorId },
        data: { status }
      });
      
      if (status === 'CONTRACTED' && actualValue !== undefined) {
        await tx.budgetItem.updateMany({
          where: { vendorId },
          data: { actualValue }
        });
      }
    });
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { error: 'Erro ao atualizar fornecedor' };
  }
}
