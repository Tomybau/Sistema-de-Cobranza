/**
 * Script de un solo uso para crear/resetear el usuario admin en producción.
 * Uso: npx tsx db/create-admin.ts
 */
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@cobranza.local"
const PASSWORD = process.env.ADMIN_PASSWORD ?? "12345678"
const NAME = process.env.ADMIN_NAME ?? "Administrador"

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, isActive: true },
    create: { email: EMAIL, name: NAME, passwordHash, role: "ADMIN", isActive: true },
  })

  console.log(`✅ Usuario listo: ${user.email}`)
  console.log(`   Contraseña:    ${PASSWORD}`)
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
