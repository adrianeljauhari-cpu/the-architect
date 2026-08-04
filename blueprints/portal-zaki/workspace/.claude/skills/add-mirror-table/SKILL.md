---
name: add-mirror-table
description: Use when adding a new read-only mirror of a Profit Plus table — "nueva tabla espejo de Profit", "sincronizar otra tabla del ERP". Wires schema, ingest branch and sync cursor together.
---

# Add mirror table

## When to use
Cuando haya que espejar una tabla nueva de Profit Plus en el portal.

## Steps
1. Añadir la tabla espejo en `src/lib/db/schema.ts` con `row_id_hex` y `synced_at`, y correr
   `add-migration`.
2. Añadir una rama en `src/lib/ingest/apply.ts` para el nuevo `source` (upsert por PK + avance de
   `sync_state`).
3. Añadir la lectura incremental por `row_id` en `src/agent/profit.ts` y su ciclo en `src/agent/sync.ts`.
4. Añadir el `source` al enum de validación del endpoint `/api/ingest`.

## Verify
```bash
pnpm test tests/integration/ingest.test.ts   # expect: exit 0 — covers the new source
```

## Do not
- Escribir la tabla espejo desde otro módulo que no sea `src/lib/ingest/apply.ts`.
