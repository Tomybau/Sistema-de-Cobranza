/**
 * Script de un solo uso para crear/resetear el usuario admin en producción.
 * Uso: node db/create-admin.mjs
 * No requiere tsx ni compilación.
 */
import { createRequire } from "module"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const require = createRequire(import.meta.url)
const bcrypt = require("bcryptjs")

const EMAIL    = process.env.ADMIN_EMAIL    ?? "admin@cobranza.local"
const PASSWORD = process.env.ADMIN_PASSWORD ?? "12345678"
const NAME     = process.env.ADMIN_NAME     ?? "Administrador"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma  = new PrismaClient({ adapter })

const passwordHash = await bcrypt.hash(PASSWORD, 12)

const user = await prisma.user.upsert({
  where:  { email: EMAIL },
  update: { passwordHash, isActive: true },
  create: { email: EMAIL, name: NAME, passwordHash, role: "ADMIN", isActive: true },
})

console.log(`✅ Usuario listo: ${user.email}`)
console.log(`   Contraseña:    ${PASSWORD}`)

await prisma.$disconnect()
