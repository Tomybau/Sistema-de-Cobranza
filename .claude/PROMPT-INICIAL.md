# Prompt inicial para Claude Code — Sistema de Cobranza

> Pegá esto en Claude Code después de copiar todos los archivos base al repo y de leer CLAUDE.md.

---

I'm starting development on a billing and contract management system. The project's `CLAUDE.md`, `README.md`, `db/schema.prisma`, `.env.example`, and `docker-compose.yml` are already in place. Read them carefully before doing anything — they are the source of truth for this project.

This is a real client project. Quality, clarity, and traceability come before speed.

## Your job in this session

Bootstrap Phase 1 of the project: scaffold the Next.js app, configure all the core dependencies, set up the database, create the auth flow, and build the first three navigable screens. By the end of this session, I should be able to run `npm run dev`, log in as an admin user, and see a working dashboard, a working companies list, and a working "create company" form.

Do NOT build everything from Phase 1 in this session. The goal is a solid, navigable foundation that we'll grow on top of in later sessions.

## Process — read this carefully

1. **Plan first.** Before writing any code, read `CLAUDE.md`, `README.md`, and `db/schema.prisma` end to end. Then give me a written plan: what you're going to do, in what order, what files you'll create, what decisions you need from me. Wait for my OK before executing.
2. **Checkpoints.** Stop and check in with me at the marked checkpoints below. Don't power through them.
3. **No silent assumptions.** If something is ambiguous between what I'm asking and what `CLAUDE.md` says, ask. If a library has multiple ways to do something, pick the one that matches the stack in `CLAUDE.md` and tell me what you picked.
4. **Verify as you go.** After scaffolding, run `npm run build` and `npx prisma validate`. After each screen, run `npm run dev` mentally (or actually) and check the route works.
5. **Token-diet is active.** Be dense. No preambles, no recaps, no "I'll now...". Plan, execute, report.

## Step 1 — Scaffold the Next.js project

Initialize a Next.js 15 app in the current directory with:
- App Router
- TypeScript strict mode
- Tailwind CSS
- ESLint
- src/ directory disabled (use root-level `app/`, `components/`, etc.)
- Import alias `@/*`

Then install the rest of the stack:
- `prisma` and `@prisma/client`
- `next-auth@beta` (Auth.js v5) and `@auth/prisma-adapter`
- `bcryptjs` and `@types/bcryptjs` (for password hashing)
- `zod`
- `react-hook-form` and `@hookform/resolvers`
- `@tanstack/react-table`
- `recharts`
- `resend`
- `@aws-sdk/client-s3` (works with MinIO)
- `date-fns`
- `lucide-react` (icons for shadcn)

Then initialize shadcn/ui with the default config (Slate base color, CSS variables enabled). Install these primitives to start: `button`, `input`, `label`, `form`, `card`, `table`, `dialog`, `dropdown-menu`, `sheet`, `toast`, `sonner`, `badge`, `select`, `separator`, `avatar`, `tabs`.

**CHECKPOINT 1:** Show me the final `package.json`, the `tsconfig.json`, and the `tailwind.config.ts`. Confirm `npm run build` passes on the empty scaffold. Then wait.

## Step 2 — Database setup

The `db/schema.prisma` already exists at `db/schema.prisma`, not at the default Prisma location. Configure Prisma to use that path:
- Update `package.json` to point Prisma at `db/schema.prisma`
- Create `db/client.ts` that exports a singleton PrismaClient instance (with the dev hot-reload protection pattern)
- Make sure migrations go into `db/migrations/`

Then:
1. Bring up Postgres with `docker compose up -d postgres`
2. Run `npx prisma migrate dev --name init`
3. Run `npx prisma generate`
4. Verify the migration applied cleanly

If Prisma complains about anything in the schema, STOP and tell me. Do not "fix" the schema unilaterally — that schema was designed deliberately. If something needs to change, propose the change and wait for my OK.

**CHECKPOINT 2:** Show me the migration file Prisma generated. Confirm it applied. Then wait.

## Step 3 — Auth.js v5 setup

Set up Auth.js v5 with credentials provider (email + password) backed by the `User` table in our schema. Specifically:

1. Create `auth.ts` at the root with the NextAuth config
2. Create `middleware.ts` that protects everything under `/(dashboard)` and redirects to `/login` if not authenticated
3. Create `app/(auth)/login/page.tsx` with a Server Component shell and a Client Component form using React Hook Form + Zod
4. Create the `signIn` server action that validates with Zod, looks up the user by email, compares the password hash with bcrypt, and creates the session
5. Create a `signOut` action
6. Add a small `UserMenu` component for the dashboard header that shows the current user and has a logout button

Important:
- Password hashes use bcrypt with cost 12
- The session strategy is JWT (simpler for single-tenant)
- Sessions last 7 days
- The login page should be polished — this is the first thing the client sees

**CHECKPOINT 3:** Show me the auth flow files. Walk me through how a login request flows from form submit to authenticated session. Then wait.

## Step 4 — Database seed

Create `db/seed.ts` that seeds:
- 1 admin user: email `admin@cobranza.local`, password `admin1234` (clearly marked as dev-only — log a warning if `NODE_ENV !== "development"` and refuse to run)
- 2 sample Companies with 1 Client each
- 1 sample Contract with 2 ContractItems (one RECURRING_FIXED, one ONE_TIME)
- 1 sample EmailTemplate for "ticket reminder"

Wire it up in `package.json` so `npx prisma db seed` works. Use `tsx` as the seed runner.

After running the seed, manually verify in Prisma Studio (`npx prisma studio`) or via a quick query that the data is there.

**CHECKPOINT 4:** Confirm the seed runs and the data is in the DB. Then wait.

## Step 5 — Layout and navigation shell

Create the dashboard layout:

1. `app/(dashboard)/layout.tsx` — Server Component with a sidebar (left) and main content area
2. Sidebar navigation with these items (most are placeholder links for now):
   - Dashboard (`/`)
   - Companies (`/companies`)
   - Contracts (`/contracts`)
   - Tickets (`/tickets`)
   - Payments (`/payments`)
   - Templates (`/templates`)
   - (separator)
   - Audit log (`/audit`)
3. Header with the `UserMenu` component on the right
4. Use shadcn `Sheet` for the mobile sidebar
5. Active link highlighting based on the current route

The visual style: clean, professional, dense (this is an internal admin tool, not a marketing site). White background, subtle borders, good spacing. Take cues from Linear or Vercel dashboard, not from a SaaS landing page.

**CHECKPOINT 5:** Show me the layout. Then wait.

## Step 6 — Three working screens

Build these three screens end to end. They have to work, not be mockups.

### 6a — Dashboard (`/`)

A Server Component that queries the DB and shows 4 KPI cards in a grid:
- Total billed this month (sum of `BillingTicket.amount` where `issueDate` is in current month)
- Total pending (sum where `status IN ('PENDING', 'SENT')`)
- Total overdue (sum where `status = 'OVERDUE'` or `dueDate < now AND status != 'PAID'`)
- Active contracts count

Below the cards, an empty placeholder for the chart that says "Coming soon — billing trend chart".

KPI calculations live in `domain/dashboard/queries.ts`, NOT inline in the page. The page imports the function and renders.

### 6b — Companies list (`/companies`)

A Server Component that loads all non-deleted companies and shows them in a table using TanStack Table + shadcn Table primitives.

Columns: Legal Name, Trade Name, Tax ID, Email, Clients (count), Active Contracts (count), Created.

Top right of the page: a "New Company" button that links to `/companies/new`.

The query lives in `domain/companies/queries.ts`.

If there are no companies, show an empty state with an illustration placeholder and a CTA to create one.

### 6c — New Company form (`/companies/new`)

A page with a form using React Hook Form + Zod. Fields:
- Legal Name (required)
- Trade Name (optional)
- Tax ID (optional, unique)
- Email (optional, must be valid email)
- Phone (optional)
- Address, City, Country (optional)
- Notes (optional, textarea)

Submitting calls a Server Action `createCompany` that:
1. Re-validates the input with Zod (never trust the client)
2. Checks tax ID uniqueness if provided
3. Inserts the company
4. Writes an `AuditLog` entry with action `company.create`, the new company ID, and the `afterData`
5. Redirects to `/companies` with a success toast

The action lives in `app/(dashboard)/companies/actions.ts` and delegates to `domain/companies/create.ts`. The action layer is thin (validate + audit + delegate). The domain layer has the actual logic.

**CHECKPOINT 6:** Walk me through how a "create company" flow works end to end. Show me the file tree of what you built. Then wait.

## Step 7 — Final verification and report

Run everything one more time:
1. `npm run build` passes
2. `npm run lint` passes
3. `docker compose up -d` brings up Postgres and MinIO
4. `npx prisma migrate dev` is up to date
5. `npx prisma db seed` works
6. `npm run dev` starts cleanly
7. Manually test: log in, see the dashboard, navigate to companies, create a new company, see it in the list

Then give me a final report with:
- File tree of everything created (excluding `node_modules`)
- Total lines of code added
- Any decisions you made that you want me to confirm
- Any TODOs you left (with a rationale why they're TODOs and not done)
- The next 3 things you'd recommend building in the next session

## Things to NOT do in this session

- Don't build the contracts screens. Just the navigation links.
- Don't build the tickets screens. Just the navigation links.
- Don't build the payment registration flow.
- Don't build the email template editor.
- Don't write any cron jobs.
- Don't touch the OCR/Phase 2 entities at all.
- Don't add any dependency that isn't in the list above without asking first.
- Don't modify `db/schema.prisma` without asking first.
- Don't generate test data beyond what the seed creates.
- Don't write tests (we'll set up testing in a dedicated session later).

## Final reminders

- `token-diet` is active. Be dense.
- This is real client code. No shortcuts that you'd be embarrassed by.
- When in doubt, ask. The CLAUDE.md is the law for this project.
