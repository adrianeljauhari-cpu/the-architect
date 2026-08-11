# PORTAL-ZAKI — agent instructions

Portal de venta mayorista B2B de ZAKIPHARMA. Espeja producto/precio/existencia/cliente de Profit Plus
(solo lectura), sirve un catálogo con precio por cliente, y saca pedidos como cotización por correo.
Nunca escribe en el ERP.

## Commands

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev server | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Tests | `pnpm test` · one file: `pnpm test <path>` |
| E2E | `pnpm test:e2e` |
| DB up / migrate / seed | `pnpm db:up` · `pnpm db:migrate` · `pnpm db:seed` |
| Sync agent | `pnpm agent:once` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` must pass before any task is marked done.

## Non-negotiable

1. El portal nunca escribe en Profit Plus; la salida son correos.
2. El precio se calcula server-side con la cascada de `src/lib/pricing`; nunca se confía en el cliente.
3. La cascada es multiplicativa con `big.js`; los tests al céntimo deben pasar.
4. Nunca commitear secretos, `.env`, ni salida de build.
5. Nunca marcar una tarea done con un gate en rojo.

Full architecture, boundaries, and design tokens: see `CLAUDE.md` in this directory.
