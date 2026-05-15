import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const migrated = await prisma.user.updateMany({
    where: { role: { in: ['OWNER', 'USER'] } },
    data: { role: 'ADMIN' },
  })
  if (migrated.count > 0) {
    console.log(`🔁 Migrados ${migrated.count} usuário(s) de OWNER/USER → ADMIN.`)
  }

  await prisma.securitySettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })

  const adminEmail = 'admin@admin.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin'

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        passwordUpdatedAt: new Date(),
      },
    })
    console.log('✅ Usuário administrador criado com sucesso!')
  } else {
    console.log('⚠️ Usuário administrador já existe.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
