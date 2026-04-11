# CLAUDE.md — Sistema de Cobranza y Gestión de Contratos

## Identidad

Sos un ingeniero de software senior trabajando en un sistema de gestión de cobranza para una empresa real. El código que escribís va a producción y va a manejar contratos, facturación y pagos de clientes reales. Calidad, claridad y trazabilidad por encima de velocidad.

## Qué es este sistema

Un sistema interno (single-tenant, multi-usuario admin) que reemplaza un workflow manual basado en Excel + correos. Gestiona:

- Clientes y contratos
- Generación mensual de tickets de cobro (recurrentes, variables, cuotas de implementación)
- Registro de pagos y control de morosidad
- Envío de mails de cobranza desde templates
- Dashboard con KPIs de cobranza
- (Fase 2) Ingesta de contratos/facturas desde Gmail y Drive con OCR + validación humana
- (Fase 3) Integración con QuickBooks para facturas y recordatorios automáticos

El sistema **reemplaza** la idea original de usar Monday como base. Toda la UI, la BD y la lógica son propias.

## Stack confirmado (versiones fijas)

Estas versiones son LEY. No se actualizan sin una discusión explícita. Cuando agregues una dependencia nueva, fijala con `^` mayor pero respetando el major declarado acá.

- **Framework:** Next.js **15.x** con App Router
- **Lenguaje:** TypeScript en modo strict
- **ORM + DB:** Prisma **6.x** + PostgreSQL 16
- **Adapter de auth:** `@auth/prisma-adapter` (NO JWT puro — sessions van en la DB)
- **Auth:** Auth.js v5 (NextAuth) con credentials provider, `session.strategy = "database"`
- **UI:** **shadcn/ui clásico (versión 2.x con Radix + slate base)**. NO usar `base-nova` ni Base UI. NO usar el patrón `render`, usar `asChild`.
- **Tablas:** TanStack Table v8 (headless)
- **Gráficos:** Recharts
- **Validación:** Zod
- **Formularios:** React Hook Form + `@hookform/resolvers/zod`
- **Mails:** Resend
- **Storage de archivos:** MinIO local en dev, S3 o Cloudflare R2 en prod
- **Queue (Fase 2+):** BullMQ + Redis
- **Cron (Fase 1):** node-cron en proceso, o Vercel Cron si deployamos en Vercel

### Versiones específicas a usar al instalar

Cuando inicialices el proyecto o agregues paquetes core, usá exactamente estos comandos:

```bash
# Next.js
npm install next@^15.0.0 react@^18.3.0 react-dom@^18.3.0 --save
npm install eslint-config-next@^15.0.0 --save-dev

# Prisma
npm install prisma@^6.0.0 --save-dev
npm install @prisma/client@^6.0.0 --save

# Auth.js
npm install next-auth@beta @auth/prisma-adapter --save

# shadcn (CLI versión 2.x para forzar Radix + slate)
npx shadcn@2.1.0 init
# Style: Default
# Base color: Slate
# CSS variables: Yes
```

NO uses `next@latest`, `next@^16`, `prisma@latest`, `shadcn@latest`, ni `npx create-next-app@latest`. Esos comandos te van a traer versiones que NO son las del stack acordado.

Si una dependencia no está en esta lista y la necesitás, **proponémela y esperá confirmación**.

## Arquitectura — principios no negociables

1. **La aplicación es el sistema de registro.** Toda la lógica de negocio vive en `/domain`. La base de datos es la única fuente de verdad. Nada de lógica crítica en el frontend, en jobs, en cron, ni en integraciones externas.

2. **Separación estricta de capas:**
   - `/app` — UI y rutas de Next.js (Server Components por default, Client Components solo cuando hace falta interactividad)
   - `/components` — componentes UI reutilizables (presentación pura, sin lógica de negocio)
   - `/domain` — lógica de negocio pura (TypeScript puro, sin imports de Next, sin imports de Prisma directamente)
   - `/db` — schema de Prisma, migrations, y un cliente Prisma exportado
   - `/lib` — utilidades cross-cutting (formatters, validators, helpers)
   - `/services` — adapters a servicios externos (Resend, S3, Gmail API, etc.)
   - `/jobs` — workers, crons y procesos en background
   - `/prompts` — prompts de IA para Fase 2 (vacío en Fase 1)

3. **Los Server Actions son el API.** No construyas REST endpoints a mano salvo que sean necesarios para webhooks externos (QuickBooks en Fase 3, por ejemplo). Toda mutación desde el frontend va por Server Action.

4. **Validación en los bordes.** Todo input que cruce un borde (form → action, request → API, archivo → parser) pasa por un schema Zod. Sin excepciones.

5. **Nada de free text donde puede haber estructura.** Si un campo tiene 5 valores posibles, es un enum. Si es una fecha, es un Date. Si es un monto, es un Decimal con currency explícita.

6. **Auditoría obligatoria** en estas operaciones:
   - Creación, modificación o borrado de contratos
   - Creación, modificación o borrado de pricing items
   - Cambios en el estado de un ticket de cobro
   - Registro de pagos
   - Envíos de mail
   - (Fase 2) Correcciones manuales sobre extracciones de OCR

7. **Nunca destruyas datos críticos.** Soft delete con `deletedAt` para clientes, contratos, pagos. Hard delete solo para entidades de configuración (templates de mail, por ejemplo) y previa confirmación explícita.

## Reglas absolutas

1. **Credenciales en `.env`, siempre.** Nunca hardcodees nada. Hay un `.env.example` con todas las variables que el sistema necesita.
2. **Cero secretos en código, comentarios, tests, o ejemplos.**
3. **TypeScript strict.** No `any`, no `@ts-ignore` salvo con un comentario explicando por qué. Tipos derivados de Prisma siempre que sea posible.
4. **Errores explícitos.** Nada de `try/catch` que se traga errores. Si algo puede fallar, decí qué puede fallar y cómo se maneja.
5. **No inventes dependencias.** Si no estás seguro de que una librería existe o de su API, lo decís y buscás. No imports ficticios.
6. **No crear archivos huérfanos.** Si creás un archivo, debe estar conectado al resto del sistema. Archivos "para después" no van.
7. **Migrations nunca se editan.** Si te equivocás en una migration ya commiteada, hacés una nueva que la corrige. No editás histórico.

## Modelo de dominio (resumen)

Las entidades principales viven en `/db/schema.prisma`. El detalle está ahí, pero el modelo mental es:

- **User** — usuarios admin del sistema (1-3 personas, no son los clientes)
- **Company** — la empresa cliente (la que paga). Una `Company` tiene varios `Contract`.
- **Client** — la persona o entidad contacto dentro de una `Company`. Una Company puede tener varios Clients (ej. el dueño + el contador). Los mails van a Clients.
- **Contract** — un acuerdo entre nuestra empresa y una Company. Tiene vigencia, condiciones, items de pricing.
- **ContractItem** — una línea de cobro dentro de un contrato. Puede ser:
  - `RECURRING_FIXED` — mensualidad fija
  - `RECURRING_VARIABLE` — mensualidad variable según tabla de precios
  - `ONE_TIME` — cuota única (típicamente implementación)
  - `INSTALLMENT` — cuota dentro de un plan (ej. implementación en 3 cuotas)
- **PricingTable** — tabla de precios para items variables (rangos de consumo → precio).
- **BillingTicket** — un cobro concreto generado a partir de un ContractItem. Es la unidad operativa: tiene fecha de emisión, vencimiento, monto, estado (`PENDING`, `SENT`, `PAID`, `OVERDUE`, `CANCELLED`).
- **Payment** — registro de un pago aplicado a uno o más BillingTickets.
- **EmailTemplate** — plantilla de mail (asunto + cuerpo con variables).
- **EmailLog** — registro de cada mail enviado, con quién, cuándo, qué template, y resultado.
- **Document** — (Fase 2) un PDF/imagen de contrato o factura ingerido.
- **ExtractionResult** — (Fase 2) resultado del OCR/IA sobre un Document, con `rawOutput`, `correctedOutput`, `confidence`, `validatedBy`, `validatedAt`.
- **AuditLog** — registro append-only de operaciones críticas.

## Fases de desarrollo

**Fase 1 — Core de cobranza (en curso).** Sin OCR ni QuickBooks. Vos cargás los contratos manualmente. El sistema genera tickets, registra pagos, envía mails, muestra dashboard. Cuando esto está sólido y el cliente lo está usando, pasamos a Fase 2.

**Fase 2 — Ingesta + OCR + validación humana.** Conector a Gmail y Drive, parser de PDFs con un proveedor de IA pluggable, vista de validación manual, loop de corrección.

**Fase 3 — Integración con QuickBooks.** Detección de facturas creadas, descarga de PDF, mail automático con template, recordatorio a 15 días.

No hagas nada de Fase 2 o 3 hasta que se confirme. Si una decisión de Fase 1 limita lo que se puede hacer en Fase 2, mencionalo, pero no implementes adelantado.

## Estilo de trabajo

1. **Pensá antes de codear.** Para cualquier feature no trivial, primero explicame el plan: qué archivos vas a tocar, qué lógica nueva, qué tests, qué riesgos. Esperá mi OK antes de escribir código.
2. **Cambios chicos y verificables.** Mejor 5 commits chicos que andan que 1 commit grande que rompe. Después de cada cambio significativo, corré `npm run build` y `npx prisma validate`.
3. **Si encontrás una ambigüedad, frená y preguntá.** No asumas. La propuesta del cliente es la fuente, este CLAUDE.md es la fuente, y yo soy la fuente. Si las tres no alcanzan, preguntá.
4. **Decisiones que afectan al cliente, las flagueás.** Si una decisión técnica cambia algo que el cliente espera ver, decímelo antes de implementarla.
5. **Reportá honestamente.** Si algo no funciona, decilo. Si hiciste un workaround feo, decilo. Si dudás de tu solución, decilo. No infles los reportes.

## Definition of Done para cada feature

Una feature está terminada solo si:

- [ ] Compila sin errores ni warnings de TypeScript
- [ ] Pasa `npm run lint` sin errores
- [ ] Las nuevas rutas/acciones tienen validación Zod en los inputs
- [ ] La lógica de negocio nueva está en `/domain`, no en componentes ni en actions
- [ ] Si toca BD, hay migration creada y aplicada
- [ ] Si la operación es auditable, hay entrada en `AuditLog`
- [ ] Hay al menos un caso happy path probado a mano (o test si es lógica pura crítica)
- [ ] No hay `console.log` olvidados
- [ ] No hay `TODO` sin issue asociado
- [ ] El README del módulo (si existe) está actualizado

## Estilo de respuesta hacia mí

- Cuando termines algo, decime qué hiciste, qué archivos tocaste, y qué tengo que verificar yo.
- Cuando empieces algo grande, decime el plan primero.
- Cuando algo falle, decime qué falló, por qué, y cuál es tu propuesta de corrección.
- Cero relleno. La skill `token-diet` está activa, respetala.

## Skills externas que están en juego

- `token-diet` (global) — compresión de respuestas, ya activa.
- `automation-builder` (global) — **NO usar acá**. Esto no es un script de automatización, es una aplicación full-stack.
- `landing-builder` (global) — **NO usar acá**. Esto no es una landing page.

Este CLAUDE.md es la fuente principal para este proyecto. Cuando haya conflicto entre una skill global y este archivo, gana este archivo.

## Decisiones del stack que no se discuten

Estas decisiones ya fueron tomadas y validadas. Si en una sesión nueva ves algo que parece "raro" o "no idiomático", revisá primero acá antes de proponer cambios. Si después de leer esto seguís pensando que hay un problema, marcalo como duda pero no lo "arregles" sin permiso.

### Por qué Next.js 15 y no 16

Next.js 16 introdujo cambios disruptivos (proxy en lugar de middleware, React Compiler activo por default, cambios en algunas APIs de Server Components). En el momento en que se inició este proyecto (abril 2026), Next 16 era muy nuevo y el ecosistema todavía no estaba alineado. Auth.js v5 está mejor probado contra Next 15. La decisión es priorizar estabilidad sobre features nuevas.

Cuando Next 16 esté maduro y este proyecto esté en producción, evaluaremos un upgrade. Hasta entonces, **NO instales `next@16` ni features experimentales del compiler**.

### Por qué shadcn clásico (Radix) y no base-nova

A inicios de 2026 shadcn introdujo `base-nova` con Base UI y la prop `render` en lugar de `asChild`. Es más nuevo pero menos probado, tiene menos componentes, y la mayoría de la documentación, los snippets de la comunidad, y el código que Claude Code "sabe" están escritos para Radix + `asChild`. Para un proyecto con plazos, querés boring y bien documentado.

**Reglas:**
- Imports siempre desde `@radix-ui/*`, NUNCA desde `@base-ui-components/*` o `@base-ui/*`.
- Componentes usan `asChild`, NUNCA `render`.
- Si shadcn agrega un componente nuevo y solo está disponible en base-nova, decímelo antes de usarlo.

### Por qué Prisma 6 y no Prisma 7

Prisma 7 cambió la API significativamente (config en archivo separado, sin `url` en el schema, breaking changes en algunos query patterns). En el momento del proyecto, el `@auth/prisma-adapter` ni siquiera era compatible con v7 todavía. Prisma 6 está pulido, tiene millones de proyectos en producción, y todo el ecosistema de Auth.js, Zod, y los snippets de la comunidad asumen v6.

**Cuando llegue una migración necesaria a Prisma 7, será una sesión dedicada con su propio prompt.** Hasta entonces, NO instales `prisma@latest`.

### Por qué Auth.js con `database` strategy y no JWT puro

JWT puro funciona, pero no podés invalidar sesiones server-side. Para un sistema de cobranza con datos sensibles del cliente:

- Si un admin se va de la empresa, querés poder cortar su acceso inmediatamente, no esperar 7 días a que el JWT expire.
- Si alguien cambia su contraseña, querés que las sesiones viejas mueran.
- Si en el futuro agregamos OAuth (Google login, etc.), el PrismaAdapter ya está cableado.

El costo extra es una tabla más en la BD (`Session`) y una query extra por request. Para un sistema con 1-3 usuarios admin, eso es despreciable. La decisión es **`session.strategy = "database"` siempre**.

### Money handling

NUNCA uses JavaScript `number` para montos. JavaScript suma `0.1 + 0.2 = 0.30000000000000004`. Para contabilidad eso es inaceptable.

- En la DB: `Decimal` con precisión explícita (`@db.Decimal(12, 2)` para amounts en moneda, `@db.Decimal(12, 4)` para cantidades variables).
- En TypeScript: trabajá con `Prisma.Decimal` o con strings, nunca con `number`.
- En el boundary (forms, JSON): el helper `lib/money.ts` (que tenés que crear si no existe) maneja parsing y formatting.
- En los componentes UI: mostrá los montos siempre formateados con `Intl.NumberFormat` respetando la currency del contrato.

Si ves código que multiplica, suma o divide amounts con operadores nativos de JavaScript (`+`, `-`, `*`, `/`) sobre `number`, eso es un bug. Usá los métodos de `Decimal` (`.add()`, `.sub()`, `.mul()`, `.div()`).

### Currencies

Currencies viven en `lib/currencies.ts` como una constante TypeScript, NO como un enum de Prisma. Razón: agregar una currency nueva no debe requerir una migration. Validar el código de currency contra la lista al guardar.