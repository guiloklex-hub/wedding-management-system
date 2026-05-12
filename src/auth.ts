import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return null;
          
          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) {
             return { id: user.id, email: user.email, name: user.name, role: user.role };
          }
        }
        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
