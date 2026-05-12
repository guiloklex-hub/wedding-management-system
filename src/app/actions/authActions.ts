'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Credenciais inválidas.';
        default:
          return 'Algo deu errado ao fazer o login.';
      }
    }
    throw error;
  }
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';

const prisma = new PrismaClient();

export async function registerUser(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!name || !email || !password) return 'Preencha todos os campos.';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return 'Email já está em uso.';
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'USER',
      }
    });
    
  } catch (error) {
    return 'Erro ao registrar usuário.';
  }
  
  redirect('/login');
}

export async function logout() {
  const { signOut } = await import('@/auth');
  await signOut();
}
