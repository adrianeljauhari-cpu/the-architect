# Epic 02: Tienda, pedidos y operación

> Al terminar existe la tienda completa: catálogo con precio por cliente, carrito server-authoritative, envío de pedido como cotización congelada por correo, registro de comprobantes, cuenta con cupo y saldo, panel de administración, salud y reconciliación, y el e2e/a11y/CI/deploy que cierra el build.

| | |
|---|---|
| **Epic id** | `02-tienda` |
| **Tasks** | `E2-T1` … `E2-T8` |
| **Depends on** | `01-cimientos` |
| **Unlocks** | none — epic final |
| **Parallel with** | none — depende por completo de `01-cimientos` |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Postgres gestionado (Supabase) · Drizzle · Better Auth · Vercel + Supabase + 1 PC Windows on-prem (agente).
Package manager: `pnpm`. Runtime pinado en `engines.node` `>=24` (Node.js LTS 24). Las versiones de dependencias viven en el lockfile — léelo, nunca adivines una.

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test (un archivo) | `pnpm test {path}` |
| E2E (un archivo) | `pnpm test:e2e {path}` |
| Migrar | `pnpm db:migrate` |
| Sembrar | `pnpm db:seed` |
| Servicios locales (Postgres) | `pnpm db:up` / `pnpm db:down` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar hecho cualquier task de este epic.

Si un task de abajo verifica contra un servicio real, levántalo primero con `pnpm db:up`. El `docker-compose.yml` que lo define se emitió en `workspace/` y ya está en el raíz del proyecto — no lo escribes tú, y nunca sustituyes por un fake un servicio que los criterios de aceptación nombran. Los tests e2e necesitan los binarios de Playwright, ya instalados en el Bootstrap (`pnpm exec playwright install`).

## Directory subtree

Solo las partes que este epic toca:

```
src/
  lib/
    catalog/queries.ts        # lecturas del catálogo scoped por co_cli — NEW en T1, se extiende en T5
    cart/server.ts            # mutaciones de carrito server-authoritative — NEW en T2
    orders/server.ts          # crear cotización desde carrito, snapshot inmutable — NEW en T3
    email.ts                  # cliente Resend + envíos — NEW en T3
    storage.ts                # cliente Supabase Storage + URL firmada — NEW en T4
    reconcile.ts              # comprobaciones de integridad de pedidos/precios — NEW en T7
    env.ts                    # se extiende: RESEND_* (T3), SUPABASE_*/PROOF_NOTIFY (T4)
  app/
    (shop)/
      catalogo/page.tsx       # PLP con precio por cliente y stock — NEW en T1
      producto/[co_art]/page.tsx # PDP — NEW en T1
      carrito/page.tsx        # carrito recomputado server-side — NEW en T2
      cuenta/pagos/page.tsx   # registrar comprobante de pago — NEW en T4
      cuenta/page.tsx         # cupo, saldo, historial — NEW en T5
    (admin)/admin/
      page.tsx                # tablero: estado de sync — NEW en T6
      productos/page.tsx      # ocultar productos, cargar fotos — NEW en T6
      clientes/page.tsx       # activar clientes — NEW en T6
    api/health/route.ts       # se extiende con frescura del espejo — EDIT en T7
tests/
  integration/catalog.test.ts   # precio del cliente; oculto ausente; agotado marcado — NEW en T1
  integration/cart.test.ts      # precio del cliente ignorado; sin sobreventa — NEW en T2
  integration/orders.test.ts    # 1 pedido con precio congelado; correo — NEW en T3
  integration/proofs.test.ts    # comprobante guardado + correo — NEW en T4
  integration/account.test.ts   # cupo/saldo correctos; aislamiento por cliente — NEW en T5
  integration/admin.test.ts     # ocultar saca del catálogo; no-admin 404 — NEW en T6
  integration/reconcile.test.ts # reconciliación sin diferencias — NEW en T7
  e2e/pedido.spec.ts            # entrar→catálogo→carrito→enviar — NEW en T8
  e2e/a11y.spec.ts              # axe sobre catálogo y carrito — NEW en T8
.github/workflows/ci.yml        # gate global §20.1 — NEW en T8
vercel.json                     # config de deploy — NEW en T8
```

Todo lo que quede fuera de este subárbol está fuera de alcance. Si un task parece exigir editar un archivo que no está listado aquí, detente y reporta — significa que la frontera del epic está mal.

## Data model touched here

El esquema completo de §4 ya lo autoría `01-cimientos` (`src/lib/db/schema.ts`). Este epic **no** redefine tablas; lee y escribe estas:

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `products` | lee `co_art`, `art_des`, `prec_vta1`, `stock_act`, `stock_com`, `anulado` | Fuente del catálogo; `disponible = max(0, stock_act - stock_com)` |
| `product_overrides` | lee/escribe `is_hidden`, `photo_url` | Admin oculta/muestra y carga fotos (T6); catálogo filtra `is_hidden` (T1) |
| `customers` | lee `desc_glob`, `mont_cre`, `saldo`, `plaz_pag`, `sincredito`, `cond_1pct` | Precio por cliente y datos de crédito de la cuenta |
| `carts` | escribe `status` (`open`→`submitted`), `app_user_id` | Un carrito abierto por usuario (T2, T3) |
| `cart_lines` | escribe `co_art`, `qty`; unique (`cart_id`,`co_art`) | Guarda solo producto+cantidad; el precio se recalcula (T2) |
| `orders` | escribe `order_number`, `usd_bs_used`, `applied_1pct`, `subtotal`, `total`, `status` | Snapshot inmutable de la cotización (T3); leído por cuenta (T5) y admin |
| `order_lines` | escribe `co_art`, `art_des`, `qty`, `prec_vta1`, `cascade`, `unit_frozen`, `line_net` | Precio congelado; nunca se une a `products` vivos (T3) |
| `payment_proofs` | escribe `amount`, `currency`, `method`, `reference`, `image_url`, `emailed_at` | Comprobante del cliente; URL firmada (T4); leído por cuenta (T5) |
| `exchange_rate` | lee `usd_bs`, `effective_at` | Tasa congelada en el pedido (T3) y mostrada "de HH:MM" |
| `sync_state` | lee `source`, `last_run_at`, `last_status` | Frescura por fuente en el tablero admin (T6) y salud (T7) |
| `app_users` | escribe (admin activa un `co_cli` sin contacto) | Provisión manual desde el panel (T6) |

## Contracts

**Consumed** — ya existe (de `01-cimientos`), no lo reconstruyas:

| From | Interface | Guarantee |
|---|---|---|
| `01-cimientos` | `src/lib/pricing/price.ts` → `price(client, product, qty)` | Devuelve `{ unitFrozen, lineNet, cascade, applies1pct }`, precio efectivo por cliente con tope `porc_max` y flag del 1% |
| `01-cimientos` | `src/lib/auth.ts` → `getSession()` | Devuelve `{ appUser: { id, co_cli, role } }` o `null`; base del scope por `co_cli` y del rol admin |
| `01-cimientos` | `src/lib/db/index.ts` → `db`, `src/lib/db/schema.ts` | Cliente Drizzle tipado + esquema de todas las tablas de §4; única apertura de conexión |
| `01-cimientos` | `src/lib/ingest/apply.ts` → `apply(...)` | Upsert idempotente al espejo; el admin lo referencia para el estado de sync |

**Produced** — epics posteriores dependen de estas firmas:

| Export | Signature | Used by |
|---|---|---|
| — | — | Epic final; ningún epic posterior lo consume |

## Conventions that bite in this area

- **Nada en `src/app/**` importa `src/lib/db/` directamente.** Pasa por `src/lib/catalog`, `src/lib/cart`, `src/lib/orders`. Editar una tabla desde una página salta la capa de datos.
- **El precio se recalcula server-side en cada lectura; nunca se confía en un precio del cliente.** El carrito guarda solo `co_art`+`qty`; el precio y los totales se recomputan con `price()` en cada render y en el envío.
- **El `co_cli` de la sesión es un parámetro obligatorio de la capa de datos**, no un "acuérdate de filtrar". Entre clientes se devuelve **404, no 403**.
- **`/catalogo` y `/producto/[co_art]` son server components `force-dynamic`** (precio por usuario, nunca cacheado entre clientes); `/carrito`, `/cuenta/*` y `/admin/*` son `no-store`.
- **Las líneas de pedido y de comprobante guardan snapshot; nunca se unen a `products`/`customers` vivos.** El pedido es inmutable.
- **El 1% global se aplica solo si `customers.cond_1pct`** — y se refleja en `orders.applied_1pct`.
- **Los comprobantes se sirven por URL firmada, nunca pública** (Supabase Storage).
- **El agotado se muestra marcado "No disponible", no se oculta** (decisión del dossier). Ocultar es solo `product_overrides.is_hidden`, controlado por el admin.

Reglas completas del proyecto: `CLAUDE.md`. Reglas de área: `.claude/rules/db.md`, `.claude/rules/pricing.md`, `.claude/rules/agent.md`. Ambos sitios están en el raíz del proyecto — el builder los copió allí desde `workspace/` antes del primer task.

---

## Tasks

Listados en el mismo orden que `tasks.json`. Ese orden es el orden de build — trabaja de arriba abajo y no lo re-ordenes por prioridad ni por lo que parezca rápido.

### `E2-T1` — Catalog PLP/PDP with per-client price

**Depends on:** `E1-T5`, `E1-T6` · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

Las páginas de catálogo, server-rendered, con el precio del cliente y la existencia. `src/lib/catalog/queries.ts` recibe el `co_cli` de la sesión, aplica `product_overrides.is_hidden`, calcula `disponible = max(0, stock_act - stock_com)`, y el precio con `src/lib/pricing/price.ts`; hace búsqueda por texto sobre el índice GIN de `art_des` y paginación por cursor con tope 60 por página. `catalogo/page.tsx` y `producto/[co_art]/page.tsx` son server components `force-dynamic` que muestran Bs y USD (tasa "de HH:MM") y el disponible; el agotado se muestra marcado, no oculto, y la PDP de un producto oculto devuelve 404.

**Files**
- `src/lib/catalog/queries.ts` — new: lecturas scoped por `co_cli`, filtro `is_hidden`, `disponible`, precio, búsqueda GIN, cursor
- `src/app/(shop)/catalogo/page.tsx` — new: PLP server component `force-dynamic`
- `src/app/(shop)/producto/[co_art]/page.tsx` — new: PDP server component; 404 si oculto
- `tests/integration/catalog.test.ts` — new: precio del cliente correcto; oculto ausente y 404; agotado marcado

**Acceptance**

1. **WHEN** a signed-in client opens `/catalogo` **THE SYSTEM SHALL** show each product's price computed with that client's `desc_glob` and offers.
2. **WHEN** a product has `is_hidden = true` **THE SYSTEM SHALL** omit it from the listing and return 404 for its PDP.
3. **WHEN** a product's `disponible` is 0 **THE SYSTEM SHALL** show it marked "No disponible" rather than hide it.
4. **WHEN** a client searches a term **THE SYSTEM SHALL** return matches from `art_des` using the text index, capped at 60 per page.

**Verify**

```bash
pnpm test tests/integration/catalog.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T1: Catalog PLP/PDP with per-client price"
git tag step-07-catalog
```

### `E2-T2` — Server-authoritative cart with anti-oversell

**Depends on:** `E2-T1` · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

El carrito con precios y totales calculados en el servidor. `src/lib/cart/server.ts` hace add/update/remove sobre `cart_lines` (guardando solo `co_art`+`qty`), recomputa todos los precios y totales server-side en cada lectura usando el `desc_glob` del cliente, e ignora cualquier precio que venga del cliente. Rechaza cantidades por encima del `disponible` reportando la cantidad disponible, y al agregar el mismo producto dos veces mantiene una sola línea sumando la cantidad (unique `cart_id`,`co_art`). `carrito/page.tsx` muestra las líneas recomputadas, el subtotal, el 1% si aplica, el total y la tasa "de HH:MM".

**Files**
- `src/lib/cart/server.ts` — new: mutaciones server-authoritative; recomputa precios; anti-sobreventa; dedup por producto
- `src/app/(shop)/carrito/page.tsx` — new: carrito `no-store` con líneas recomputadas y resumen
- `tests/integration/cart.test.ts` — new: precio del cliente ignorado; sobreventa rechazada; dedup de líneas

**Acceptance**

1. **WHEN** a client submits a tampered line price **THE SYSTEM SHALL** ignore it and compute the total from the mirror and the pricing engine.
2. **WHEN** a client sets a line quantity above the product's `disponible` **THE SYSTEM SHALL** reject the update and report the available amount.
3. **WHEN** a cart is read **THE SYSTEM SHALL** recompute every line price server-side using the client's `desc_glob`.
4. **WHEN** the same product is added twice **THE SYSTEM SHALL** keep one line and sum the quantity.

**Verify**

```bash
pnpm test tests/integration/cart.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T2: Server-authoritative cart with anti-oversell"
git tag step-08-cart
```

### `E2-T3` — Quote submission with frozen price and email

**Depends on:** `E2-T2` · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

Convierte el carrito en cotización con el precio congelado y notifica. `src/lib/orders/server.ts` recomputa cada línea server-side, congela `unit_frozen`/`cascade`/`line_net`, toma la tasa vigente en `usd_bs_used`, aplica el 1% solo si `cond_1pct` (marcando `applied_1pct`), genera `order_number`, escribe `orders`+`order_lines` en una transacción y marca el carrito `submitted`. `src/lib/email.ts` es el cliente Resend que envía la cotización a ZAKIPHARMA y al cliente. Extiende `src/lib/env.ts` para requerir `RESEND_API_KEY` y `ORDER_NOTIFY_EMAIL`. Si una línea referencia un producto oculto o agotado, no crea pedido y reporta las líneas ofensoras. El test usa un doble del cliente Resend.

**Files**
- `src/lib/orders/server.ts` — new: recompute+freeze, tasa, 1%, `order_number`, transacción, marca `submitted`
- `src/lib/email.ts` — new: cliente Resend + envío de la cotización
- `src/lib/env.ts` — edit: requerir `RESEND_API_KEY` y `ORDER_NOTIFY_EMAIL` desde este paso
- `tests/integration/orders.test.ts` — new: un pedido con precio congelado; correo despachado (Resend doblado)

**Acceptance**

1. **WHEN** a client submits a cart **THE SYSTEM SHALL** create exactly one `orders` row and one `order_lines` row per cart line, each with `unit_frozen` from the pricing engine.
2. **WHEN** the order is created **THE SYSTEM SHALL** freeze `usd_bs_used` to the current mirror rate.
3. **WHEN** the client is `cond_1pct = true` **THE SYSTEM SHALL** set `applied_1pct = true` and reduce the subtotal by 1%; otherwise `applied_1pct = false`.
4. **WHEN** the order is created **THE SYSTEM SHALL** send the quotation email and mark the cart `submitted`.
5. **WHEN** a line references a hidden or out-of-stock product **THE SYSTEM SHALL** create no order and report the offending lines.

**Verify**

```bash
pnpm test tests/integration/orders.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T3: Quote submission with frozen price and email"
git tag step-09-orders
```

### `E2-T4` — Payment proof capture

**Depends on:** `E1-T6` · **Priority:** p1 — metadata para recortes de alcance, no orden de ejecución

El registro de comprobantes de pago. `src/lib/storage.ts` es el cliente Supabase Storage que sube la imagen y devuelve una **URL firmada** (nunca pública). `cuenta/pagos/page.tsx` es el formulario (`react-hook-form`+`zod`) de monto, moneda, método, referencia, imagen y nota; su server action valida, sube la imagen, inserta una fila en `payment_proofs`, envía el correo a ZAKIPHARMA y sella `emailed_at` **después** del despacho del correo. Extiende `src/lib/env.ts` para requerir `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` y `PROOF_NOTIFY_EMAIL`. Un comprobante con un campo requerido faltante se rechaza y no escribe nada. El test usa dobles de Storage y Resend.

**Files**
- `src/lib/storage.ts` — new: cliente Supabase Storage; sube y devuelve URL firmada
- `src/app/(shop)/cuenta/pagos/page.tsx` — new: formulario + server action que inserta `payment_proofs` y notifica
- `src/lib/env.ts` — edit: requerir `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PROOF_NOTIFY_EMAIL` desde este paso
- `tests/integration/proofs.test.ts` — new: comprobante guardado; correo despachado; validación (dobles de Storage/Resend)

**Acceptance**

1. **WHEN** a client submits a valid proof **THE SYSTEM SHALL** store the image, insert one `payment_proofs` row, and send the notification email.
2. **WHEN** a proof is missing a required field **THE SYSTEM SHALL** reject it and write nothing.
3. **WHEN** the proof is stored **THE SYSTEM SHALL** set `emailed_at` after the email is dispatched.
4. **WHEN** a client requests the proof image URL **THE SYSTEM SHALL** return a signed URL, not a public one.

**Verify**

```bash
pnpm test tests/integration/proofs.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T4: Payment proof capture"
git tag step-10-proofs
```

### `E2-T5` — Account: credit, balance and history

**Depends on:** `E2-T3`, `E2-T4` · **Priority:** p1 — metadata para recortes de alcance, no orden de ejecución

La página de cuenta con datos de crédito y el historial. `cuenta/page.tsx` muestra `mont_cre` (cupo), `saldo`, `plaz_pag` y si el cliente es contado o crédito, más el historial de `orders` y `payment_proofs` del cliente. Extiende `src/lib/catalog/queries.ts` con lecturas del historial y del crédito, siempre scoped por `co_cli`, de modo que un cliente solo ve sus propios pedidos y comprobantes y pedir el pedido de otro cliente por id devuelve 404. Si `sincredito = true`, la cuenta se etiqueta "contado".

**Files**
- `src/app/(shop)/cuenta/page.tsx` — new: cupo, saldo, plazo, etiqueta contado/crédito, historial
- `src/lib/catalog/queries.ts` — edit: lecturas de historial y crédito scoped por `co_cli`
- `tests/integration/account.test.ts` — new: cupo/saldo correctos; aislamiento por cliente (404); etiqueta contado

**Acceptance**

1. **WHEN** a client opens `/cuenta` **THE SYSTEM SHALL** show their `mont_cre`, `saldo` and `plaz_pag` from the mirror.
2. **WHEN** a client opens `/cuenta` **THE SYSTEM SHALL** list only their own orders and proofs.
3. **WHEN** a client requests another client's order by id **THE SYSTEM SHALL** return 404.
4. **WHEN** a client is `sincredito = true` **THE SYSTEM SHALL** label the account "contado".

**Verify**

```bash
pnpm test tests/integration/account.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T5: Account: credit, balance and history"
git tag step-11-account
```

### `E2-T6` — Admin panel: overrides, photos, activation, sync

**Depends on:** `E1-T3`, `E1-T6` · **Priority:** p1 — metadata para recortes de alcance, no orden de ejecución

El panel de administración mínimo, protegido por `role = admin` (un no-admin recibe 404 en cualquier `/admin`). `admin/page.tsx` es el tablero con el estado de `sync_state` (última corrida y frescura por fuente). `admin/productos/page.tsx` oculta/muestra productos vía `product_overrides` (ocultar saca el producto del catálogo del cliente) y carga fotos a Storage. `admin/clientes/page.tsx` activa clientes sin contacto creando su `app_users` ligado al `co_cli`. La autorización se verifica server-side en cada acción.

**Files**
- `src/app/(admin)/admin/productos/page.tsx` — new: ocultar/mostrar productos + cargar fotos
- `src/app/(admin)/admin/clientes/page.tsx` — new: activar clientes (crear `app_users`)
- `src/app/(admin)/admin/page.tsx` — new: tablero con estado de `sync_state`
- `tests/integration/admin.test.ts` — new: ocultar saca del catálogo; no-admin 404; activación crea `app_users`

**Acceptance**

1. **WHEN** an admin hides a product **THE SYSTEM SHALL** set `is_hidden = true` and the product SHALL disappear from the client catalog.
2. **WHEN** a non-admin requests any `/admin` route **THE SYSTEM SHALL** return 404.
3. **WHEN** an admin activates a contactless client **THE SYSTEM SHALL** create an `app_users` row for that `co_cli`.
4. **WHEN** an admin opens the dashboard **THE SYSTEM SHALL** show the last sync time per source from `sync_state`.

**Verify**

```bash
pnpm test tests/integration/admin.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T6: Admin panel: overrides, photos, activation, sync"
git tag step-12-admin
```

### `E2-T7` — Observability, reconciliation and health

**Depends on:** `E2-T3`, `E2-T6` · **Priority:** p1 — metadata para recortes de alcance, no orden de ejecución

Cierra la operación con salud y reconciliación. Extiende `src/app/api/health/route.ts` para verificar que la DB es alcanzable y la frescura del espejo (`max(products.synced_at)`), devolviendo `status: ok` fresco o `status: degraded` si la antigüedad supera el umbral. `src/lib/reconcile.ts` comprueba que no haya `orders` sin `order_lines` y que ninguna línea supere el `porc_max` del producto. El test cubre ambos chequeos sobre un dataset limpio.

**Files**
- `src/app/api/health/route.ts` — edit: añade frescura del espejo; `ok`/`degraded` según umbral
- `src/lib/reconcile.ts` — new: pedidos sin líneas y líneas que exceden `porc_max`
- `tests/integration/reconcile.test.ts` — new: salud fresca/degradada; reconciliación sin diferencias

**Acceptance**

1. **WHEN** `/api/health` is requested with a fresh mirror **THE SYSTEM SHALL** return 200 `status: ok`.
2. **WHEN** the newest `products.synced_at` is older than the threshold **THE SYSTEM SHALL** return `status: degraded`.
3. **WHEN** the reconcile check runs on a clean dataset **THE SYSTEM SHALL** report zero orders without lines and zero lines exceeding `porc_max`.

**Verify**

```bash
pnpm test tests/integration/reconcile.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T7: Observability, reconciliation and health"
git tag step-13-observability
```

### `E2-T8` — E2E, a11y, CI and deploy

**Depends on:** `E2-T7` · **Priority:** p1 — metadata para recortes de alcance, no orden de ejecución

Cierra el build con las pruebas end-to-end, CI y deploy. `tests/e2e/pedido.spec.ts` recorre el flujo entrar → catálogo → carrito → enviar pedido y afirma que existe una fila de cotización. `tests/e2e/a11y.spec.ts` corre axe sobre catálogo y carrito con 0 violaciones. `.github/workflows/ci.yml` ejecuta el gate global de §20.1 (install con lockfile → typecheck → lint → Postgres de servicio → db:migrate → test → build → test:e2e) y sale 0. `vercel.json` lleva la configuración de deploy de §12 (Vercel + Supabase; el agente queda documentado, no se despliega en Vercel).

**Files**
- `tests/e2e/pedido.spec.ts` — new: flujo entrar→catálogo→carrito→enviar; afirma fila de cotización
- `tests/e2e/a11y.spec.ts` — new: axe sobre catálogo y carrito; 0 violaciones
- `.github/workflows/ci.yml` — new: gate global §20.1
- `vercel.json` — new: config de deploy

**Acceptance**

1. **WHEN** the e2e flow runs **THE SYSTEM SHALL** complete login then catalog then cart then submit and assert a quotation row exists.
2. **WHEN** the a11y suite runs over catalog and cart **THE SYSTEM SHALL** report 0 violations.
3. **WHEN** the CI workflow runs **THE SYSTEM SHALL** execute the global acceptance gate and exit 0.

**Verify**

```bash
pnpm test:e2e tests/e2e/pedido.spec.ts
pnpm test:e2e tests/e2e/a11y.spec.ts
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T8: E2E, a11y, CI and deploy"
git tag step-14-deploy
```

---

## Epic acceptance

El epic está hecho cuando cada task está `done` **y**:

1. **WHEN** the e2e flow runs login → catalog → cart → submit against a migrated, seeded database **THE SYSTEM SHALL** complete and assert exactly one quotation row exists, with 0 a11y violations over catalog and cart.
2. **WHEN** the global acceptance gate runs from a clean checkout **THE SYSTEM SHALL** pass `typecheck`, `lint`, `test` and `build`, and a cross-client order request SHALL return 404 rather than another client's data.

```bash
pnpm db:up && pnpm db:migrate
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:e2e
```

Se corren desde el raíz del proyecto. Ambos criterios son decidibles por estos comandos — ningún gate de epic espera a un humano ni a un servicio externo (la prueba del agente contra Profit real y la entrega real de correo van a la lista de lanzamiento de §20.1, no a este gate).

## Pitfalls

- **Confiar en un precio o total que venga del cliente** — el carrito y el envío recomputan todo server-side con `price()`. Un precio manipulado debe ignorarse, no reflejarse.
- **Importar `src/lib/db/` desde una página `app/**`** — rompe la frontera. Toda lectura/escritura pasa por `catalog`/`cart`/`orders`.
- **Devolver 403 entre clientes** — la convención es 404: un cliente no debe saber que el recurso de otro existe.
- **Unir `order_lines` a `products` vivos** — el pedido es un snapshot inmutable; congela `art_des`, `prec_vta1`, `cascade`, `unit_frozen`, `line_net` en el envío.
- **Cachear `/catalogo`** — el precio es por usuario; debe ser `force-dynamic`, nunca compartido entre clientes.
- **Sellar `emailed_at` antes de despachar el correo** — la aceptación exige el orden inverso: `emailed_at` se fija después del envío.
- **Servir el comprobante por URL pública** — debe ser una URL firmada de Supabase Storage.
- **Ocultar el agotado** — se marca "No disponible", no se esconde; ocultar es solo el flag admin `is_hidden`.

## Before moving on

- [ ] Cada task de este epic está `done` en `tasks.json` — ninguno `in_progress`.
- [ ] Cada comando `verify` de cada task pasó, no solo el primero.
- [ ] Ningún comando `verify` fue editado, y ninguno se saltó porque un archivo que nombra no existía.
- [ ] **Cada task de este epic tiene su tag de `checkpoint` en control de versiones** — uno por task, igual al valor `checkpoint` de `tasks.json`. `git tag -l 'step-*'` los lista.
- [ ] El gate pasa limpio, corrido desde el raíz del proyecto.
- [ ] Este epic es el final: no expone contratos "Produced" para epics posteriores.
- [ ] Ningún archivo fuera del subárbol fue modificado.
- [ ] `.env.example` refleja las variables añadidas por este epic (`RESEND_API_KEY`, `ORDER_NOTIFY_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PROOF_NOTIFY_EMAIL`).
- [ ] Un commit por task, cada uno prefijado con su id de task, cada uno seguido de su tag de checkpoint.
