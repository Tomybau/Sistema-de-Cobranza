FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ── Dependencias ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://x:x@localhost:5432/x"

RUN npx prisma generate --schema=db/schema.prisma

RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema + migrations para correr en startup
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

# Instalar Prisma CLI fresco en runner: garantiza que el .wasm y los
# symlinks queden bien configurados (Docker COPY rompe los symlinks de .bin)
# No hace falta chown -R: npm instala con 644/755 legibles por cualquier usuario
RUN npm install --no-save --no-audit prisma@6.19.3

COPY --chown=nextjs:nodejs entrypoint.sh ./
RUN sed -i 's/\r//' entrypoint.sh && chmod +x entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./entrypoint.sh"]
