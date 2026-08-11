---
description: Database schema, mirror tables and migration conventions
paths:
  - "src/lib/db/**"
  - "drizzle/**"
---

# Datos: esquema y migraciones

- Dos familias de tablas: **espejo** (copia solo-lectura de Profit: `products`, `customers`, `offers`,
  `offer_lines`, `customer_offers`, `customer_offer_lines`, `product_caps`, `exchange_rate`) y
  **propias del portal** (`carts`, `orders`,
  `payment_proofs`, `app_users`, `sync_state`, `ingest_events`, `product_overrides`, `audit_log`).
- Las tablas espejo se escriben **solo** desde `src/lib/ingest/apply.ts`. Ningún otro módulo hace
  INSERT/UPDATE sobre ellas.
- Dinero y cantidades: `numeric`, nunca `float`. Precios unitarios `numeric(18,5)` (Profit usa hasta 5
  decimales); netos y totales `numeric(18,2)`.
- Timestamps `timestamptz`, UTC. `created_at`/`updated_at` donde aplique.
- Cada FK tiene índice. Uniques reales como constraint de DB (`app_users.co_cli`, `orders.order_number`).
- Cambiar el esquema: editar `schema.ts` → `pnpm db:generate` → `pnpm db:migrate`. **Nunca** editar una
  migración ya aplicada; añadir una nueva.
- Los pedidos y comprobantes guardan **snapshot** (descripción, precio, tasa); nunca se unen a
  `products`/`customers` vivos.
- Producción: expand → migrate → contract; nunca una migración destructiva en el mismo deploy que el
  código.
