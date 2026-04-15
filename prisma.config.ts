import path from "node:path"
import { config } from "dotenv"
config()

import { defineConfig, env } from "prisma/config"

// Prisma v7 mueve la URL de conexión al config file en lugar del schema.
// Ver: https://pris.ly/d/config-datasource
export default defineConfig({
  schema: path.join("db", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: path.join("db", "migrations"),
    seed: "npx tsx db/seed.ts",
  },
})
