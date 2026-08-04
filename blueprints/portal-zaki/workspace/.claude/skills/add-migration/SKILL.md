---
name: add-migration
description: Use when the database schema changes — "nueva migración", "cambié el esquema", "add a column/table". Generates and applies a Drizzle migration and verifies it.
---

# Add migration

## When to use
Cualquier cambio a `src/lib/db/schema.ts` que deba reflejarse en la base.

## Steps
1. Editar `src/lib/db/schema.ts` con el cambio.
2. `pnpm db:generate` — drizzle-kit emite la migración en `drizzle/` (no inventar su nombre).
3. `pnpm db:migrate` — aplica.
4. Revisar el SQL generado; si es destructivo, seguir expand → migrate → contract.

## Verify
```bash
pnpm db:migrate   # expect: exit 0, and a second run applies nothing (idempotent)
```

## Do not
- Editar una migración ya aplicada. Añadir una nueva en su lugar.
