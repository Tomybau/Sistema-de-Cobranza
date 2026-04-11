# Sistema de Cobranza y Gestión de Contratos

Sistema interno para gestión de clientes, contratos, cobranza recurrente y comunicación con clientes. Reemplaza un workflow manual basado en Excel + correos.

## Estado actual

**Fase 1 — Core de cobranza** (en desarrollo)

## Stack

- Next.js 15 (App Router) + TypeScript strict
- Prisma + PostgreSQL
- Auth.js v5
- shadcn/ui + Tailwind
- TanStack Table, Recharts, Zod, React Hook Form
- Resend (mails), MinIO/S3 (storage)

## Roadmap

### Fase 1 — Core de cobranza (4 semanas estimadas)

Objetivo: dejar al cliente operando el día a día sin Excel ni Monday.

**Incluye:**
- Auth de usuarios admin (1-3 personas)
- CRUD de Companies (empresas cliente)
- CRUD de Clients (contactos dentro de cada Company)
- CRUD de Contracts con sus ContractItems y PricingTables
- Generación manual y automática (cron mensual) de BillingTickets
- Lista de tickets con filtros: pendientes, pagados, vencidos, por cliente
- Marcar tickets como pagados, registrar Payments
- CRUD de EmailTemplates
- Envío manual de mails desde un ticket usando un template
- Dashboard con KPIs:
  - Total facturado en el período
  - Total pendiente de cobro
  - Total en mora
  - Tiempo promedio de pago
  - Próximos vencimientos (próximos 7 días)
  - Cantidad de contratos activos
- AuditLog para todas las operaciones críticas
- Soft delete en entidades críticas
- Seed básico para desarrollo

**No incluye (queda para Fase 2/3):**
- Ingesta automática desde Gmail/Drive
- OCR de contratos/facturas
- Validación humana de extracciones
- Integración con QuickBooks
- Recordatorios automáticos a 15 días
- Reporte mensual automático por mail (se puede agregar al final de Fase 1 si sobra tiempo)

### Fase 2 — Ingesta + OCR + validación (3 semanas estimadas)

- Conector a Gmail (lectura de adjuntos)
- Conector a Google Drive (watch sobre carpetas)
- Pipeline de OCR/IA pluggable (proveedor configurable)
- Vista de validación humana con diff entre raw y corrected
- Loop iterativo de mejora de prompts
- Auto-creación de Documents → ExtractionResults → propuesta de Contract para validar

### Fase 3 — QuickBooks (2 semanas estimadas)

- Detección de facturas creadas (webhook o polling)
- Descarga de PDF de factura
- Generación de mail con template + adjunto
- Job de recordatorio a 15 días

## Setup local

```bash
# 1. Clonar y entrar
cd cobranza-system

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con valores reales

# 4. Levantar servicios (Postgres, MinIO, Redis)
docker compose up -d

# 5. Migrar la BD
npx prisma migrate dev

# 6. Cargar datos de prueba
npx prisma db seed

# 7. Arrancar dev server
npm run dev
```

Después abrís `http://localhost:3000` y te logueás con el user admin del seed.

## Estructura del repo

```
cobranza-system/
├── app/                    # rutas de Next.js (App Router)
│   ├── (auth)/             # login, logout
│   ├── (dashboard)/        # vistas autenticadas
│   │   ├── companies/
│   │   ├── contracts/
│   │   ├── tickets/
│   │   ├── payments/
│   │   ├── templates/
│   │   └── page.tsx        # dashboard principal
│   └── api/                # solo webhooks externos (Fase 3)
├── components/             # componentes UI reutilizables
│   ├── ui/                 # shadcn primitives
│   └── ...                 # componentes de dominio
├── domain/                 # lógica de negocio pura
│   ├── billing/
│   ├── contracts/
│   ├── payments/
│   └── ...
├── db/
│   ├── schema.prisma
│   ├── migrations/
│   ├── seed.ts
│   └── client.ts           # cliente Prisma exportado
├── lib/                    # utilidades
├── services/               # adapters externos (Resend, S3, etc.)
├── jobs/                   # crons y workers
├── prompts/                # (Fase 2) prompts de IA
├── docker-compose.yml
├── .env.example
├── CLAUDE.md
└── README.md
```

## Decisiones arquitectónicas

Documentadas inline en `CLAUDE.md` y en docstrings de cada módulo de `/domain`. Las grandes:

1. **Server Actions como API.** No REST endpoints salvo webhooks externos.
2. **Lógica en `/domain`, no en actions.** Las actions son finos wrappers que validan input y delegan.
3. **Soft delete con `deletedAt`** en entidades críticas.
4. **AuditLog append-only** para todo lo financiero.
5. **Single-tenant**, sin `tenant_id` en las tablas. Si en el futuro se hace SaaS, se refactoriza.
