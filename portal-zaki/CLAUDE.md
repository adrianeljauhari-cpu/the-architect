# PORTAL-ZAKI

Portal de venta mayorista B2B de la droguería ZAKIPHARMA: las farmacias entran, ven su precio y
existencia (espejados de Profit Plus), arman pedidos que salen como cotización por correo, y registran
comprobantes de pago. El dato maestro vive en Profit Plus; el portal solo lo espeja y nunca escribe en
el ERP.

## Commands

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev server | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Unit + integration tests | `pnpm test` · one file: `pnpm test <path>` |
| E2E | `pnpm test:e2e` |
| Local Postgres up / down | `pnpm db:up` · `pnpm db:down` |
| DB generate / migrate | `pnpm db:generate` · `pnpm db:migrate` |
| DB seed / studio | `pnpm db:seed` · `pnpm db:studio` |
| Sync agent (on-prem) | `pnpm agent:once` · `pnpm agent:sync` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` must pass before any task is marked done.

Runtime pinned in `package.json` `engines` (Node >=24) and `packageManager` (pnpm). Dependency
versions live in the lockfile — read it, never guess one.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn (Radix) · Postgres (Supabase) · Drizzle ·
Better Auth · Vercel. Sync agent: Node standalone via `tsx`, run on-prem. Money math: `big.js`.

## Architecture

**Request path.** browser → `src/app/(shop)/catalogo/page.tsx` (server) → `src/lib/catalog/queries.ts`
→ `src/lib/pricing/price.ts` (precio por cliente) + `src/lib/db/index.ts` → Postgres. Las mutaciones
(carrito, pedido, comprobante) son **server actions** en `src/lib/cart|orders`, nunca un `fetch`
cliente. El agente on-prem (`src/agent/sync.ts`) lee Profit por `row_id` y hace POST firmado a
`/api/ingest`, que hace upsert al espejo vía `src/lib/ingest/apply.ts`.

**Boundaries.** Cruzar mal una de estas rompe el build:

| Layer | May import from | Must never |
|---|---|---|
| `src/app/**` | `components`, `lib/catalog\|cart\|orders\|ingest`, `lib` | Importar `lib/db/` directo |
| `src/components/**` | `lib`, otros componentes | Importar `lib/db/` o `agent/` |
| `src/lib/pricing/**` | `lib/money`, `lib/db` (tipos) | Importar React o componentes |
| `src/agent/**` | `lib/db/schema`, `lib/env`, `lib/money` | Importar React o `components/` |
| `src/lib/db/**` | nada interno | Importar `lib/catalog\|orders\|...` |

**Where things live.**

| Concern | Single source of truth |
|---|---|
| Esquema DB | `src/lib/db/schema.ts` — cambiar aquí, luego `pnpm db:generate && pnpm db:migrate` |
| Acceso a env | `src/lib/env.ts` — validado; nunca leer `process.env` en otro lado |
| Precio del cliente | `src/lib/pricing/price.ts` — servidor; nunca en estado cliente |
| Dinero | `src/lib/money.ts` — `big.js`; nunca floats para la cascada |
| Sesión / auth | `src/lib/auth.ts` — un `getSession()`, usado en todos lados |
| Escritura al espejo | `src/lib/ingest/apply.ts` — el único camino de escritura a tablas espejo |

## Code rules

1. **Un componente por archivo. Máx 300 líneas.** Más que eso, dividir.
2. **Alias `@/` → `src/`.** Sin imports `../../..`.
3. **Server-first.** `"use client"` solo en la hoja que necesita estado/eventos, nunca en la página.
4. **Sin barrel files** (`index.ts` re-export).
5. **Validar en la frontera.** Cada route handler y server action parsea su entrada con `zod` antes de
   tocar lógica.
6. **Precio siempre server-side.** Ningún componente cliente recibe la lista base ni el `desc_glob` de
   otro cliente; el carrito recomputa en cada lectura.
7. **Dinero con `big.js`.** La cascada es multiplicativa; nunca sumar porcentajes ni usar floats.
8. **El espejo es solo lectura desde la app.** Solo `lib/ingest/apply.ts` escribe tablas espejo.
9. **Entre clientes se devuelve 404, no 403.**
10. **Sin nueva dependencia sin razón en el mensaje del commit.**

## Design system

Tokens definidos una vez en `src/app/globals.css` (`@theme`). Componentes referencian nombres de token.

| Role | Value (light) | Used for |
|---|---|---|
| Primary | `#0E7490` | Botones primarios, enlaces, foco |
| Background | `#F8FAFC` | Fondo de página |
| Surface | `#FFFFFF` | Tarjetas, paneles |
| Border | `#E2E8F0` | Divisores, inputs |
| Text | `#0F172A` | Cuerpo |
| Muted text | `#51607A` | Secundario |
| Destructive | `#B91C1C` | Errores |
| Success | `#15803D` | Confirmaciones |

- **Type:** Inter (headings 600, body 400 15/24); mono JetBrains Mono.
- **Scale:** 12/14/15/20/24/32 px. **Spacing:** base 4 — 4/8/12/16/24/32/48/64.
- **Radius:** 8px inputs/botones, 12px tarjetas. **Elevation:** plano, bordes.
- **Motion:** 150ms `ease-out`, transform/opacity; respeta `prefers-reduced-motion`.
- **Layout:** ancho máx 1200px; breakpoints sm640/md768/lg1024/xl1280.

## Environment

| Variable | Required from | Used by |
|---|---|---|
| `DATABASE_URL` | step 2 | `src/lib/db`, migraciones |
| `SYNC_SHARED_SECRET` | step 3 | ingest + agente |
| `INGEST_URL`, `PROFIT_SQL_*` | step 4 | agente |
| `BETTER_AUTH_SECRET` | step 6 | auth |
| `RESEND_API_KEY`, `ORDER_NOTIFY_EMAIL` | step 9 | correo |
| `SUPABASE_*`, `PROOF_NOTIFY_EMAIL` | step 10 | storage + correo |

`.env.example` se mantiene en sync. `.env*` con valores reales nunca se commitea. `src/lib/env.ts`
valida las variables requeridas por el paso ya alcanzado y falla con error nombrado.

## Rules

| File | Applies to |
|---|---|
| `.claude/rules/db.md` | `src/lib/db/**`, `drizzle/**` |
| `.claude/rules/pricing.md` | `src/lib/pricing/**`, `src/lib/money.ts` |
| `.claude/rules/agent.md` | `src/agent/**` |

## Non-negotiable

1. El portal **nunca** escribe en Profit Plus. La salida son correos (cotización, comprobante).
2. El precio se calcula server-side con la cascada de `src/lib/pricing`; nunca se confía en un precio
   del cliente.
3. La cascada es multiplicativa y usa `big.js`; los tests al céntimo de `tests/unit/pricing.test.ts`
   deben pasar siempre.
4. Nunca commitear secretos, `.env`, ni salida de build.
5. Nunca editar migraciones ya aplicadas ni archivos generados a mano.
6. Nunca marcar una tarea done con un gate en rojo.
