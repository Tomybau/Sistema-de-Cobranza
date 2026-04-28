# Sistema de Cobranza y Gestión de Contratos

Sistema interno single-tenant que reemplaza un workflow basado en Excel + correos. Gestiona empresas clientes, contratos, generación de tickets de cobro, registro de pagos y comunicación por email.

---

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | ^15.0.0 | Framework (App Router, Server Components) |
| React | 19.x | UI |
| TypeScript | strict | Lenguaje |
| Prisma | ^6.0.0 | ORM |
| PostgreSQL | 16 | Base de datos |
| Auth.js (NextAuth) | v5 beta | Auth con sesiones en DB |
| @auth/prisma-adapter | ^2.11.x | Adapter Prisma para Auth.js |
| shadcn/ui | 2.x | Componentes UI |
| TanStack Table | ^8.21.x | Tablas headless |
| Recharts | ^3.x | Gráficos |
| React Hook Form | ^7.x | Formularios |
| Zod | ^4.x | Validación |
| Resend | ^6.x | Envío de emails |
| Anthropic SDK | ^0.90.x | OCR con Claude Vision |
| AWS SDK S3 | ^3.x | Storage (MinIO dev / S3 o R2 prod) |
| date-fns | ^4.x | Fechas |
| Sonner | via shadcn | Toasts |

> Versiones fijas — no actualizar sin una sesión dedicada. Ver `CLAUDE.md`.

---

## Requisitos

- Node.js 20+
- Docker (para PostgreSQL + MinIO en desarrollo)
- npm (no bun, no pnpm)

---

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con los valores reales (ver sección Variables de entorno)

# 3. Levantar infraestructura con Docker
docker compose up -d

# 4. Aplicar migraciones
npm run db:migrate:dev

# 5. Seed inicial (crea usuario admin de prueba)
npm run db:seed

# 6. Levantar dev server
npm run dev
```

La app corre en `http://localhost:3000`.

---

## Variables de entorno

Ver `.env.example` para la lista completa. Las variables obligatorias son:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión PostgreSQL |
| `AUTH_SECRET` | Secret para Auth.js — generar con `openssl rand -base64 32` |
| `AUTH_URL` | URL base del app (ej. `http://localhost:3000`) |
| `RESEND_API_KEY` | API key de Resend para envío de emails |
| `RESEND_FROM_EMAIL` | Dirección de origen de los emails |
| `STORAGE_ENDPOINT` | Endpoint de MinIO (dev) o S3/R2 (prod) |
| `STORAGE_BUCKET` | Nombre del bucket |
| `STORAGE_ACCESS_KEY` | Access key del storage |
| `STORAGE_SECRET_KEY` | Secret key del storage |
| `ANTHROPIC_API_KEY` | API key de Anthropic para OCR de contratos |

---

## Scripts disponibles

```bash
npm run dev           # Dev server con hot reload
npm run build         # Build de producción
npm run start         # Servidor de producción
npm run lint          # ESLint
npm run type-check    # TypeScript sin emitir archivos

npm run db:generate       # Regenerar cliente Prisma
npm run db:migrate        # Aplicar migraciones (producción)
npm run db:migrate:dev    # Crear y aplicar migración (desarrollo)
npm run db:seed           # Seed inicial
npm run db:studio         # Prisma Studio (UI de la BD)
```

---

## Arquitectura

```
/app                    — Next.js App Router
  /(auth)               — Login
  /(dashboard)          — Todas las vistas autenticadas
    /dashboard          — KPIs y gráficos
    /companies          — CRUD de empresas
    /contracts          — CRUD de contratos
    /tickets            — Tickets de cobro
    /payments           — Registro de pagos
    /email-templates    — Templates HTML
    /pricing-tables     — Tablas de precios
    /audit              — Log de auditoría
  /actions              — Server Actions compartidas
  /api
    /auth               — NextAuth handler
    /files              — Descarga de documentos (proxy con auth)
    /webhooks/resend    — Webhook para bounces de email

/components             — Componentes UI (presentación pura, sin lógica de BD)
  /ui                   — shadcn primitives (Button, Input, Dialog, etc.)
  /billing              — Tickets table + botones de acción
  /payments             — Payment form + table
  /contracts            — Contract form + table + OCR dialog
  /email                — Send dialog + template form
  /audit                — AuditLog table
  /layout               — Sidebar + mobile nav + user menu
  /shared               — ExportCsvButton

/domain                 — Lógica de negocio pura (sin imports de Next ni Prisma directo)
  /audit                — createAuditLog + queries
  /billing              — Generación y queries de tickets
  /clients              — CRUD + schemas
  /companies            — CRUD + schemas
  /contracts            — CRUD + schemas + transiciones de estado
  /contract_items       — CRUD + schemas
  /dashboard            — Queries de KPIs
  /email                — Envío, interpolación, queries
  /ocr                  — Extracción con Claude Vision
  /payments             — Registro, cancelación, queries
  /pricing_tables       — CRUD + schemas

/db
  schema.prisma         — Esquema Prisma (23 modelos, 9 enums)
  migrations/           — Migraciones (nunca editar historial)
  client.ts             — Singleton prisma exportado
  seed.ts               — Seed para desarrollo

/lib                    — Utilidades cross-cutting
  currencies.ts         — Lista de currencies soportadas (TS const, no enum Prisma)
  money.ts              — formatMoney() + toDecimal() (nunca usar number para montos)
  dates.ts              — Helpers de fechas con timezone
  csv.ts                — Generación de CSV para exportación
  storage.ts            — StorageAdapter (LocalDev / S3)
  rate-limit.ts         — Rate limiting in-memory para emails
  utils.ts              — cn() y helpers generales
```

---

## Modelo de dominio

### Entidades principales

| Entidad | Descripción |
|---|---|
| `Company` | Empresa cliente. Tiene varios `Client` y `Contract`. Soft delete. |
| `Client` | Contacto dentro de una empresa. El primario recibe los emails. Soft delete. |
| `Contract` | Acuerdo con una empresa. Tiene items de cobro, currency, fechas de vigencia. Soft delete. |
| `ContractItem` | Línea de cobro. Tipos: `RECURRING_FIXED`, `RECURRING_VARIABLE`, `ONE_TIME`, `INSTALLMENT`. |
| `PricingTable` | Tabla de rangos precio-cantidad para items variables. |
| `BillingTicket` | Cobro concreto generado desde un `ContractItem`. Es la unidad operativa. |
| `Payment` | Pago registrado, aplicado a uno o más tickets. Soft delete. |
| `PaymentTicket` | Tabla de unión: Payment → BillingTicket con monto asignado. |
| `EmailTemplate` | Template HTML con variables interpoladas. |
| `EmailLog` | Registro de cada email enviado (quién, cuándo, estado, resultado). |
| `AuditLog` | Registro append-only de todas las operaciones críticas. |

### Estados de BillingTicket

```
PENDING → SENT → PAID
              ↘ PARTIAL → PAID
PENDING → OVERDUE
PENDING → CANCELLED
```

### Estados de Contract

```
DRAFT → ACTIVE → SUSPENDED → ACTIVE
               ↘ ENDED
               ↘ CANCELLED
```

---

## Decisiones arquitectónicas clave

**Server Actions como API.** No hay REST endpoints propios salvo webhooks externos (Resend). Toda mutación desde el frontend va por Server Action.

**Lógica en `/domain`, no en actions.** Las Server Actions validan input (Zod) y delegan a funciones de dominio. Sin lógica de negocio en componentes ni en actions.

**Client Components no importan Prisma.** Los tipos compartidos entre server y client viven en archivos `types.ts` sin imports de servidor.

**Soft delete.** `deletedAt` en Company, Client, Contract, Payment. Nunca borrado físico de datos financieros.

**AuditLog append-only.** Se registran: cambios de estado de contratos, creación/modificación de items, generación de tickets, registros de pagos, envíos de email, correcciones OCR.

**Money con Decimal.** Nunca `number` nativo para montos. En DB: `Decimal(12,2)`. En TS: `Prisma.Decimal`. Operaciones con `.add()`, `.sub()`, `.mul()`, `.div()`.

**Currencies como constante TypeScript.** No como enum de Prisma — agregar una currency nueva no requiere migration.

**Rate limiting in-memory.** 10 emails/minuto por usuario. Para multi-instancia migrar a Upstash.

---

## Infraestructura Docker (desarrollo)

`docker-compose.yml` levanta:

| Servicio | Puerto | Credenciales |
|---|---|---|
| PostgreSQL 16 | 5432 | `cobranza` / `cobranza` |
| MinIO | 9000 (API), 9001 (Console) | `minioadmin` / `minioadmin` |

```bash
docker compose up -d      # Levantar
docker compose down       # Bajar
docker compose down -v    # Bajar + borrar volúmenes (reset total)
```

---

## Módulos implementados (Fase 1)

### Autenticación
- Login email + password (credentials provider, Auth.js v5)
- Sesiones en PostgreSQL (`strategy: "database"`)
- Middleware protege todas las rutas privadas
- Sin JWT puro — sesiones invalidables server-side

### Empresas (`/companies`)
- CRUD con soft delete y restauración
- Vista de empresas eliminadas

### Clientes (`/companies/[id]/clients`)
- CRUD de contactos por empresa
- Un contacto primario por empresa (recibe los emails)

### Contratos (`/contracts`)
- CRUD con estados (DRAFT → ACTIVE → SUSPENDED/ENDED/CANCELLED)
- Items con 4 tipos: fijo, variable, único, cuotas
- Import desde PDF/imagen vía OCR (Claude Vision)
- Pricing Tables para items variables (rangos cantidad → precio)

### Tickets de cobro (`/tickets`)
- Preview de tickets antes de confirmar generación
- Generación idempotente (por `ticketNumber` único)
- Estados: PENDING, SENT, PAID, PARTIAL, OVERDUE, CANCELLED
- Exportación a CSV

### Pagos (`/payments`)
- Registro con asignación a uno o varios tickets
- Adjunto de comprobante (PDF, imagen — hasta 5 MB)
- Métodos: transferencia, cheque, efectivo, tarjeta, otro
- Cancelación con reversión de allocations
- Exportación a CSV

### Email Templates (`/email-templates`)
- Templates HTML con variables interpoladas: `{{company_name}}`, `{{ticket_number}}`, `{{amount}}`, etc.
- Envío desde el detalle de un ticket vía Resend
- Registro de cada envío con estado (SENT/FAILED/BOUNCED)

### Webhook Resend (`/api/webhooks/resend`)
- Recibe `email.bounced` y `email.complained`
- Verificación HMAC-SHA256
- Marca `EmailLog` como `BOUNCED`

### Dashboard (`/dashboard`)
- KPIs: monto pendiente, monto vencido, tasa de cobro del período
- Gráfico de revenue mensual (Recharts)
- Distribución de estados de tickets
- Tabla de tickets vencidos y pagos recientes
- Filtro por empresa

### Auditoría (`/audit`)
- Log append-only de todas las operaciones críticas
- Filtros por tipo de entidad, usuario y rango de fechas
- Paginación server-side (50 por página)
- Detalle JSON colapsable

### OCR de contratos
- Upload de PDF o imagen de un contrato existente
- Claude Vision extrae: empresa, cliente, items, pricing tables
- Resultado poblado como draft en el formulario de nuevo contrato para revisión humana
- Correcciones manuales antes de confirmar

---

## Fases de desarrollo

**Fase 1 — Core de cobranza** ✅ En producción / estable

**Fase 2 — Ingesta + OCR + validación** (no implementada)
- Conector a Gmail y Drive
- Parser de PDFs con proveedor de IA pluggable
- Vista de validación manual con loop de corrección
- Los modelos `Document` y `ExtractionResult` ya existen en el schema

**Fase 3 — Integración QuickBooks** (no implementada)
- Detección de facturas creadas en QuickBooks
- Descarga de PDF y envío automático con template
- Recordatorio a 15 días

> No implementar Fase 2 o 3 hasta que Fase 1 esté estable en producción.

---

## Migraciones

Las migraciones viven en `db/migrations/` y **nunca se editan**. Si hay un error en una migration ya aplicada, se crea una nueva que la corrige.

| Migration | Descripción |
|---|---|
| `20260410230948_init` | Tablas iniciales: todos los modelos base |
| `20260412074528_add_contract_id_to_pricing_table` | `contractId` en `PricingTable` |
| `20260413041114_init_payments` | Modelo `Payment` finalizado |
| `20260414035120_email_templates` | Ajustes en `EmailTemplate` |
| `20260418000000_session9_contract_ocr_payment_attachments` | `ContractDocument` + adjuntos en `Payment` |
| `20260419120000_contract_item_quota_duration` | `quotaLimit`, `quotaUnit`, `durationMonths` en `ContractItem` |

---

## Convenciones de código

- **IDs:** `cuid()`
- **Timestamps:** `createdAt` / `updatedAt` en todas las entidades de negocio
- **Soft delete:** campo `deletedAt` (nunca borrar Company, Client, Contract, Payment)
- **Montos:** `Decimal(12,2)` en DB, `Prisma.Decimal` en TS
- **Cantidades variables:** `Decimal(12,4)`
- **Currencies:** validar contra `lib/currencies.ts` al guardar
- **Errores:** no hay `try/catch` que trague errores silenciosamente
- **Imports en Client Components:** nunca importar Prisma, Auth, ni Server Actions directamente

---

## Notas para producción

- Generar `AUTH_SECRET` con `openssl rand -base64 32`
- Cambiar `STORAGE_ENDPOINT` a S3 o Cloudflare R2
- Configurar `RESEND_WEBHOOK_SECRET` en el Dashboard de Resend → Webhooks
- Poner `NODE_ENV=production`
- Correr `npm run db:migrate` (no `db:migrate:dev`) en producción
- El rate limiting de emails es in-memory — en multi-instancia usar Upstash Redis
