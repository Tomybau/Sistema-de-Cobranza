# Sistema de Cobranza y Gestión de Contratos

Sistema interno single-tenant para gestionar empresas clientes, contratos, tickets de cobro, pagos y comunicación por email. Reemplaza un workflow basado en Excel + correos.

---

## Stack y versiones

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | ^15.0.0 | Framework (App Router, Server Components) |
| React | 19.x | UI |
| TypeScript | strict | Lenguaje |
| Prisma | ^6.0.0 | ORM |
| PostgreSQL | 16 | Base de datos |
| Auth.js (NextAuth) | v5 beta | Auth (sessions en DB) |
| @auth/prisma-adapter | ^2.11.x | Adapter Prisma para Auth.js |
| shadcn/ui (Radix) | 2.x | Componentes UI (slate base) |
| TanStack Table | ^8.21.x | Tablas headless |
| Recharts | ^3.x | Gráficos |
| React Hook Form | ^7.x | Formularios |
| Zod | ^4.x | Validación |
| Resend | ^6.x | Envío de emails |
| date-fns | ^4.x | Fechas |
| Sonner | via shadcn | Toasts |

> **Versiones fijas.** No actualizar sin una sesión dedicada. Ver `CLAUDE.md` para el razonamiento de cada elección.

---

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

```env
# Base de datos
DATABASE_URL="postgresql://cobranza:cobranza@localhost:5432/cobranza?schema=public"

# Auth.js — generar con: openssl rand -base64 32
AUTH_SECRET="<secret>"
AUTH_URL="http://localhost:3000"

# Resend
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="cobranza@tudominio.com"
RESEND_FROM_NAME="Cobranza"
RESEND_WEBHOOK_SECRET=""   # Resend Dashboard → Webhooks → Signing Secret

# Storage (MinIO en dev, S3/R2 en prod)
STORAGE_ENDPOINT="http://localhost:9000"
STORAGE_REGION="us-east-1"
STORAGE_BUCKET="cobranza-documents"
STORAGE_ACCESS_KEY="minioadmin"
STORAGE_SECRET_KEY="minioadmin"
STORAGE_FORCE_PATH_STYLE="true"

# App
APP_URL="http://localhost:3000"
APP_TIMEZONE="America/Argentina/Buenos_Aires"
APP_DEFAULT_CURRENCY="USD"
```

---

## Setup local

```bash
# 1. Clonar e instalar
git clone <repo>
cd cobranza-system
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con los valores reales

# 3. Levantar PostgreSQL (con Docker)
docker run -d \
  --name cobranza-pg \
  -e POSTGRES_USER=cobranza \
  -e POSTGRES_PASSWORD=cobranza \
  -e POSTGRES_DB=cobranza \
  -p 5432:5432 \
  postgres:16-alpine

# 4. Aplicar migraciones
npx prisma migrate deploy --schema=db/schema.prisma

# 5. (Opcional) Seed inicial para desarrollo
npx prisma db seed --schema=db/schema.prisma

# 6. Levantar dev server
npm run dev
```

La app corre en `http://localhost:3000`. Crear el primer usuario admin via seed o `prisma studio`.

---

## Módulos implementados (Fase 1)

### Autenticación
- Login con email + password (credentials provider, Auth.js v5)
- Sesiones en PostgreSQL (`strategy: "database"`)
- Middleware de protección para todas las rutas privadas

### Empresas (`/companies`)
- CRUD completo con soft delete y restauración
- Tabla con búsqueda y filtros

### Clientes (`/companies/[id]/clients`)
- Contactos por empresa (uno es "primario" y recibe los emails)

### Contratos (`/contracts`)
- Contratos por empresa: vigencia, currency, condiciones de pago
- Items: `RECURRING_FIXED`, `RECURRING_VARIABLE`, `ONE_TIME`, `INSTALLMENT`
- Estados: DRAFT → ACTIVE → SUSPENDED / ENDED / CANCELLED

### Pricing Tables (`/pricing-tables`)
- Tablas de rangos precio para items variables

### Tickets de cobro (`/tickets`)
- Generación de tickets desde items (preview antes de confirmar)
- Estados: PENDING → SENT → PAID / OVERDUE / PARTIAL / CANCELLED
- Exportación a CSV

### Pagos (`/payments`)
- Registro de pagos aplicados a uno o varios tickets
- Métodos: transferencia, cheque, efectivo, tarjeta, otro
- Exportación a CSV

### Email Templates (`/email-templates`)
- Templates HTML con variables interpoladas
- Envío desde el detalle de un ticket vía Resend

### Dashboard (`/dashboard`)
- KPIs: monto pendiente, vencido, tasa de cobro
- Gráfico de revenue mensual y distribución de estados
- Tickets vencidos y pagos recientes
- Filtro por empresa

### Auditoría (`/audit`)
- Registro append-only de operaciones críticas
- Filtros por entidad, usuario y rango de fechas
- Paginación server-side (50 por página)
- Detalle JSON colapsable

### Webhook Resend (`/api/webhooks/resend`)
- Recibe `email.bounced` y `email.complained` → marca `EmailLog` como `BOUNCED`
- Verificación HMAC-SHA256 (Svix)

---

## Estructura del proyecto

```
/app              — Rutas Next.js (App Router)
  /(auth)         — Login
  /(dashboard)    — Vistas autenticadas
  /actions        — Server Actions compartidas (export CSV, email send)
  /api            — Routes: auth, webhooks/resend
/components       — Componentes UI (presentación pura, sin lógica de negocio)
  /ui             — shadcn primitives
  /audit          — AuditLog table
  /billing        — Tickets table y botones de acción
  /shared         — ExportCsvButton
  ...
/domain           — Lógica de negocio pura (sin imports de Next ni Prisma directo)
  /audit          — Queries + tipos (types.ts separado para Client Components)
  /billing        — Generación y queries de tickets
  /payments       — Registro y queries de pagos
  /email          — Envío, interpolación, queries
  ...
/db               — schema.prisma, migrations/, client.ts
/lib              — money.ts, csv.ts, rate-limit.ts, currencies.ts
/services         — Adapters externos (Resend, S3)
```

---

## Decisiones arquitectónicas

1. **Server Actions como API.** No REST endpoints salvo webhooks externos.
2. **Lógica en `/domain`, no en actions.** Las actions validan input y delegan.
3. **Client Components no importan Prisma/DB.** Los tipos compartidos viven en archivos `types.ts` sin imports de servidor.
4. **Soft delete con `deletedAt`** en entidades críticas (Company, Client, Contract, Payment).
5. **AuditLog append-only** para todo lo financiero y de configuración.
6. **Money con `Decimal`** — nunca `number` nativo para montos.
7. **Rate limiting in-memory** para envíos de email (10/min por usuario). Para multi-instancia usar Upstash.

---

## Notas para Fase 2

> No implementar hasta que Fase 1 esté en producción y estable.

- Los modelos `Document` y `ExtractionResult` están en el schema, sin lógica.
- `/prompts` reservado para prompts de IA.
- `/jobs` reservado para workers BullMQ + Redis.
- Gmail/Drive requieren variables de entorno de Google OAuth (ya documentadas en `.env.example`).
- El módulo OCR será un adapter pluggable: `AI_PROVIDER` determina el proveedor.

**Decisiones de Fase 1 que no cambiar en Fase 2 sin discusión:**
- Currencies en `lib/currencies.ts` (constante TS, no enum de Prisma) → agregar currencies sin migrations.
- `AuditLog` es append-only — no editar ni borrar registros.
