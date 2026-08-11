# Epic 01: Cimientos, sincronización y motor

> Al terminar existe un proyecto Next.js que arranca, un espejo de Postgres poblado desde Profit vía un ingest firmado e idempotente, el agente on-prem que lo alimenta, el motor de precios que replica la cascada al céntimo, y la autenticación con activación por OTP contra el espejo de clientes.

| | |
|---|---|
| **Epic id** | `01-cimientos` |
| **Tasks** | `E1-T1` … `E1-T6` |
| **Depends on** | nothing — start here |
| **Unlocks** | `02-tienda` |
| **Parallel with** | none — `02-tienda` depende por completo de este epic |

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
| Generar migración | `pnpm db:generate` |
| Migrar | `pnpm db:migrate` |
| Sembrar | `pnpm db:seed` |
| Servicios locales (Postgres) | `pnpm db:up` / `pnpm db:down` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar hecho cualquier task de este epic.

Si un task de abajo verifica contra un servicio real, levántalo primero con `pnpm db:up`. El `docker-compose.yml` que lo define se emitió en `workspace/` y ya está en el raíz del proyecto — no lo escribes tú, y nunca sustituyes por un fake un servicio que los criterios de aceptación nombran.

## Directory subtree

Solo las partes que este epic toca:

```
src/
  lib/
    env.ts                    # process.env validado con zod — único acceso; NEW en T1, se extiende en T2/T3/T4/T6
    money.ts                  # helpers big.js: cascada aritmética, redondeo — NEW en T5
    auth.ts                   # instancia Better Auth + getSession() + provisión de app_user — NEW en T6
    pricing/
      offers.ts               # ofertas vigentes + EXCLUIDOS — NEW en T5
      cascade.ts              # motor de cascada (posiciones 1,3,4 + tope) — NEW en T5
      price.ts                # precio efectivo por (cliente, producto, cantidad) — NEW en T5
    db/
      schema.ts               # esquema Drizzle de TODAS las tablas de §4 — NEW en T2
      index.ts                # cliente db exportado — NEW en T2
      seed.ts                 # datos de siembra realistas (tsx) — NEW en T2
    ingest/
      apply.ts                # upsert idempotente del payload del agente al espejo — NEW en T3
  agent/
    profit.ts                 # consultas SQL Server (solo lectura) + mapeo — NEW en T4
    push.ts                   # firma HMAC + POST al /api/ingest — NEW en T4
    sync.ts                   # orquestador on-prem: lee Profit por row_id, empuja — NEW en T4
  app/
    api/
      health/route.ts         # GET salud (versión base) — NEW en T1, se extiende en 02-tienda
      ingest/route.ts         # recibe el push del agente (HMAC, idempotente) — NEW en T3
      auth/[...all]/route.ts   # handler de Better Auth — NEW en T6
    (auth)/
      activar/page.tsx         # solicitar OTP con co_cli/correo, activar cuenta — NEW en T6
tests/
  smoke/health.test.ts        # arranca el handler GET y afirma 200 — NEW en T1
  integration/db.test.ts      # el cliente devuelve filas tipadas — NEW en T2
  integration/ingest.test.ts  # firma válida/inválida, replay idempotente — NEW en T3
  integration/auth.test.ts    # ruta protegida redirige; OTP crea app_user — NEW en T6
  unit/agent-push.test.ts     # firma HMAC determinista y forma del lote — NEW en T4
  unit/pricing.test.ts        # 5 líneas de factura reales al céntimo — NEW en T5
```

Todo lo que quede fuera de este subárbol está fuera de alcance. Si un task parece exigir editar un archivo que no está listado aquí, detente y reporta — significa que la frontera del epic está mal.

## Data model touched here

`src/lib/db/schema.ts` (T2) autoría **el esquema completo de §4**, incluidas las tablas que solo consume `02-tienda`. Las tablas que la lógica de este epic lee o escribe:

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `products` | `co_art` (PK), `art_des`, `prec_vta1` numeric(18,5), `stock_act`, `stock_com`, `anulado`, `row_id_hex`, `synced_at` | Espejo de `art`; escrito solo por el ingest (T3). Índice GIN sobre `to_tsvector('spanish', art_des)` |
| `product_overrides` | `co_art` (PK, FK), `is_hidden`, `photo_url` | Propiedad del portal; creado en el esquema, usado por `02-tienda` |
| `customers` | `co_cli` (PK), `email`, `desc_glob` numeric(6,3), `mont_cre`, `saldo`, `plaz_pag`, `sincredito`, `cond_1pct`, `inactivo`, `row_id_hex` | Espejo de `clientes`; `desc_glob` es la posición 4 de la cascada; leído por pricing (T5) y auth (T6) |
| `offers` | `co_ofer` (PK), `pos_ofer`, `fec_inic`, `fec_fin`, `is_exclusion` | Cabeceras `oferta`; leído por pricing (T5) |
| `offer_lines` | PK (`co_ofer`,`co_art`), `porc_ofer` | Detalle `reng_ofer`; índice por `co_art` |
| `product_caps` | `co_art` (PK), `porc_max` numeric(6,3) | Techo duro de descuento; leído por pricing (T5) |
| `exchange_rate` | `id` (PK=1), `usd_bs`, `effective_at` | Fila única con la tasa Bs/USD |
| `sync_state` | `source` (PK), `last_row_id_hex`, `last_run_at`, `last_status` | Cursor incremental por tabla; escrito por el ingest (T3) |
| `ingest_events` | `event_id` (PK), `source`, `received_at`, `rows_applied` | Libro de idempotencia del ingest (T3) |
| `app_users` | `id` (PK), `auth_user_id` unique, `co_cli` unique, `role` | Enlaza la identidad Better Auth con el cliente; creado en la activación (T6) |

Las tablas de Better Auth (`user`, `session`, `account`, `verification`) las genera su CLI/adaptador Drizzle en T6; no se redefinen a mano.

## Contracts

**Consumed** — ya existe, no lo reconstruyas:

| From | Interface | Guarantee |
|---|---|---|
| — | — | Este epic inicia el build; no consume contratos de otros epics |

**Produced** — epics posteriores dependen exactamente de estas firmas. Cambiar una las rompe:

| Export | Signature | Used by |
|---|---|---|
| `src/lib/pricing/price.ts` → `price` | `(client, product, qty) → { unitFrozen: Big; lineNet: Big; cascade: string; applies1pct: boolean }` (precio efectivo por cliente, con tope `porc_max` y flag del 1% global) | `02-tienda` |
| `src/lib/auth.ts` → `getSession` | `() → Promise<{ appUser: { id; co_cli; role } } | null>` (identidad + `co_cli` de la sesión) | `02-tienda` |
| `src/lib/db/index.ts` → `db`, `src/lib/db/schema.ts` → tablas | cliente Drizzle tipado + esquema de todas las tablas de §4 | `02-tienda` |
| `src/lib/ingest/apply.ts` → `apply` | `(source, rows, cursor, event_id) → { rowsApplied: number; deduped: boolean }` (upsert idempotente al espejo) | `02-tienda` (admin) |

## Conventions that bite in this area

- **`src/lib/env.ts` es el único acceso a `process.env`, validado con `zod`.** Cada variable se vuelve *requerida* solo desde el paso que la consume (`NODE_ENV` en T1; `DATABASE_URL` en T2; `SYNC_SHARED_SECRET` en T3; `INGEST_URL`/`PROFIT_SQL_*` en T4; `BETTER_AUTH_SECRET` en T6). Requerir todas en T1 rompe los gates anteriores.
- **El ingest verifica la firma HMAC sobre el cuerpo crudo ANTES de parsearlo como confiable.** Parsear primero y verificar después es una vulnerabilidad, no un detalle de orden.
- **Dinero como `numeric` + `big.js`, nunca `float`.** Profit maneja precios unitarios de hasta 5 decimales y la cascada es multiplicativa; el neto de línea y los totales se redondean a 2 decimales con `Big.toFixed(2)`.
- **La cascada es multiplicativa** `prec_vta1 × (1-p1)(1-p2)(1-p3)(1-p4)`, con `p2 = 0` en v1 (escalas de volumen fuera de alcance) y el techo `porc_max` sobre el descuento total.
- **El agente no importa React ni nada de `src/components/**`.** Comparte solo `src/lib/db/schema.ts`, `src/lib/env.ts` y `src/lib/money.ts`. Aplica `RTRIM` a los códigos `char` que lee de Profit.
- **Ninguna consulta del cliente devuelve `any`.** El cliente Drizzle es la única apertura de conexión a Postgres (`src/lib/db/index.ts`).
- **Las tablas de Better Auth se generan con su CLI y se migran; no se redefinen a mano** ni se sobrescriben al regenerar el esquema.

Reglas completas del proyecto: `CLAUDE.md`. Reglas de área: `.claude/rules/db.md`, `.claude/rules/pricing.md`, `.claude/rules/agent.md`. Ambos sitios están en el raíz del proyecto — el builder los copió allí desde `workspace/` antes del primer task.

---

## Tasks

Listados en el mismo orden que `tasks.json`. Ese orden es el orden de build — trabaja de arriba abajo y no lo re-ordenes por prioridad ni por lo que parezca rápido.

### `E1-T1` — Scaffold project, toolchain, repo and health route

**Depends on:** nothing · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

El Bootstrap de §10 ya generó el andamiaje Next.js, colocó los configs de `workspace/`, editó `package.json`/`tsconfig.json`/`biome.json`/`.gitignore`, instaló dependencias y creó el repo con su primer commit. Este task solo autoría tres archivos: `src/lib/env.ts` que valida `process.env` con `zod` (en este paso **solo** `NODE_ENV` es requerido; las demás variables se añaden como requeridas en los pasos que las consumen), `src/app/api/health/route.ts` con un `GET` que devuelve `{ ok: true, data: { status: 'ok' } }` con 200, y el smoke test que importa ese handler y afirma 200.

**Files**
- `src/lib/env.ts` — new: schema `zod` de env, `NODE_ENV` requerido; falla al importar con error nombrado
- `src/app/api/health/route.ts` — new: `GET` → 200 `{ ok: true, data: { status: 'ok' } }`
- `tests/smoke/health.test.ts` — new: importa el handler `GET`, afirma status 200 y `ok: true`

**Acceptance**

1. **WHEN** `pnpm install --frozen-lockfile` runs **THE SYSTEM SHALL** exit 0 without modifying the lockfile.
2. **WHEN** `pnpm build` runs **THE SYSTEM SHALL** exit 0.
3. **WHEN** `pnpm lint` runs over the tree with the bundle present **THE SYSTEM SHALL** exit 0 with zero errors and zero warnings.
4. **WHEN** the smoke test invokes the `/api/health` GET handler **THE SYSTEM SHALL** return HTTP 200 with `ok: true`.
5. **WHEN** `NODE_ENV` is absent at import of `src/lib/env.ts` **THE SYSTEM SHALL** throw a named error rather than continue.

**Verify**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/smoke/health.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T1: Scaffold project, toolchain, repo and health route"
git tag step-01-scaffold
```

### `E1-T2` — Mirror + portal schema, migration and seed

**Depends on:** `E1-T1` · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

Autoría el esquema Drizzle con **todas** las entidades de §4 (espejo + portal) con sus tipos, PKs, FKs, uniques e índices, el cliente db, la migración y la siembra. `src/lib/db/index.ts` abre el cliente `postgres` + Drizzle leyendo `DATABASE_URL` desde `src/lib/env.ts` (extiéndelo para requerir `DATABASE_URL` desde este paso). `src/lib/db/seed.ts` corre con `tsx` y siembra el dataset realista de §4 (~20 productos reales, 3 clientes con `desc_glob` distinto, 2 pares de ofertas con su gemela EXCLUIDOS, un `porc_max`, una tasa vigente, un admin), upsert por PK para que un segundo `db:seed` no duplique. Levanta el Postgres local con `pnpm db:up` antes; `drizzle.config.ts` y el seed cargan `.env` por sí mismos. No inventes el nombre de la migración — lo elige `drizzle-kit`.

**Files**
- `src/lib/db/schema.ts` — new: todas las tablas de §4 con tipos, PKs, FKs, uniques e índices
- `src/lib/db/index.ts` — new: cliente `postgres` + Drizzle desde `DATABASE_URL`
- `src/lib/db/seed.ts` — new: siembra realista idempotente (upsert por PK), corrida con `tsx`
- `src/lib/env.ts` — edit: requerir `DATABASE_URL` desde este paso
- `tests/integration/db.test.ts` — new: el cliente devuelve filas tipadas sin `any`

**Acceptance**

1. **WHEN** `pnpm db:migrate` runs against the local database **THE SYSTEM SHALL** apply every table the data model defines, and a second run SHALL be a no-op.
2. **WHEN** a `\d products` is issued **THE SYSTEM SHALL** show the `prec_vta1`, `stock_act`, `stock_com` and `row_id_hex` columns.
3. **WHEN** `pnpm db:seed` runs **THE SYSTEM SHALL** insert the demo dataset and a second run SHALL not duplicate rows.
4. **WHEN** a query through the exported client selects a seeded product **THE SYSTEM SHALL** return typed rows with no `any`.
5. **WHEN** `DATABASE_URL` is absent at boot **THE SYSTEM SHALL** fail with a named error, not at first query.

**Verify**

```bash
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:migrate
psql "$DATABASE_URL" -c "\d products"
pnpm db:seed
pnpm db:seed
pnpm test tests/integration/db.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T2: Mirror + portal schema, migration and seed"
git tag step-02-data
```

### `E1-T3` — Signed, idempotent ingest API

**Depends on:** `E1-T2` · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

Construye el único camino de escritura al espejo (`POST /api/ingest`). `src/lib/ingest/apply.ts` hace el upsert transaccional por `source`, avanza `sync_state.last_row_id_hex` al `cursor`, inserta en `ingest_events`, y deduplica por `event_id`. `src/app/api/ingest/route.ts` verifica la firma HMAC con `SYNC_SHARED_SECRET` sobre el cuerpo **crudo** antes de parsearlo, valida la forma con `zod` (`source` en el conjunto enumerado), y delega en `apply.ts`. Extiende `src/lib/env.ts` para requerir `SYNC_SHARED_SECRET` desde este paso. La transacción es atómica: firma inválida o cuerpo malformado escriben cero filas.

**Files**
- `src/app/api/ingest/route.ts` — new: verifica HMAC sobre cuerpo crudo, valida con `zod`, delega
- `src/lib/ingest/apply.ts` — new: upsert transaccional + avance de `sync_state` + `ingest_events`; dedup por `event_id`
- `src/lib/env.ts` — edit: requerir `SYNC_SHARED_SECRET` desde este paso
- `tests/integration/ingest.test.ts` — new: firma válida/inválida, replay idempotente

**Acceptance**

1. **WHEN** a POST arrives at `/api/ingest` with a valid HMAC signature and an `art` batch **THE SYSTEM SHALL** upsert each row into `products`, advance `sync_state`, and return 200.
2. **WHEN** a POST arrives with an invalid `X-Signature` **THE SYSTEM SHALL** respond 401 `invalid_signature` and write zero rows.
3. **WHEN** the same `event_id` is delivered twice **THE SYSTEM SHALL** return 200 both times and leave the mirror row count unchanged.
4. **WHEN** the body is malformed **THE SYSTEM SHALL** respond 400 `bad_request` and write nothing.
5. **WHEN** `SYNC_SHARED_SECRET` is unset at boot **THE SYSTEM SHALL** fail startup with a named error.

**Verify**

```bash
pnpm test tests/integration/ingest.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T3: Signed, idempotent ingest API"
git tag step-03-ingest
```

### `E1-T4` — On-prem Profit sync agent

**Depends on:** `E1-T3` · **Priority:** p1 — metadata para recortes de alcance, no orden de ejecución

El proceso que corre junto al SQL Server de Profit y empuja al ingest. `src/agent/profit.ts` hace consultas **solo lectura** (driver `mssql`) a `art`, `clientes`, `oferta`, `reng_ofer`, `art_ext` y la tasa, filtrando por `row_id > @cursor`, aplica `RTRIM` a los códigos `char`, y deriva `is_exclusion` (texto "EXCLUIDOS") y `disponible`; contempla el TLS legacy de SQL Server 2005/2008 (`encrypt:false`/`trustServerCertificate`) con un error nombrado que indique la opción a fijar. `src/agent/push.ts` arma el lote con `event_id` (uuid), firma HMAC con `SYNC_SHARED_SECRET` y hace `POST` al `INGEST_URL`. `src/agent/sync.ts` orquesta el ciclo con modo `--once`. Extiende `src/lib/env.ts` para requerir `INGEST_URL` y las credenciales `PROFIT_SQL_*`. El test cubre firma y forma del payload contra un doble del fetch — sin SQL Server real; la prueba contra Profit real va a la lista de lanzamiento.

**Files**
- `src/agent/sync.ts` — new: orquestador; lee cursor por tabla, lee incremental, empuja, repite; modo `--once`
- `src/agent/profit.ts` — new: consultas RO a SQL Server, `RTRIM`, derivación de `is_exclusion`/`disponible`, TLS legacy
- `src/agent/push.ts` — new: `event_id` + firma HMAC + `POST` al `INGEST_URL`
- `src/lib/env.ts` — edit: requerir `INGEST_URL` y `PROFIT_SQL_*` desde este paso
- `tests/unit/agent-push.test.ts` — new: firma HMAC determinista y forma del lote contra un doble del fetch

**Acceptance**

1. **WHEN** the agent builds a batch **THE SYSTEM SHALL** produce an `X-Signature` the ingest route verifies as valid for the same `SYNC_SHARED_SECRET`.
2. **WHEN** a batch is pushed and accepted **THE SYSTEM SHALL** update the local cursor to the batch `cursor` so the next cycle reads only newer `row_id`s.
3. **WHEN** the SQL Server connection fails **THE SYSTEM SHALL** surface a named error and exit non-zero, not hang.
4. **WHEN** a `char` code is read from Profit **THE SYSTEM SHALL** emit it right-trimmed.

**Verify**

```bash
pnpm test tests/unit/agent-push.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T4: On-prem Profit sync agent"
git tag step-04-agent
```

### `E1-T5` — Pricing cascade engine

**Depends on:** `E1-T2` · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

El corazón del sistema: replica la cascada validada del dossier. `src/lib/money.ts` da los helpers `big.js` (multiplicar por `(1 - p/100)`, encadenar, redondear a 2). `src/lib/pricing/offers.ts`, dado un `co_art` y la fecha, resuelve el % vigente de la posición 1 (`pos_ofer=0`) y la posición 3 (`pos_ofer=1`), **excluyendo** los artículos presentes en la oferta gemela EXCLUIDOS (la exclusión manda) y solo con `now` entre `fec_inic` y `fec_fin`. `src/lib/pricing/cascade.ts` calcula `neto_unit = prec_vta1 × (1-p1)(1-p2)(1-p3)(1-p4)` multiplicativa, con `p2 = 0` en v1 y el techo `porc_max` sobre el descuento total. `src/lib/pricing/price.ts` compone el precio efectivo por `(cliente, producto, cantidad)` usando `desc_glob` como p4, las ofertas como p1/p3, el tope de `product_caps`, y expone si el 1% global aplica según `customers.cond_1pct`. El test reproduce **al céntimo** las 5 líneas de factura reales del dossier.

**Files**
- `src/lib/money.ts` — new: helpers `big.js` para la cascada y el redondeo a 2 decimales
- `src/lib/pricing/offers.ts` — new: resolución de ofertas vigentes por posición + EXCLUIDOS
- `src/lib/pricing/cascade.ts` — new: cascada multiplicativa + tope `porc_max`, `p2 = 0`
- `src/lib/pricing/price.ts` — new: precio efectivo por `(cliente, producto, cantidad)` + flag 1%
- `tests/unit/pricing.test.ts` — new: las 5 líneas de factura reales al céntimo + EXCLUIDOS + tope

**Acceptance**

1. **WHEN** the cascade computes with `prec_vta1=2165.23`, `qty=6`, positions `(0,6,17,12)` **THE SYSTEM SHALL** return line net `8919.57`.
2. **WHEN** the cascade computes with `prec_vta1=589.84`, `qty=20`, positions `(0,6,34,12)` **THE SYSTEM SHALL** return line net `6440.49`.
3. **WHEN** the cascade computes with `prec_vta1=746.63`, `qty=50`, positions `(0,0,13,12)` **THE SYSTEM SHALL** return line net `28581.00`.
4. **WHEN** the cascade computes with `prec_vta1=671.97`, `qty=90`, positions `(0,0,4,12)` **THE SYSTEM SHALL** return line net `51091.22`.
5. **WHEN** a customer's segment `co_seg` is 70 (EXCLUIDOS) **THE SYSTEM SHALL** apply only offers configured for segment 70, not the general-segment offers.
6. **WHEN** the cascade discount would exceed a product's `porc_max` **THE SYSTEM SHALL** cap the total discount at `porc_max`.

**Verify**

```bash
pnpm test tests/unit/pricing.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T5: Pricing cascade engine"
git tag step-05-pricing
```

### `E1-T6` — Auth and OTP activation from mirror

**Depends on:** `E1-T2` · **Priority:** p0 — metadata para recortes de alcance, no orden de ejecución

Better Auth con activación por OTP y protección de rutas. `src/lib/auth.ts` instancia Better Auth (adaptador Drizzle, plugin email-OTP), expone `getSession()`, y hace la provisión just-in-time del `app_users` ligado al `co_cli` del `customers` que coincide con el correo verificado — nunca se usa `co_cli` como clave por defecto. `src/app/api/auth/[...all]/route.ts` es el handler de Better Auth. `src/app/(auth)/activar/page.tsx` es el formulario con `react-hook-form` + `zod`. Extiende `src/lib/env.ts` para requerir `BETTER_AUTH_SECRET`. El esquema de Better Auth (`user`/`session`/`account`/`verification`) se genera con su CLI y se migra; no se redefine a mano. La provisión es idempotente: repetir la activación deja exactamente un `app_users` por `co_cli` (unique).

**Files**
- `src/lib/auth.ts` — new: instancia Better Auth + `getSession()` + provisión de `app_users` desde el espejo
- `src/app/api/auth/[...all]/route.ts` — new: handler de Better Auth
- `src/app/(auth)/activar/page.tsx` — new: formulario de activación OTP (`react-hook-form` + `zod`)
- `src/lib/env.ts` — edit: requerir `BETTER_AUTH_SECRET` desde este paso
- `tests/integration/auth.test.ts` — new: ruta protegida redirige; OTP válido crea un único `app_users`

**Acceptance**

1. **WHEN** an anonymous request hits `/catalogo` **THE SYSTEM SHALL** redirect to `/entrar` and return to `/catalogo` after login.
2. **WHEN** a valid OTP is confirmed for an email matching an active `customers` row **THE SYSTEM SHALL** create exactly one `app_users` row linked to that `co_cli`.
3. **WHEN** an OTP is requested for an email not present in `customers` **THE SYSTEM SHALL** create no user and report a generic message.
4. **WHEN** the same activation completes twice **THE SYSTEM SHALL** leave exactly one `app_users` row for that `co_cli`.

**Verify**

```bash
pnpm test tests/integration/auth.test.ts
pnpm typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T6: Auth and OTP activation from mirror"
git tag step-06-auth
```

---

## Epic acceptance

El epic está hecho cuando cada task está `done` **y**:

1. **WHEN** the whole epic suite (smoke, db, ingest, pricing, agent-push, auth) runs after `pnpm db:up && pnpm db:migrate` **THE SYSTEM SHALL** exit 0 with zero failed and zero skipped.
2. **WHEN** a signed ingest batch of `art` rows is applied and the pricing engine computes a seeded client's line **THE SYSTEM SHALL** return each of the four real invoice line nets to the cent (`8919.57`, `6440.49`, `28581.00`, `51091.22`).

```bash
pnpm db:up && pnpm db:migrate
pnpm typecheck && pnpm lint && pnpm test
pnpm test tests/unit/pricing.test.ts tests/integration/ingest.test.ts tests/integration/auth.test.ts
```

Se corren desde el raíz del proyecto. Ambos criterios son decidibles por estos comandos — ningún gate de epic espera a un humano ni a un servicio externo.

## Pitfalls

- **Requerir todas las env vars en `src/lib/env.ts` desde T1** — rompe los gates de T1–T5. Una variable es requerida solo desde su paso; antes es opcional. Extiende el schema paso a paso.
- **Verificar la firma HMAC después de parsear el cuerpo** — invierte el orden de seguridad. Verifica sobre el cuerpo crudo antes de tratar nada como confiable, y no escribas ni una fila si falla.
- **Usar `float`/`number` para la cascada** — pierde los decimales de Profit y falla las 5 líneas al céntimo. Todo con `big.js`; redondeo final con `Big.toFixed(2)`.
- **Olvidar los EXCLUIDOS** — un artículo en la gemela EXCLUIDOS debe recibir cero en esa posición; la exclusión manda sobre la oferta vigente.
- **Redefinir a mano las tablas de Better Auth** — genéralas con su CLI y migra; redefinirlas choca con el adaptador y con la migración de T2.
- **Probar el agente contra un SQL Server real en CI** — no está disponible en el build; el test usa un doble del fetch. La prueba on-prem va a la lista de lanzamiento.
- **Un segundo `db:seed` que duplica filas** — la siembra debe ser upsert por PK; la aceptación exige que el segundo run no duplique.

## Before moving on

- [ ] Cada task de este epic está `done` en `tasks.json` — ninguno `in_progress`.
- [ ] Cada comando `verify` de cada task pasó, no solo el primero.
- [ ] Ningún comando `verify` fue editado, y ninguno se saltó porque un archivo que nombra no existía.
- [ ] **Cada task de este epic tiene su tag de `checkpoint` en control de versiones** — uno por task, igual al valor `checkpoint` de `tasks.json`. `git tag -l 'step-*'` los lista.
- [ ] El gate pasa limpio, corrido desde el raíz del proyecto.
- [ ] Cada contrato "Produced" de arriba existe con la firma indicada (`price`, `getSession`, `db`/schema, `apply`).
- [ ] Ningún archivo fuera del subárbol fue modificado.
- [ ] `.env.example` refleja las variables añadidas por este epic (`DATABASE_URL`, `SYNC_SHARED_SECRET`, `INGEST_URL`, `PROFIT_SQL_*`, `BETTER_AUTH_SECRET`).
- [ ] Un commit por task, cada uno prefijado con su id de task, cada uno seguido de su tag de checkpoint.
