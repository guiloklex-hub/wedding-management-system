'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const prisma = new PrismaClient();

const AssetSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  amount: z.coerce.number().min(0.01, "Valor deve ser positivo"),
  date: z.string(),
});

export async function createAsset(state: any, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = AssetSchema.safeParse(data);
  
  if (!parsed.success) {
    return { error: 'Dados inválidos' };
  }
  
  try {
    await prisma.asset.create({
      data: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
      }
    });
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { error: 'Erro ao criar aporte' };
  }
}
