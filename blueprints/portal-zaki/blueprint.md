# PORTAL-ZAKI — Blueprint

> Generado por The Architect el 2026-08-04
> Forma: E-commerce Storefront (mayorista B2B, un vendedor) · `knowledge/shapes/ecommerce-storefront.md`
> Runtime track: TypeScript / Node.js · `knowledge/runtime-tracks/ts-node.md`
> Modo de emisión: bundle
> Versión del blueprint: 1
> Versiones verificadas: 2026-08-04 — ver §11 para la procedencia por paquete

---

## 1. Project Overview & Non-Goals

### Vision

PORTAL-ZAKI es el portal de venta mayorista propio de la droguería **ZAKIPHARMA**. Reemplaza un
portal de terceros por uno que ZAKIPHARMA controla de punta a punta. Sus clientes —farmacias— entran
con su cuenta, ven el catálogo de ~9.178 productos con **su** precio (calculado a partir de la lista
base y su descuento) y la existencia real, arman un pedido, y lo envían. El pedido no es una compra
con pago en línea: sale como **cotización por correo** y el equipo de ZAKIPHARMA la importa a su ERP
(Profit Plus 2K8). Los clientes además **registran sus comprobantes de pago** (transferencia, pago
móvil, depósito), que llegan por correo para que cartera los concilie.

El dato maestro —producto, precio, existencia, cliente, descuento, tasa de cambio— **vive en Profit
Plus y nunca en el portal**. Un agente de sincronización que corre dentro de la red de ZAKIPHARMA
lee Profit en modo solo lectura y empuja los cambios al portal. El portal es un espejo de consulta
más un carrito; jamás escribe en el ERP. Si PORTAL-ZAKI no existe, ZAKIPHARMA sigue dependiendo de un
proveedor externo para su canal de venta y no puede evolucionarlo a su ritmo.

### Users

| Persona | A qué viene | Frecuencia |
|---|---|---|
| Farmacia cliente (con crédito) | Ver su precio y existencia, armar pedidos, registrar comprobantes, ver su cupo y saldo | diaria |
| Farmacia cliente (contado) | Ver precio/existencia y armar pedidos | diaria |
| Operador / teleoperador de ZAKIPHARMA | Recibir cotizaciones por correo e importarlas a Profit; conciliar comprobantes | diaria |
| Administrador de ZAKIPHARMA | Ocultar productos, cargar fotos, activar clientes, revisar la salud de la sincronización | semanal |

### Goals — v1 scope

1. El portal muestra a cada cliente autenticado **su precio firme** por producto (cascada de
   descuentos replicada de Profit) y la **existencia disponible** real, frescas al minuto.
2. Un cliente arma un carrito y envía un pedido que se convierte en **cotización por correo** con el
   precio congelado, y queda registrado en el portal.
3. Un cliente **registra un comprobante de pago** que llega por correo a ZAKIPHARMA y queda
   registrado.
4. Un cliente ve su **cupo de crédito y su saldo** (solo lectura, desde Profit).
5. Un **agente de sincronización** on-prem mantiene el espejo del portal al día leyendo Profit por
   `row_id` incremental, sin exponer el SQL Server a internet.
6. Un **panel de administración** permite ocultar productos, cargar fotos, activar clientes y ver el
   estado de la sincronización.

### Non-Goals — explicitly out of scope for v1

| Not building | Why not now | Revisit when |
|---|---|---|
| Pasarela de pago en línea (tarjeta/PSE) | El negocio cobra a crédito y por comprobante; no hay demanda de cobro instantáneo | Un segmento de clientes exija pagar en línea |
| Escritura directa de pedidos en Profit Plus | El ERP es la fuente de verdad y debe quedar intacto; el flujo actual es importación manual | Profit exponga una API de importación soportada por el proveedor |
| Escalas de descuento por volumen (posición 2, tabla `descuen`) | Confirmado: `descuen` está **vacía**; no existen escalas por volumen. La posición 2 es 0 | Aparezcan datos en `descuen` en el futuro |
| Lotes y fechas de vencimiento | Existe en Profit pero no se inspeccionó; no es imprescindible para pedir | Las farmacias pidan ver vencimientos en el catálogo |
| Búsqueda por código de barras | El catálogo real (`art`) no tiene código de barras; solo existe en una tabla de importación de 1.166 filas | Se consolide una fuente de EAN-13 para todo el catálogo |
| App móvil nativa | El portal web responsive cubre el caso; una app añade tiendas, firma y releases | Haya tracción y una necesidad concreta de funciones nativas |
| Marketplace / múltiples vendedores | ZAKIPHARMA es el único vendedor | Nunca dentro del alcance de este producto |

**The builder must not implement anything in this table**, even if it seems like a small addition
while working on an adjacent step. If a step appears to require a non-goal, that is a blueprint
defect — stop and report it rather than expanding scope.

### Success metrics

| Metric | Target | How measured |
|---|---|---|
| Paridad de precio portal↔Profit | 0 diferencias sobre las 5 líneas de factura reales del dossier + 0 en el período sombra | Tests de `src/lib/pricing` + consulta de conciliación del período sombra (§9.1) |
| Frescura del espejo | Existencia y precio con antigüedad ≤ 2 min en horario laboral | `synced_at` vs `now()` en `/api/health` y panel admin |
| Pedidos por portal | ≥ 30% de los pedidos entran por portal a los 60 días del corte total | Conteo de `orders` vs volumen total en Profit |

---

## 2. Tech Stack

**Runtime track: TypeScript / Node.js.** Esta tabla nombra *elecciones*, no versiones. Cada pin vive
en §11 y solo ahí.

Los pines provienen del reporte de `stack-researcher` de esta sesión (autoridad), con
`knowledge/runtime-tracks/ts-node.md` como respaldo para lo que el reporte no resolvió.

| Layer | Choice | Why this, over what |
|---|---|---|
| Language / runtime | TypeScript sobre Node.js LTS 24 | Un solo lenguaje para portal, agente de sync y tests; se descarta Python/Go porque la UI es el producto y no hay carga ML ni requisito de binario único |
| Framework | Next.js 16 (App Router) | SSR del catálogo, un solo deploy, y route handlers para el ingest del agente; frente a un SPA + API separada, evita dos despliegues |
| Styling | Tailwind CSS v4 | Utilidades sobre catálogo denso; se descarta CSS-in-JS runtime porque rompe el server-rendering del framework |
| Component layer | shadcn (copia en el repo, base Radix) | Tabla, formulario y diálogo listos para un catálogo y un panel admin; no es una dependencia que se actualice sola |
| Database | Postgres gestionado (Supabase) | Transaccional para carrito/pedidos y espejo; su Storage guarda fotos y comprobantes, y su auth podría reutilizarse — aquí solo usamos DB + Storage |
| ORM / data access | Drizzle | Esquema como código, migraciones diff-eadas; frente a Prisma, runtime delgado y SQL a la vista, que importa cuando se replica una cascada de precios |
| Auth | Better Auth (usuarios en *nuestro* Postgres) | ~2.000 clientes sin costo por usuario y activación por OTP; frente a Clerk, evita el costo por MAU y mantiene los clientes en nuestra base para unir con el espejo |
| Background work | Proceso Node standalone (`tsx`) corrido on-prem por el Programador de tareas de Windows | El agente de sync es un proceso largo que vive en la red del ERP; un host serverless no puede alcanzar un SQL Server en IP privada |
| Payments | Sin pasarela — captura de comprobante + correo | El negocio cobra a crédito/por comprobante; no hay cobro en línea (ver §5 y §9 paso 10) |
| File storage | Supabase Storage | Fotos de producto (fuera de Profit) y comprobantes de pago; URLs firmadas para los comprobantes |
| Email / notifications | Resend | Envío transaccional (cotización, comprobante, OTP) con API de primera clase; alternativa SMTP propio en §20.3 |
| Hosting | Vercel (portal) + Supabase (DB/Storage) + 1 PC Windows on-prem (agente) | Cada feature de Next.js corre primero en Vercel; el agente es lo único que toca la red local |
| Package manager | pnpm | node_modules estricto atrapa dependencias fantasma; workspaces si hicieran falta |

### Compatibility check

Checked against `knowledge/stack-compatibility.md` — none of the known-bad rows apply. Dos notas que
la tabla obliga a dejar por escrito:

- **Linter que parsea CSS + motor CSS-first (Biome + Tailwind v4):** se habilita
  `css.parser.tailwindDirectives: true` en `biome.json` antes del primer `lint` (§19.6). Sin esto, el
  primer gate del paso 1 falla sobre la hoja de estilos que genera el andamiaje.
- **Long-lived process + request-scoped host:** el agente de sync **no** se despliega en Vercel; corre
  on-prem como proceso Node. La tabla prohíbe justo lo contrario (un loop en serverless), y este
  blueprint lo respeta separando el tier del agente del tier web.

Una desviación deliberada respecto al track y a la convención de "dinero como entero en unidades
mínimas": los precios se guardan como **`numeric`** (no entero), porque Profit maneja precios
unitarios con hasta 5 decimales (verificado en facturas reales, p. ej. `378.53689`) y la cascada es
multiplicativa. La aritmética usa `big.js`; el neto de línea y los totales se redondean a 2 decimales
para mostrar. Justificación completa en §20.3.

---

## 3. Directory Structure

```
portal-zaki/
  src/
    app/                          # Next.js App Router
      (shop)/                     # grupo autenticado del cliente
        catalogo/page.tsx         # PLP — listado con precio por cliente y stock (server)
        producto/[co_art]/page.tsx# PDP — detalle de producto (server)
        carrito/page.tsx          # carrito, no cacheado (server + client leaf)
        cuenta/page.tsx           # cupo, saldo, historial de pedidos y comprobantes
        cuenta/pagos/page.tsx     # registrar comprobante de pago
      (admin)/admin/              # panel de administración
        page.tsx                  # tablero: estado de sync
        productos/page.tsx        # ocultar productos, cargar fotos
        clientes/page.tsx         # activar clientes
        pedidos/page.tsx          # ver cotizaciones enviadas
      (auth)/                     # activación e inicio de sesión
        activar/page.tsx          # solicitar OTP con co_cli/correo, fijar clave
        entrar/page.tsx           # inicio de sesión
      api/
        health/route.ts           # health check: DB + frescura del espejo
        ingest/route.ts           # recibe el push del agente (HMAC, idempotente)
        auth/[...all]/route.ts     # handler de Better Auth
      layout.tsx
      globals.css                 # @import "tailwindcss"; @theme { ... }
    components/
      ui/                         # primitivos shadcn — generados, editar libremente
      shop/                       # componentes del catálogo/carrito
      admin/                      # componentes del panel
    lib/
      env.ts                      # process.env validado con zod — único acceso
      auth.ts                     # cliente Better Auth + getSession()
      email.ts                    # cliente Resend + envíos
      storage.ts                  # cliente Supabase Storage
      money.ts                    # helpers big.js: cascada aritmética, redondeo
      pricing/
        cascade.ts                # motor de cascada (posiciones 1,3,4 + tope + 1% global)
        offers.ts                 # resolución de ofertas vigentes + EXCLUIDOS
        price.ts                  # precio efectivo por (cliente, producto, cantidad)
      db/
        schema.ts                 # esquema Drizzle — única fuente de forma de tablas
        index.ts                  # cliente db exportado
        seed.ts                   # datos de siembra realistas (tsx)
      catalog/queries.ts          # lecturas del catálogo (toman el co_cli como argumento)
      cart/server.ts              # mutaciones de carrito server-authoritative
      orders/server.ts            # crear cotización desde carrito, snapshot inmutable
      ingest/apply.ts             # upsert idempotente del payload del agente al espejo
    agent/
      sync.ts                     # agente on-prem: lee Profit por row_id, empuja al ingest
      profit.ts                   # consultas SQL Server (solo lectura) + mapeo
      push.ts                     # firma HMAC + POST al /api/ingest
  tests/
    unit/                         # lógica pura (cascada, money) — sin DB
    integration/                  # ingest y repos contra Postgres de prueba
    e2e/                          # flujos críticos con Playwright
    smoke/                        # health.test.ts — arranca el handler
  drizzle/                        # migraciones SQL generadas, versionadas
  .claude/                        # copiado desde workspace/ (ver §19)
  biome.json                      # lint/format (ver §19.6)
  vitest.config.ts                # runner unit/integration (ver §19.6)
  playwright.config.ts            # runner e2e (ver §19.6)
  drizzle.config.ts               # config drizzle-kit, carga dotenv (ver §19.6)
  docker-compose.yml              # Postgres local para tests (ver §19.6)
  next.config.ts                  # generado por create-next-app
  tsconfig.json                   # generado y editado (alias @/, ver §19.6)
  package.json                    # generado por create-next-app, editado en §10
  .env.example                    # todas las claves, valores vacíos/falsos
  .gitignore                      # con excepción !.env.example
```

**Boundary rules**
- Nada en `src/app/**` importa `src/lib/db/` directamente; pasa por `src/lib/catalog`, `src/lib/cart`,
  `src/lib/orders`, `src/lib/ingest`.
- `src/lib/db/index.ts` es el único lugar que abre una conexión a Postgres.
- `src/agent/**` no importa React ni nada de `src/components/**`; comparte solo `src/lib/db/schema.ts`,
  `src/lib/env.ts` y `src/lib/money.ts`.
- Todo precio se calcula en `src/lib/pricing/**` server-side; ningún componente cliente recibe la
  lista base ni el `desc_glob` de otro cliente.

La convención de resolución de módulos (alias `@/` → `src/`, sin extensión relativa) se decide una
sola vez y se reconcilia contra cada loader en la **matriz de §19.6**; no se restablece aquí.

Cada ruta de salida dibujada en este árbol toma su literal de la tabla *Cross-artifact value
reconciliation* de §19.6.

**Origen de cada archivo:** todo archivo de este árbol lo autoría un paso de §9 (aparece en su lista
**Do**) o se emite bajo `workspace/` (§19) y aterriza con la copia previa al paso 1. Los `.config`
que un `Verify` necesita (biome, vitest, playwright, drizzle, compose) toman el origen 2 (§19.6).
`package.json`, `tsconfig.json`, `next.config.ts` y `.gitignore` los genera `create-next-app` en §10
y los edita el mismo bloque Bootstrap.

---

## 4. Data Model

El portal separa **tablas espejo** (copia solo-lectura de Profit, con metadatos de sync) de **tablas
propias del portal**. Ninguna tabla espejo se edita desde la app; solo la escribe el ingest.

### Entities

**`products`** — espejo de `art` de Profit. Un producto vendible. Ciclo: creado/actualizado por el
ingest, nunca borrado (se marca `anulado`).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `co_art` | text | PK | Código de artículo, ya con `RTRIM` aplicado por el agente |
| `art_des` | text | not null | Descripción completa (marca/dosis embebidas; sin campos separados) |
| `co_lin` | text | | Línea (clasificación nivel 1) |
| `co_cat` | text | | Categoría (nivel 2) |
| `co_subl` | text | | Sublínea (nivel 3) |
| `co_prov` | text | | Proveedor / laboratorio |
| `uni_venta` | text | | Unidad de venta |
| `prec_vta1` | numeric(18,5) | not null | Precio de venta base en **Bolívares** (confirmado por el usuario); el USD se deriva con la tasa |
| `stock_act` | numeric(18,3) | not null default 0 | Existencia física total |
| `stock_com` | numeric(18,3) | not null default 0 | Existencia comprometida |
| `anulado` | boolean | not null default false | Producto anulado en Profit → no vendible |
| `campo1` | text | | Código CPE (registro sanitario) |
| `row_id_hex` | text | not null | `row_id` (rowversion) de Profit en hex — cursor de sync |
| `synced_at` | timestamptz | not null | Momento del último push que tocó esta fila |

**`product_overrides`** — control que Profit no tiene. Propiedad del portal.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `co_art` | text | PK, FK→products.co_art | |
| `is_hidden` | boolean | not null default false | Oculta el producto en el portal sin anularlo en Profit |
| `photo_url` | text | | URL de la foto en Supabase Storage |
| `updated_at` | timestamptz | not null default now() | |

**`customers`** — espejo de `clientes`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `co_cli` | text | PK | Código de cliente |
| `cli_des` | text | not null | Razón social |
| `rif` | text | | RIF |
| `email` | text | | Correo registrado (puede ser null: 22,5% sin correo) |
| `telefonos` | text | | Teléfonos (puede ser null) |
| `desc_glob` | numeric(6,3) | not null default 0 | % descuento lineal — **posición 4** de la cascada |
| `mont_cre` | numeric(18,2) | not null default 0 | Límite de crédito |
| `saldo` | numeric(18,2) | not null default 0 | Saldo actual (deuda) |
| `plaz_pag` | integer | not null default 0 | Días de crédito |
| `sincredito` | boolean | not null default false | Cliente sin crédito (contado) |
| `co_seg` | text | | **Segmento del cliente** (10=A, 20=B, 30=C, 40=D, 60=NUEVO, 70=EXCLUIDOS). Decide qué ofertas le aplican |
| `cond_1pct` | boolean | not null default false | Elegible al 1% global por portal (derivado de la condición del cliente) |
| `inactivo` | boolean | not null default false | Cliente inactivo → sin acceso |
| `row_id_hex` | text | not null | Cursor de sync |
| `synced_at` | timestamptz | not null | |

**`offers`** — espejo de cabeceras `oferta` (posiciones 1 y 3). Una oferta aplica a un cliente cuando
su **segmento** (`customers.co_seg`) cae en `[co_seg_d, co_seg_h]` **o** su código está en
`[co_cli_d, co_cli_h]`, dentro de la vigencia. **EXCLUIDOS es el segmento 70**, no un truco de texto:
un cliente de segmento 70 solo toma ofertas configuradas para 70.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `co_ofer` | text | PK | |
| `ofer_des` | text | not null | Descripción |
| `pos_ofer` | integer | not null | 0 = proveedor (posición 1), 1 = droguería (posición 3) |
| `fec_inic` | timestamptz | not null | Vigencia desde |
| `fec_fin` | timestamptz | not null | Vigencia hasta |
| `co_seg_d` / `co_seg_h` | text | | Rango de segmento al que aplica (10=A … 70=EXCLUIDOS) |
| `co_cli_d` / `co_cli_h` | text | | Rango de cliente al que aplica (si no es por segmento) |
| `synced_at` | timestamptz | not null | |

**`offer_lines`** — espejo de `reng_ofer` (detalle por artículo).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `co_ofer` | text | FK→offers.co_ofer | |
| `co_art` | text | | Artículo |
| `porc_ofer` | numeric(6,3) | not null | % de descuento de la oferta |
| — | | PK (`co_ofer`,`co_art`) | |
| `synced_at` | timestamptz | not null | |

**`product_caps`** — espejo de `art_ext.porc_max` (tope de descuento de productos regulados).
**`art_ext` está vacía (confirmado)**, así que en v1 esta tabla no tiene filas y el tope es un
no-op defensivo; el motor lo aplica solo si algún día aparecen datos.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `co_art` | text | PK | |
| `porc_max` | numeric(6,3) | not null | Techo duro de descuento sobre la cascada |
| `synced_at` | timestamptz | not null | |

**`exchange_rate`** — espejo de la tabla **`tasas`** de Profit (la actualiza un operador de
facturación a las 12:00 cada día). Una fila vigente; el portal muestra "tasa de las 12:00".

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK (siempre 1) | Fila única |
| `usd_bs` | numeric(18,6) | not null | Tasa: cuántos Bs por 1 USD |
| `effective_at` | timestamptz | not null | Fecha/hora de la tasa según Profit |
| `synced_at` | timestamptz | not null | |

**`sync_state`** — cursor incremental por tabla de origen. Propiedad del portal.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `source` | text | PK | `art` / `clientes` / `oferta` / … |
| `last_row_id_hex` | text | not null default '0x0000000000000000' | Último `row_id` procesado |
| `last_run_at` | timestamptz | | Último push aplicado |
| `last_status` | text | | `ok` / mensaje de error |

**`ingest_events`** — libro de idempotencia del ingest. Propiedad del portal.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `event_id` | text | PK | UUID que el agente asigna a cada lote |
| `source` | text | not null | Tabla de origen del lote |
| `received_at` | timestamptz | not null default now() | |
| `rows_applied` | integer | not null | |

**`app_users`** — cuenta de portal ligada a un cliente. Better Auth gestiona sus propias tablas
(`user`, `session`, `account`, `verification`); esta es la nuestra que las enlaza al cliente.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default gen_random_uuid() | |
| `auth_user_id` | text | unique, FK→ Better Auth `user.id` | Enlace a la identidad |
| `co_cli` | text | unique, FK→customers.co_cli | Cliente que representa |
| `role` | text | not null default 'client' | `client` / `admin` |
| `created_at` | timestamptz | not null default now() | |

**`carts`** — un carrito abierto por usuario.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default gen_random_uuid() | |
| `app_user_id` | uuid | FK→app_users.id, not null | |
| `status` | text | not null default 'open' | `open` / `submitted` |
| `created_at` | timestamptz | not null default now() | |
| `updated_at` | timestamptz | not null default now() | |

**`cart_lines`** — línea de carrito. Guarda **solo** producto y cantidad; el precio se recalcula
server-side en cada lectura.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default gen_random_uuid() | |
| `cart_id` | uuid | FK→carts.id, not null | |
| `co_art` | text | not null | |
| `qty` | numeric(18,3) | not null | Cantidad |
| — | | unique (`cart_id`,`co_art`) | Una línea por producto |

**`orders`** — cotización enviada. Snapshot inmutable.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default gen_random_uuid() | |
| `order_number` | text | unique, not null | Referencia visible al cliente |
| `app_user_id` | uuid | FK→app_users.id, not null | |
| `co_cli` | text | not null | Cliente (snapshot) |
| `usd_bs_used` | numeric(18,6) | not null | Tasa congelada del pedido |
| `applied_1pct` | boolean | not null default false | Si se aplicó el 1% global |
| `subtotal` | numeric(18,2) | not null | |
| `total` | numeric(18,2) | not null | |
| `status` | text | not null default 'submitted' | `submitted` / `imported` |
| `created_at` | timestamptz | not null default now() | |

**`order_lines`** — línea de cotización con el precio **congelado**.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default gen_random_uuid() | |
| `order_id` | uuid | FK→orders.id, not null | |
| `co_art` | text | not null | |
| `art_des` | text | not null | Descripción (snapshot) |
| `qty` | numeric(18,3) | not null | |
| `prec_vta1` | numeric(18,5) | not null | Precio base (snapshot) |
| `cascade` | text | not null | Cascada aplicada, texto `p1+p2+p3+p4` (snapshot, formato Profit) |
| `unit_frozen` | numeric(18,5) | not null | Precio unitario neto congelado |
| `line_net` | numeric(18,2) | not null | Neto de la línea |

**`payment_proofs`** — comprobante registrado por el cliente.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default gen_random_uuid() | |
| `app_user_id` | uuid | FK→app_users.id, not null | |
| `co_cli` | text | not null | |
| `amount` | numeric(18,2) | not null | Monto declarado |
| `currency` | text | not null | `BS` / `USD` |
| `method` | text | not null | `transfer` / `pago_movil` / `deposit` |
| `reference` | text | not null | Referencia bancaria |
| `image_url` | text | not null | URL firmada del comprobante en Storage |
| `note` | text | | |
| `emailed_at` | timestamptz | | Cuándo se notificó a ZAKIPHARMA |
| `created_at` | timestamptz | not null default now() | |

**`audit_log`** — append-only.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default gen_random_uuid() | |
| `actor` | text | | co_cli o admin id |
| `action` | text | not null | |
| `target_type` | text | | |
| `target_id` | text | | |
| `metadata` | jsonb | | |
| `created_at` | timestamptz | not null default now() | |

### Relationships

- `app_users` —(1)→ `customers` vía `co_cli` · borrado: restrict (no se borran clientes).
- `carts` —(1..N)→ `cart_lines` · borrado: cascade.
- `orders` —(1..N)→ `order_lines` · borrado: restrict (los pedidos son inmutables).
- `products` —(1)→ `product_overrides` · borrado: cascade.
- `offers` —(1..N)→ `offer_lines` · borrado: cascade.
- Las líneas de pedido/comprobante **nunca** se unen a `products`/`customers` vivos: guardan snapshot.

### Indexes

| Table | Index | Why |
|---|---|---|
| `products` | `idx_products_anulado_co_lin` (`anulado`,`co_lin`) | Listado del catálogo filtra anulados y agrupa por línea |
| `products` | GIN sobre `to_tsvector('spanish', art_des)` | Búsqueda por texto del catálogo (9.178 filas) |
| `offers` | `idx_offers_vigencia` (`fec_inic`,`fec_fin`,`pos_ofer`) | Resolver ofertas vigentes por posición |
| `offer_lines` | `idx_offer_lines_co_art` (`co_art`) | Buscar ofertas de un artículo |
| `cart_lines` | `uq_cart_lines_cart_co_art` (`cart_id`,`co_art`) unique | Una línea por producto |
| `orders` | `uq_orders_number` (`order_number`) unique | Referencia única |
| `app_users` | `uq_app_users_co_cli` (`co_cli`) unique · `uq_app_users_auth` (`auth_user_id`) unique | Un usuario por cliente |

### Schema

El esquema real vive en `src/lib/db/schema.ts` (Drizzle) y se autoría en el paso 2. Es la única
fuente de forma de tablas; las migraciones se generan de su diff. La tabla de entidades de arriba es
el contrato que ese archivo implementa: cada entidad y columna listada existe en `schema.ts`, con los
tipos y constraints indicados. Las tablas de Better Auth (`user`, `session`, `account`,
`verification`) las genera el esquema del adaptador Drizzle de Better Auth en el paso 6; no se
redefinen a mano.

### Migrations

Herramienta: `drizzle-kit`. Cada cambio de `schema.ts` genera una migración con
`pnpm db:generate` (drizzle-kit elige el nombre del archivo). Se aplican con `pnpm db:migrate`,
siempre como paso de deploy explícito, nunca al arrancar la app. Regla de producción: expand →
migrate → contract; nunca una migración destructiva en el mismo deploy que el código.

### Seed data

`src/lib/db/seed.ts` (corrido con `pnpm db:seed`) siembra un dataset realista tomado del dossier:
~20 productos con los códigos y descripciones reales (`OMEPRAZOL 20 MG X 10 CAP ( ZAKIMED )`, etc.),
3 clientes con `desc_glob` distinto (uno con 12,00 como el cliente `0370`), 2 pares de ofertas
vigentes con su gemela EXCLUIDOS, un producto con `porc_max`, una tasa de cambio vigente, y un
`app_user` admin. Con eso la app es navegable en el primer arranque local.

---

## 5. API Design

### Conventions

- Base path: rutas de app bajo `/`, endpoints de máquina bajo `/api`.
- Response envelope (endpoints `/api`): éxito `{ ok: true, data }`, error `{ ok: false, error: { code, message } }`. Una sola forma.
- Error codes: `unauthorized` (401), `forbidden` (403 → se devuelve 404 entre fronteras de cliente), `bad_request` (400), `invalid_signature` (401), `not_found` (404), `rate_limited` (429), `internal` (500).
- Validation: `zod` en cada route handler y cada server action, antes de tocar lógica.
- Pagination: cursor-based en el catálogo (cursor opaco `co_art`), tope de página 60 en el servidor.
- Idempotency: `/api/ingest` deduplica por `event_id` bajo constraint único en `ingest_events`.
- Rate limits: `/api/ingest` limitado por IP y por firma; activación OTP limitada por cuenta e IP.

### Routes

| Method | Path | Description | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/health` | DB alcanzable + frescura del espejo | public | — |
| POST | `/api/ingest` | Recibe lote del agente, upsert idempotente al espejo | HMAC firma | 120/min por IP |
| ALL | `/api/auth/[...all]` | Better Auth (activación OTP, login, logout) | mixto | login 10/min |
| GET | `/catalogo` | PLP con precio por cliente y stock | client | — |
| GET | `/producto/[co_art]` | PDP | client | — |
| POST (action) | carrito add/update/remove | Mutaciones de carrito server-authoritative | client | — |
| POST (action) | enviar pedido | Carrito → cotización + correo | client | 30/min por usuario |
| POST (action) | registrar comprobante | Sube imagen + correo + registro | client | 20/min por usuario |
| GET | `/admin/**` | Panel admin | role=admin | — |

### Critical endpoints — full detail

**`POST /api/ingest`** — el único camino de escritura al espejo.
- Request: header `X-Signature: sha256=<hmac>` sobre el cuerpo crudo con `SYNC_SHARED_SECRET`; cuerpo
  `{ event_id: string(uuid), source: 'art'|'clientes'|'oferta'|'offer_lines'|'art_ext'|'exchange_rate', rows: Row[], cursor: string }`.
- Validación: firma HMAC verificada **antes** de parsear el cuerpo como confiable; luego `zod` sobre
  la forma; `source` en el conjunto enumerado.
- Reglas / errores:
  - Firma inválida → 401 `invalid_signature`, cero escrituras.
  - `event_id` ya presente en `ingest_events` → 200 `{ ok:true, data:{ deduped:true } }`, cero
    escrituras nuevas (idempotente).
  - Cuerpo malformado → 400 `bad_request`.
- Efectos: en una sola transacción, upsert de cada fila a la tabla espejo de `source`, avance de
  `sync_state.last_row_id_hex` al `cursor`, e inserción de una fila en `ingest_events`.

**`enviar pedido`** (server action) — congela el precio.
- Para cada línea del carrito recomputa el precio efectivo con `src/lib/pricing/price.ts` **en el
  servidor** (nunca confía en un precio del cliente), toma la tasa vigente, arma `orders` +
  `order_lines` con el snapshot congelado, aplica el 1% global solo si `customers.cond_1pct`, genera
  `order_number`, envía la cotización por Resend, y marca el carrito `submitted`.
- Errores: producto oculto/anulado o sin stock suficiente → 400 con el detalle de las líneas
  ofensoras y cero pedido creado.

**`registrar comprobante`** (server action).
- Valida monto/moneda/método/referencia con `zod`, sube la imagen a Supabase Storage (URL firmada),
  inserta `payment_proofs`, envía correo a ZAKIPHARMA, sella `emailed_at`.

---

## 6. Frontend Architecture

### Routes

| Route | Page | Data source | Auth |
|---|---|---|---|
| `/entrar`, `/activar` | Inicio de sesión / activación OTP | server action → Better Auth | public |
| `/catalogo` | PLP | server query (`catalog/queries`) con `co_cli` de la sesión | client |
| `/producto/[co_art]` | PDP | server query | client |
| `/carrito` | Carrito | server query (recomputa precios) | client |
| `/cuenta`, `/cuenta/pagos` | Cuenta, registro de pago | server query | client |
| `/admin/**` | Panel | server query | admin |

### Rendering strategy

- `/catalogo` y `/producto/[co_art]`: server components. El precio depende del cliente, así que la
  página es **por usuario** y se renderiza en cada request con `export const dynamic = 'force-dynamic'`
  (nunca cacheada entre clientes). La frescura al minuto la da el espejo, no un revalidate de la
  página.
- `/carrito`, `/cuenta`, `/admin/**`: dinámicas, `no-store`. Nunca cacheadas (contienen datos por
  cliente).
- Sin páginas públicas cacheables: **no hay catálogo con precios a la vista**; todo exige sesión.

### Component hierarchy

```
/catalogo (server)
  CatalogFilters (client — búsqueda/línea)
  ProductGrid (server)
    ProductCard (server) — muestra precio Bs/USD del cliente + disponible
      AddToCartButton (client leaf)
/carrito (server, recomputa)
  CartLines (server)
    QtyStepper (client leaf)
  CartSummary (server) — subtotal, 1% si aplica, total, tasa "de HH:MM"
  SubmitOrderButton (client leaf)
```

### State management

Estado de servidor vía React Query solo donde hay interacción cliente (stepper de cantidad,
resultado de acciones); el resto es server components. El precio **nunca** vive en estado de cliente:
se recalcula server-side en cada lectura del carrito. Formularios (activación, comprobante) con
`react-hook-form` + `zod`. No se pone en estado global ningún dato de precio ni de otro cliente.

### Loading, empty, and error states

Cada lista y superficie async especifica los tres: catálogo vacío ("sin resultados para tu
búsqueda"), producto agotado (tarjeta marcada "No disponible", no oculto — decisión del dossier §2.8),
carrito vacío, error de red con reintento. El agotado se muestra marcado, no se esconde.

---

## 7. Design System

Derivado de `knowledge/capabilities/styling.md` (el skill `ui-ux-pro-max` se recomienda para el build
en §18). Paleta sobria, clínica, legible sobre catálogo denso; contraste AA verificado.

### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--primary` | `#0E7490` | `#22D3EE` | Botones primarios, enlaces, foco |
| `--primary-fg` | `#FFFFFF` | `#04141A` | Texto sobre primary |
| `--background` | `#F8FAFC` | `#0B1220` | Fondo de página |
| `--surface` | `#FFFFFF` | `#131C2B` | Tarjetas, paneles, modales |
| `--border` | `#E2E8F0` | `#26344A` | Divisores, inputs |
| `--fg` | `#0F172A` | `#E5EDF7` | Texto principal |
| `--fg-muted` | `#51607A` | `#93A2BC` | Texto secundario |
| `--destructive` | `#B91C1C` | `#F87171` | Errores, eliminar |
| `--success` | `#15803D` | `#4ADE80` | Confirmaciones |

**Contrast:** los pares foreground/background cumplen WCAG 2.2 AA. Pares más riesgosos medidos:
`--fg` sobre `--background` (light) ≈ 15.9:1; `--fg-muted` sobre `--surface` (light) ≈ 5.3:1;
`--primary-fg` sobre `--primary` (light) ≈ 4.7:1. Todos ≥ 4.5:1 para texto.

### Typography

| Role | Family | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| Display | Inter | 32px / 40px | 700 | -0.01em |
| Heading | Inter | 20px / 28px | 600 | -0.005em |
| Body | Inter | 15px / 24px | 400 | 0 |
| Mono | JetBrains Mono | 13px / 20px | 500 | 0 |

**Font loading:** self-hosted vía `next/font` (Inter, JetBrains Mono), `display: "swap"`, subset
latino, con fallback a `system-ui, sans-serif`.

### Spacing, radius, elevation

- Spacing: base 4px — 4/8/12/16/24/32/48/64. Sin valores arbitrarios.
- Radius: 8px inputs y botones, 12px tarjetas, full para avatares.
- Shadows: plano — bordes; una sombra sutil en modales `0 8px 24px rgba(2,8,20,.12)`.
- Max content width: 1200px · Breakpoints: sm 640 / md 768 / lg 1024 / xl 1280.

### Motion

150ms `ease-out` en hover/focus; 200ms en aparición de modales. Solo transform/opacity. Respeta
`prefers-reduced-motion: reduce`.

### Component style

Estética utilitaria de herramienta de trabajo: densa, tabular, sin adornos, jerarquía por peso y
color de texto más que por sombras. Un componente pertenece si prioriza escaneo rápido de
producto-precio-existencia sobre lo decorativo. Sin sitio de referencia analizado.

---

## 8. Authentication & Authorization

### Provider and rationale

**Better Auth**, con los usuarios y sesiones en *nuestro* Postgres. Elegido sobre Clerk porque
~2.000 clientes con costo por MAU no tiene sentido, y porque el usuario debe unirse por FK al espejo
de clientes para autorizar por `co_cli`. Sesión por **cookie** (navegador). Plugin **email-OTP** para
la activación.

### Flows

- **Activación (sin auto-registro):** el cliente ya existe en `customers` (espejo). En `/activar`
  ingresa su `co_cli` o correo → si coincide con un `customers` activo con correo, se envía un OTP a
  ese correo → al validar, fija su clave y se crea el `app_user` ligado a ese `co_cli`. Nunca se usa
  `co_cli` como clave por defecto.
- **Clientes sin correo/teléfono** (454 sin correo, 288 sin teléfono): no pueden auto-activarse; el
  admin los activa a mano desde `/admin/clientes` (registra un correo de contacto o crea el
  `app_user` directamente). Documentado como flujo de soporte, no de auto-servicio.
- **Login:** correo + clave. **Reset:** OTP al correo registrado. **Logout everywhere:** invalida la
  sesión. **Expiración:** cookie de sesión con vida limitada; renovación transparente.

### Route protection

| Surface | Rule | Enforced where |
|---|---|---|
| `/catalogo`, `/producto/*`, `/carrito`, `/cuenta/*` | authenticated (client) | `src/lib/auth.ts` (getSession) + guard en cada server action |
| `/admin/*` | role = admin | `src/lib/auth.ts` + guard en cada acción admin |
| `/api/ingest` | firma HMAC | `src/app/api/ingest/route.ts` |

**Enforcement rule:** la autorización se verifica server-side en cada request. Un botón oculto no es
un permiso. Entre clientes se devuelve **404, no 403**.

### Roles and permissions

| Role | Can | Cannot |
|---|---|---|
| `client` | Ver su catálogo/precio, armar carrito, enviar pedido, registrar comprobante, ver su cupo/saldo/pedidos | Ver datos de otro cliente; acceder a `/admin`; ver la lista base sin su descuento |
| `admin` | Ocultar productos, cargar fotos, activar clientes, ver estado de sync y cotizaciones | Escribir en Profit; ver claves de clientes |

### Sessions

Cookie `httpOnly` + `Secure` + `SameSite=Lax`, gestionada por Better Auth; sesión referenciable en
Postgres (revocable). CSRF: las mutaciones son server actions con verificación de origen del
framework; el endpoint `/api/ingest` no usa cookies (firma HMAC), inmune a CSRF.

### Multi-tenancy / row-level isolation

Cada lectura/escritura del cliente pasa por funciones de `src/lib/*` que reciben el `co_cli` de la
sesión como argumento y filtran por él; ninguna consulta de cliente corre sin ese scope. "Acordarse
de filtrar" no es un mecanismo: el scope es un parámetro obligatorio de la capa de datos.

---

## 9. BUILD ORDER

### Step map

| # | Step | Depends on | Touches | Gate |
|---|---|---|---|---|
| 1 | Andamiaje, toolchain, repo y health | — | package.json, tsconfig, health route, env, smoke test | `pnpm build` + smoke test 200 |
| 2 | Capa de datos: esquema espejo + portal, migración, siembra | 1 | schema.ts, db/index.ts, seed.ts, migración | `pnpm db:migrate` + `pnpm db:seed` |
| 3 | Ingest API: HMAC + upsert idempotente al espejo | 2 | ingest/route.ts, ingest/apply.ts, tests | replay de un evento no duplica filas |
| 4 | Agente de sincronización on-prem | 3 | agent/sync.ts, agent/profit.ts, agent/push.ts, test | firma válida + cursor avanza contra fixture |
| 5 | Motor de precios: cascada + EXCLUIDOS + tope + 1% | 2 | pricing/cascade.ts, offers.ts, price.ts, money.ts, tests | 5 líneas de factura reales al céntimo |
| 6 | Auth + activación OTP + provisión desde espejo | 2 | auth.ts, auth route, activar/entrar pages, test | ruta protegida redirige; activación crea app_user |
| 7 | Catálogo PLP/PDP con precio por cliente y stock | 5,6 | catalog/queries.ts, catalogo/producto pages, test | precio del cliente correcto; agotado marcado |
| 8 | Carrito server-authoritative + anti-sobreventa | 7 | cart/server.ts, carrito page, test | precio del cliente ignorado; sin sobreventa |
| 9 | Envío de pedido: cotización congelada + correo | 8 | orders/server.ts, email.ts, test | 1 pedido con precio congelado; correo enviado |
| 10 | Registro de comprobante: subida + correo | 6 | storage.ts, cuenta/pagos page, test | comprobante guardado + correo |
| 11 | Cuenta: cupo, saldo, historial | 9,10 | cuenta page, queries, test | cupo/saldo del cliente correctos |
| 12 | Panel admin: overrides, fotos, activación, sync | 3,6 | admin pages, test | ocultar producto lo saca del catálogo |
| 13 | Observabilidad, reconciliación y salud | 9,12 | health (edit), reconcile script + test | reconciliación sin diferencias |
| 14 | E2E, a11y, CI y deploy | 13 | e2e pedido, e2e a11y, CI, deploy config | gate global §20.1 verde en CI |

Orden: andamiaje → datos → ingest/agente → motor → auth → una rebanada vertical (catálogo→carrito→
pedido) → features restantes → operación → e2e/deploy. El health route del paso 1 se ejecuta en su
propio gate (regla 13).

---

### Step 1 — Andamiaje, toolchain, repo y health

**Do**
Levantar el proyecto Next.js y probar que arranca. El Bootstrap de §10 ya generó el andamiaje, colocó
los configs de `workspace/` (§19.6), editó `package.json`/`tsconfig.json`/`biome.json`/`.gitignore`,
instaló dependencias, y creó el repositorio con su primer commit. Este paso autoría:
- `src/lib/env.ts` — `process.env` validado con `zod`. En este paso solo `NODE_ENV` es requerido; las
  demás variables se añaden como requeridas en los pasos que las consumen (§10, columna "Required by
  step"), para no romper gates anteriores.
- `src/app/api/health/route.ts` — `GET` que devuelve `{ ok: true, data: { status: 'ok' } }` con 200.
- `tests/smoke/health.test.ts` — importa el handler `GET` y afirma status 200.

**Done when**
- [ ] WHEN `pnpm install --frozen-lockfile` runs THE SYSTEM SHALL exit 0 without modifying the lockfile.
- [ ] WHEN `pnpm build` runs THE SYSTEM SHALL exit 0.
- [ ] WHEN `pnpm typecheck` runs THE SYSTEM SHALL exit 0 with `strict` true in `tsconfig.json`.
- [ ] WHEN `pnpm lint` runs over the tree with the bundle present THE SYSTEM SHALL exit 0 with zero errors and zero warnings.
- [ ] WHEN the smoke test invokes the `/api/health` `GET` handler THE SYSTEM SHALL return HTTP 200 with `ok: true`.
- [ ] WHEN `NODE_ENV` is absent at import of `src/lib/env.ts` THE SYSTEM SHALL throw a named error rather than continue.

**Verify**
```bash
pnpm install --frozen-lockfile        # expect: exit 0
pnpm typecheck                        # expect: exit 0
pnpm lint                             # expect: exit 0, 0 errors, 0 warnings
pnpm build                            # expect: exit 0
pnpm test tests/smoke/health.test.ts  # expect: exit 0, 1 passed, 0 skipped
```

**Checkpoint**
```bash
git add -A && git commit -m "step 1: scaffold, toolchain, health route"
git tag step-01-scaffold
# rollback target if step 2 goes wrong: git reset --hard step-01-scaffold
```

---

### Step 2 — Capa de datos: esquema espejo + portal, migración, siembra

**Do**
Autorizar el esquema Drizzle con todas las entidades de §4 (espejo + portal), el cliente db, la
migración y la siembra. Crear:
- `src/lib/db/schema.ts` — todas las tablas de §4 con sus tipos, PKs, FKs, uniques e índices.
- `src/lib/db/index.ts` — cliente `postgres` + Drizzle, leyendo `DATABASE_URL` desde `src/lib/env.ts`.
- `src/lib/db/seed.ts` — siembra realista de §4 (Seed data), corrida con `tsx`, cargando dotenv.
- Editar `src/lib/env.ts` para requerir `DATABASE_URL` desde este paso.
- La migración que emite `pnpm db:generate` (no inventar su nombre; drizzle-kit lo elige).

Levantar antes el Postgres local con `pnpm db:up` (compose de §19.6). `drizzle.config.ts` y el seed
cargan el `.env` por sí mismos (§19.6).

**Done when**
- [ ] WHEN `pnpm db:migrate` runs against the local database THE SYSTEM SHALL apply every table §4 defines, and a second run SHALL be a no-op.
- [ ] WHEN a `\d products` is issued THE SYSTEM SHALL show the `prec_vta1`, `stock_act`, `stock_com` and `row_id_hex` columns.
- [ ] WHEN `pnpm db:seed` runs THE SYSTEM SHALL insert the demo dataset and a second run SHALL not duplicate rows (upsert on primary key).
- [ ] WHEN a query through the exported client selects a seeded product THE SYSTEM SHALL return typed rows with no `any`.
- [ ] WHEN `DATABASE_URL` is absent at boot THE SYSTEM SHALL fail with a named error, not at first query.

**Verify**
```bash
pnpm db:up                            # expect: exit 0, Postgres healthy
pnpm db:generate                      # expect: exit 0, emits a migration under drizzle/
pnpm db:migrate                       # expect: exit 0
pnpm db:migrate                       # expect: exit 0, no changes to apply (idempotent)
psql "$DATABASE_URL" -c "\d products" # expect: lists prec_vta1, stock_act, stock_com, row_id_hex
pnpm db:seed                          # expect: exit 0
pnpm db:seed                          # expect: exit 0, no duplicate rows
pnpm test tests/integration/db.test.ts # expect: exit 0, 0 failed, 0 skipped
```

**Checkpoint**
```bash
git add -A && git commit -m "step 2: mirror + portal schema, migration, seed"
git tag step-02-data
# rollback target if step 3 goes wrong: git reset --hard step-02-data
```

---

### Step 3 — Ingest API: HMAC + upsert idempotente al espejo

**Do**
Construir el único camino de escritura al espejo (§5, `POST /api/ingest`). Crear:
- `src/lib/ingest/apply.ts` — upsert transaccional por `source`, avance de `sync_state`, inserción en
  `ingest_events`; deduplica por `event_id`.
- `src/app/api/ingest/route.ts` — verifica la firma HMAC con `SYNC_SHARED_SECRET` sobre el cuerpo
  crudo **antes** de parsear; valida con `zod`; delega en `apply.ts`.
- Editar `src/lib/env.ts` para requerir `SYNC_SHARED_SECRET` desde este paso.
- `tests/integration/ingest.test.ts` — firma válida/ inválida, replay idempotente.

**Done when**
- [ ] WHEN a POST arrives at `/api/ingest` with a valid HMAC signature and an `art` batch THE SYSTEM SHALL upsert each row into `products` and advance `sync_state`, returning 200.
- [ ] WHEN a POST arrives with an invalid `X-Signature` THE SYSTEM SHALL respond 401 `invalid_signature` and write zero rows.
- [ ] WHEN the same `event_id` is delivered twice THE SYSTEM SHALL return 200 both times and leave the mirror row count unchanged.
- [ ] WHEN the body is malformed THE SYSTEM SHALL respond 400 `bad_request` and write nothing.
- [ ] WHEN `SYNC_SHARED_SECRET` is unset at boot THE SYSTEM SHALL fail startup with a named error.

**Verify**
```bash
pnpm test tests/integration/ingest.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 3: signed idempotent ingest API"
git tag step-03-ingest
# rollback target if step 4 goes wrong: git reset --hard step-03-ingest
```

---

### Step 4 — Agente de sincronización on-prem

**Do**
El proceso que corre junto al SQL Server de Profit y empuja al ingest. Crear:
- `src/agent/profit.ts` — consultas **solo lectura** a SQL Server (driver `mssql`) para `art`,
  `clientes` (incl. `co_seg`), `oferta` (incl. `co_seg_d/h`, `co_cli_d/h`), `reng_ofer` y la tabla
  `tasas`, filtrando por `row_id > @cursor` donde exista; aplica `RTRIM` a los códigos `char` y calcula
  `disponible`. **SQL Server 2019 Enterprise (confirmado)**: conexión cifrada estándar del driver
  `mssql`, sin workaround de TLS legacy.
- `src/agent/push.ts` — arma el lote con `event_id` (uuid), firma HMAC con `SYNC_SHARED_SECRET`, hace
  `POST` al `INGEST_URL`, carga dotenv.
- `src/agent/sync.ts` — orquesta: lee `sync_state` remoto por tabla, lee incremental de Profit,
  empuja, repite; modo `--once` para un ciclo; cargable por el Programador de tareas de Windows.
- Editar `src/lib/env.ts` para requerir `INGEST_URL` y las credenciales `PROFIT_SQL_*` desde este paso.
- `tests/unit/agent-push.test.ts` — firma HMAC determinista y forma del lote, contra un doble del
  fetch (sin SQL Server real).

El agente contra Profit real se prueba on-prem (necesita el SQL Server); esa prueba va a la lista de
lanzamiento de §20.1, no a un gate de build. El test de este paso cubre firma y forma del payload.

**Done when**
- [ ] WHEN the agent builds a batch THE SYSTEM SHALL produce an `X-Signature` that the ingest route verifies as valid for the same `SYNC_SHARED_SECRET`.
- [ ] WHEN a batch is pushed and accepted THE SYSTEM SHALL update the local cursor to the batch `cursor` so the next cycle reads only newer `row_id`s.
- [ ] WHEN the SQL Server connection fails THE SYSTEM SHALL surface a named error and exit non-zero, not hang.
- [ ] WHEN a `char` code is read from Profit THE SYSTEM SHALL emit it right-trimmed.

**Verify**
```bash
pnpm test tests/unit/agent-push.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                           # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 4: on-prem sync agent"
git tag step-04-agent
# rollback target if step 5 goes wrong: git reset --hard step-04-agent
```

---

### Step 5 — Motor de precios: cascada + EXCLUIDOS + tope + 1%

**Do**
El corazón del sistema. Replica la cascada validada del dossier. Crear:
- `src/lib/money.ts` — helpers `big.js`: multiplicar por `(1 - p/100)`, encadenar, redondear a 2.
- `src/lib/pricing/offers.ts` — dado un producto y el **cliente** (`co_seg` y `co_cli`), resuelve el %
  vigente de la posición 1 (`oferta pos_ofer=0`) y de la posición 3 (`oferta pos_ofer=1`): una oferta
  aplica cuando el segmento del cliente cae en `[co_seg_d, co_seg_h]` **o** su código en
  `[co_cli_d, co_cli_h]`, el producto entra en su alcance, y `now` está entre `fec_inic` y `fec_fin`.
  **EXCLUIDOS es el segmento 70** — un cliente de segmento 70 solo toma ofertas de segmento 70 (sin
  emparejamiento por texto). Contempla también `oferta_cli` (por tipo/grupo o por cliente). *La regla
  exacta de combinación de `oferta_cli` se confirma antes del corte (ver §20.2).*
- `src/lib/pricing/cascade.ts` — `neto_unit = prec_vta1 × (1-p1)(1-p2)(1-p3)(1-p4)`, multiplicativa.
  **`p2 = 0` (confirmado: `descuen` vacía).** El techo `porc_max` es un no-op en v1 (`art_ext` vacía);
  la función lo aplica defensivamente si algún día aparece un tope.
- `src/lib/pricing/price.ts` — precio efectivo por `(cliente, producto, cantidad)`: usa `desc_glob`
  como p4, las ofertas de `offers.ts` como p1/p3, y expone si el 1% global aplica según
  `customers.cond_1pct`.
- `tests/unit/pricing.test.ts` — reproduce **al céntimo** las 5 líneas de factura reales del dossier.

**Done when**
- [ ] WHEN `cascade` computes with `prec_vta1=2165.23`, `qty=6`, positions `(0,6,17,12)` THE SYSTEM SHALL return line net `8919.57`.
- [ ] WHEN `cascade` computes with `prec_vta1=589.84`, `qty=20`, positions `(0,6,34,12)` THE SYSTEM SHALL return line net `6440.49`.
- [ ] WHEN `cascade` computes with `prec_vta1=746.63`, `qty=50`, positions `(0,0,13,12)` THE SYSTEM SHALL return line net `28581.00`.
- [ ] WHEN `cascade` computes with `prec_vta1=671.97`, `qty=90`, positions `(0,0,4,12)` THE SYSTEM SHALL return line net `51091.22`.
- [ ] WHEN a customer's segment `co_seg` is 70 (EXCLUIDOS) THE SYSTEM SHALL apply only offers configured for segment 70, not the general-segment offers.
- [ ] WHEN the cascade discount would exceed a product's `porc_max` THE SYSTEM SHALL cap the total discount at `porc_max`.

**Verify**
```bash
pnpm test tests/unit/pricing.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                        # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 5: pricing cascade engine"
git tag step-05-pricing
# rollback target if step 6 goes wrong: git reset --hard step-05-pricing
```

---

### Step 6 — Auth + activación OTP + provisión desde espejo

**Do**
Better Auth con activación por OTP y protección de rutas. Crear:
- `src/lib/auth.ts` — instancia Better Auth (adaptador Drizzle, plugin email-OTP), `getSession()`, y
  la provisión just-in-time del `app_user` ligado al `co_cli` del `customers` que coincide con el
  correo verificado.
- `src/app/api/auth/[...all]/route.ts` — handler de Better Auth.
- `src/app/(auth)/activar/page.tsx` y `entrar/page.tsx` — formularios con `react-hook-form` + `zod`.
- Editar `src/lib/env.ts` para requerir `BETTER_AUTH_SECRET` desde este paso.
- El esquema de Better Auth (tablas `user`/`session`/`account`/`verification`) se genera con su CLI y
  se migra; no se redefine a mano.
- `tests/integration/auth.test.ts` — ruta protegida sin sesión redirige; OTP válido crea `app_user`.

**Done when**
- [ ] WHEN an anonymous request hits `/catalogo` THE SYSTEM SHALL redirect to `/entrar` and return to `/catalogo` after login.
- [ ] WHEN a valid OTP is confirmed for an email matching an active `customers` row THE SYSTEM SHALL create exactly one `app_user` linked to that `co_cli`.
- [ ] WHEN an OTP is requested for an email not present in `customers` THE SYSTEM SHALL not create any user and SHALL report a generic message.
- [ ] WHEN the same activation completes twice THE SYSTEM SHALL leave exactly one `app_user` for that `co_cli`.

**Verify**
```bash
pnpm test tests/integration/auth.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                            # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 6: auth + OTP activation"
git tag step-06-auth
# rollback target if step 7 goes wrong: git reset --hard step-06-auth
```

---

### Step 7 — Catálogo PLP/PDP con precio por cliente y stock

**Do**
Las páginas de catálogo, server-rendered, con el precio del cliente y la existencia. Crear:
- `src/lib/catalog/queries.ts` — lecturas del catálogo que reciben el `co_cli` de la sesión, aplican
  `product_overrides.is_hidden`, calculan `disponible = max(0, stock_act - stock_com)`, y el precio
  con `src/lib/pricing/price.ts`; búsqueda por texto (índice GIN) y paginación por cursor.
- `src/app/(shop)/catalogo/page.tsx` y `producto/[co_art]/page.tsx` — server components,
  `force-dynamic`, muestran Bs y USD (tasa "de HH:MM") y el disponible; el agotado marcado, no oculto.
- `tests/integration/catalog.test.ts` — precio del cliente correcto; producto oculto ausente; agotado
  marcado.

**Done when**
- [ ] WHEN a signed-in client opens `/catalogo` THE SYSTEM SHALL show each product's price computed with that client's `desc_glob` and offers.
- [ ] WHEN a product has `is_hidden = true` THE SYSTEM SHALL omit it from the listing and return 404 for its PDP.
- [ ] WHEN a product's `disponible` is 0 THE SYSTEM SHALL show it marked "No disponible" rather than hide it.
- [ ] WHEN a client searches a term THE SYSTEM SHALL return matches from `art_des` using the text index, capped at 60 per page.

**Verify**
```bash
pnpm test tests/integration/catalog.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 7: catalog PLP/PDP with per-client price"
git tag step-07-catalog
# rollback target if step 8 goes wrong: git reset --hard step-07-catalog
```

---

### Step 8 — Carrito server-authoritative + anti-sobreventa

**Do**
El carrito con precios y totales calculados en el servidor. Crear:
- `src/lib/cart/server.ts` — add/update/remove sobre `cart_lines` (solo `co_art`+`qty`); recomputa
  todos los precios y totales server-side en cada lectura; rechaza cantidades por encima del
  `disponible`.
- `src/app/(shop)/carrito/page.tsx` — muestra líneas recomputadas, subtotal, 1% si aplica, total,
  tasa "de HH:MM".
- `tests/integration/cart.test.ts` — precio del cliente ignorado si viene del cliente; sobreventa
  rechazada.

**Done when**
- [ ] WHEN a client submits a tampered line price THE SYSTEM SHALL ignore it and compute the total from the mirror and the pricing engine.
- [ ] WHEN a client sets a line quantity above the product's `disponible` THE SYSTEM SHALL reject the update and report the available amount.
- [ ] WHEN a cart is read THE SYSTEM SHALL recompute every line price server-side using the client's `desc_glob`.
- [ ] WHEN the same product is added twice THE SYSTEM SHALL keep one line and sum the quantity.

**Verify**
```bash
pnpm test tests/integration/cart.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                            # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 8: server-authoritative cart"
git tag step-08-cart
# rollback target if step 9 goes wrong: git reset --hard step-08-cart
```

---

### Step 9 — Envío de pedido: cotización congelada + correo

**Do**
Convertir el carrito en cotización con el precio congelado y notificar. Crear:
- `src/lib/orders/server.ts` — recomputa cada línea server-side, congela `unit_frozen`/`cascade`/
  `line_net`, toma la tasa vigente en `usd_bs_used`, aplica el 1% solo si `cond_1pct`, genera
  `order_number`, escribe `orders`+`order_lines` en una transacción, marca el carrito `submitted`.
- `src/lib/email.ts` — cliente Resend; envía la cotización a ZAKIPHARMA y al cliente.
- Editar `src/lib/env.ts` para requerir `RESEND_API_KEY` y `ORDER_NOTIFY_EMAIL` desde este paso.
- `tests/integration/orders.test.ts` — crea exactamente un pedido con el precio congelado; el correo
  se despacha (cliente Resend doblado).

**Done when**
- [ ] WHEN a client submits a cart THE SYSTEM SHALL create exactly one `orders` row and one `order_lines` row per cart line, each with `unit_frozen` from the pricing engine.
- [ ] WHEN the order is created THE SYSTEM SHALL freeze `usd_bs_used` to the current mirror rate.
- [ ] WHEN the client is `cond_1pct = true` THE SYSTEM SHALL set `applied_1pct = true` and reduce the subtotal by 1%; otherwise `applied_1pct = false`.
- [ ] WHEN the order is created THE SYSTEM SHALL send the quotation email and mark the cart `submitted`.
- [ ] WHEN a line references a hidden or out-of-stock product THE SYSTEM SHALL create no order and report the offending lines.

**Verify**
```bash
pnpm test tests/integration/orders.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 9: quote submission + email"
git tag step-09-orders
# rollback target if step 10 goes wrong: git reset --hard step-09-orders
```

---

### Step 10 — Registro de comprobante: subida + correo

**Do**
El registro de comprobantes de pago. Crear:
- `src/lib/storage.ts` — cliente Supabase Storage; sube la imagen y devuelve una URL firmada.
- `src/app/(shop)/cuenta/pagos/page.tsx` — formulario (`react-hook-form`+`zod`): monto, moneda,
  método, referencia, imagen, nota; server action inserta `payment_proofs`, envía correo, sella
  `emailed_at`.
- Editar `src/lib/env.ts` para requerir `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` y `PROOF_NOTIFY_EMAIL`
  desde este paso.
- `tests/integration/proofs.test.ts` — comprobante guardado; correo despachado (dobles de Storage y
  Resend).

**Done when**
- [ ] WHEN a client submits a valid proof THE SYSTEM SHALL store the image, insert one `payment_proofs` row, and send the notification email.
- [ ] WHEN a proof is missing a required field THE SYSTEM SHALL reject it and write nothing.
- [ ] WHEN the proof is stored THE SYSTEM SHALL set `emailed_at` after the email is dispatched.
- [ ] WHEN a client requests the proof image URL THE SYSTEM SHALL return a signed URL, not a public one.

**Verify**
```bash
pnpm test tests/integration/proofs.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 10: payment proof capture"
git tag step-10-proofs
# rollback target if step 11 goes wrong: git reset --hard step-10-proofs
```

---

### Step 11 — Cuenta: cupo, saldo, historial

**Do**
La página de cuenta con datos de crédito y el historial. Crear:
- `src/app/(shop)/cuenta/page.tsx` — muestra `mont_cre` (cupo), `saldo`, `plaz_pag` y si es
  contado/crédito, más el historial de `orders` y `payment_proofs` del cliente.
- Extender `src/lib/catalog/queries.ts` (o `src/lib/orders/server.ts`) con lecturas del historial y
  del crédito, siempre scoped por `co_cli`.
- `tests/integration/account.test.ts` — cupo/saldo del cliente correctos; un cliente no ve datos de
  otro (404).

**Done when**
- [ ] WHEN a client opens `/cuenta` THE SYSTEM SHALL show their `mont_cre`, `saldo` and `plaz_pag` from the mirror.
- [ ] WHEN a client opens `/cuenta` THE SYSTEM SHALL list only their own orders and proofs.
- [ ] WHEN a client requests another client's order by id THE SYSTEM SHALL return 404.
- [ ] WHEN a client is `sincredito = true` THE SYSTEM SHALL label the account "contado".

**Verify**
```bash
pnpm test tests/integration/account.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 11: account credit and history"
git tag step-11-account
# rollback target if step 12 goes wrong: git reset --hard step-11-account
```

---

### Step 12 — Panel admin: overrides, fotos, activación, sync

**Do**
El panel de administración mínimo. Crear:
- `src/app/(admin)/admin/page.tsx` — tablero con el estado de `sync_state` (última corrida, frescura).
- `src/app/(admin)/admin/productos/page.tsx` — ocultar/mostrar productos (`product_overrides`) y
  cargar fotos (Storage).
- `src/app/(admin)/admin/clientes/page.tsx` — activar clientes (crear `app_user` o registrar correo).
- `src/app/(admin)/admin/pedidos/page.tsx` — ver cotizaciones enviadas.
- `tests/integration/admin.test.ts` — ocultar un producto lo saca del catálogo; no-admin recibe 404.

**Done when**
- [ ] WHEN an admin hides a product THE SYSTEM SHALL set `is_hidden = true` and the product SHALL disappear from the client catalog.
- [ ] WHEN a non-admin requests any `/admin` route THE SYSTEM SHALL return 404.
- [ ] WHEN an admin activates a contactless client THE SYSTEM SHALL create an `app_user` for that `co_cli`.
- [ ] WHEN an admin opens the dashboard THE SYSTEM SHALL show the last sync time per source from `sync_state`.

**Verify**
```bash
pnpm test tests/integration/admin.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                             # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 12: admin panel"
git tag step-12-admin
# rollback target if step 13 goes wrong: git reset --hard step-12-admin
```

---

### Step 13 — Observabilidad, reconciliación y salud

**Do**
Cerrar la operación con salud y reconciliación. Crear/editar:
- Extender `src/app/api/health/route.ts` — verifica DB alcanzable y la frescura del espejo
  (`max(synced_at)` de `products`), devuelve `degraded` si la antigüedad supera el umbral.
- `src/lib/reconcile.ts` — comprueba que no haya `orders` sin `order_lines` y que ninguna línea
  supere el `porc_max` del producto.
- `tests/integration/reconcile.test.ts`.

**Done when**
- [ ] WHEN `/api/health` is requested with a fresh mirror THE SYSTEM SHALL return 200 `status: ok`.
- [ ] WHEN the newest `products.synced_at` is older than the threshold THE SYSTEM SHALL return `status: degraded`.
- [ ] WHEN the reconcile check runs on a clean dataset THE SYSTEM SHALL report zero orders without lines and zero lines exceeding `porc_max`.

**Verify**
```bash
pnpm test tests/integration/reconcile.test.ts  # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                                 # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 13: observability, reconcile, health"
git tag step-13-observability
# rollback target if step 14 goes wrong: git reset --hard step-13-observability
```

---

### Step 14 — E2E, a11y, CI y deploy

**Do**
Cerrar con las pruebas end-to-end, CI y deploy. Crear:
- `tests/e2e/pedido.spec.ts` — flujo e2e: entrar → catálogo → carrito → enviar pedido; afirma que
  existe una fila de cotización.
- `tests/e2e/a11y.spec.ts` — corre axe sobre catálogo y carrito; 0 violaciones.
- `.github/workflows/ci.yml` — corre el gate global de §20.1.
- `vercel.json` — configuración de deploy de §12 (Vercel + Supabase; agente documentado en §12).

**Done when**
- [ ] WHEN the e2e flow runs THE SYSTEM SHALL complete login → catalog → cart → submit and assert a quotation row exists.
- [ ] WHEN the a11y suite runs over catalog and cart THE SYSTEM SHALL report 0 violations.
- [ ] WHEN the CI workflow runs THE SYSTEM SHALL execute the §20.1 gate and exit 0.

**Verify**
```bash
pnpm test:e2e tests/e2e/pedido.spec.ts   # expect: exit 0, 0 failed
pnpm test:e2e tests/e2e/a11y.spec.ts     # expect: exit 0, 0 violations
pnpm build                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 14: e2e, a11y, CI, deploy"
git tag step-14-deploy
# final step — §20.1 global gate must be green
```

---

### 9.1 Parity and cutover

PORTAL-ZAKI reemplaza un portal de venta tercerizado en uso por ~2.018 clientes. No se migran datos
del portal viejo (el dato maestro vive en Profit), pero **sí** hay que probar paridad de precio y de
flujo de pedido antes de apagar el canal anterior, sobre todo porque el precio es **firme**.

#### Parity set

| # | Behavior held constant | How parity is proved | Tolerance |
|---|---|---|---|
| 1 | Precio neto por línea (cascada) | `pnpm test tests/unit/pricing.test.ts` reproduce las 5 líneas de factura reales del dossier al céntimo | Exacto (céntimo) |
| 2 | Precio cotizado ↔ precio facturado por Profit | Consulta de conciliación del período sombra: por cada pedido piloto, comparar `order_lines.unit_frozen` contra el `reng_fac.prec_vta`/`porc_desc` que Profit facturó | 0 diferencias sobre N pedidos |
| 3 | Existencia mostrada ↔ disponible en Profit | `disponible = stock_act - stock_com` verificado contra `art` en el período sombra | Exacto salvo pedidos de portal aún no cargados (§2.2 del dossier) |

**Shadow period:** durante 2–3 semanas ambos canales conviven. Un grupo piloto de clientes usa
PORTAL-ZAKI; sus cotizaciones se importan a Profit en paralelo al canal viejo. Las diferencias de
precio se registran en una consulta diaria. Paridad = 0 diferencias de precio sobre los pedidos del
piloto durante 5 días hábiles consecutivos. Una diferencia distinta de cero bloquea el corte total.

#### Cutover

| Phase | What changes | Who is affected | Reversible by | Verify |
|---|---|---|---|---|
| Piloto | Portal activo para N clientes piloto; canal viejo sigue | solo el piloto | desactivar cuentas piloto | `pnpm test:e2e tests/e2e/pedido.spec.ts` |
| Ampliación | Portal para todos; canal viejo sigue disponible | todos | avisar volver al canal viejo | consulta de conciliación = 0 diffs |
| Corte total | Portal es el canal recomendado; canal viejo en solo lectura | todos | reactivar canal viejo (no instantáneo) | conciliación diaria = 0 diffs |
| Desmantelar | Se da de baja el portal tercerizado | todos | — | contrato del proveedor cerrado |

**The kill switch:** reactivar el portal tercerizado como canal principal y avisar a los clientes.
No es instantáneo (depende del proveedor externo); estimado en horas, no minutos. Mientras el canal
viejo siga contratado durante el período sombra, "volver" es un aviso, no un despliegue.

#### Abort criteria

- [ ] WHEN la tasa de diferencia de precio en la conciliación diaria excede 0 en cualquier pedido THE SYSTEM SHALL detener el corte y volver a recomendar el canal viejo.
- [ ] WHEN la frescura del espejo supera 10 minutos en horario laboral por más de 15 minutos THE SYSTEM SHALL alertar y pausar la ampliación.
- [ ] WHEN la tasa de error de envío de pedidos excede 2× la línea base THE SYSTEM SHALL pausar y revisar.

#### Data migration

NOT APPLICABLE — no data migration. El dato maestro vive en Profit; el portal solo lo espeja. No se
copia información del portal tercerizado.

#### Decommission

Se da de baja el contrato del portal tercerizado tras un período de convivencia estable (paridad
sostenida y volumen de pedidos por portal aceptable). Antes: confirmar que ningún cliente depende del
canal viejo y conservar el acceso de solo lectura al histórico del proveedor según el contrato.

**Decommission is never a build step in §9.** Ocurre tras un período de soak que supera el build; va
en la lista de lanzamiento, no en el orden de build.

---

## 10. Environment Setup

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | LTS 24 (ver §11) | `node -v` |
| pnpm | 11 (ver §11) | `pnpm -v` |
| Docker (Postgres local para tests) | reciente | `docker --version` |

### Accounts to create first

- **Supabase** — https://supabase.com — Postgres de producción y Storage. Requerido desde el paso 2
  (DB) y el paso 10 (Storage).
- **Resend** — https://resend.com — envío de correo. Requerido desde el paso 9.
- **Vercel** — https://vercel.com — hosting del portal. Requerido en el paso 13.
- **Usuario de solo lectura sobre Profit Plus** — creado por el equipo de sistemas de ZAKIPHARMA para
  el agente. Requerido para el paso 4 en producción (on-prem).

### Environment variables

| Variable | Purpose | Where to get it | Required by step | Secret? |
|---|---|---|---|---|
| `NODE_ENV` | Modo de ejecución | entorno | 1 | no |
| `DATABASE_URL` | Postgres (app + migraciones) | Supabase → Database → Connection string | 2 | yes |
| `TEST_DATABASE_URL` | Postgres local de tests | valor local del compose (§19.6) | 2 | no |
| `SYNC_SHARED_SECRET` | HMAC entre agente e ingest | generado (`openssl rand -hex 32`) | 3 | yes |
| `INGEST_URL` | URL del endpoint de ingest para el agente | URL del deploy + `/api/ingest` | 4 | no |
| `PROFIT_SQL_HOST` | Host del SQL Server de Profit | red local (p. ej. `192.168.0.230`) | 4 | no |
| `PROFIT_SQL_USER` | Usuario RO de Profit | equipo de sistemas | 4 | yes |
| `PROFIT_SQL_PASSWORD` | Clave RO de Profit | equipo de sistemas | 4 | yes |
| `PROFIT_SQL_DATABASE` | Nombre de la base de Profit | equipo de sistemas | 4 | no |
| `BETTER_AUTH_SECRET` | Firma de sesión de Better Auth | generado (`openssl rand -hex 32`) | 6 | yes |
| `RESEND_API_KEY` | Envío de correo | Resend → API Keys | 9 | yes |
| `ORDER_NOTIFY_EMAIL` | Destino de las cotizaciones en ZAKIPHARMA | definido por ZAKIPHARMA | 9 | no |
| `SUPABASE_URL` | Storage | Supabase → Project settings → API | 10 | no |
| `SUPABASE_SERVICE_KEY` | Storage (subidas server-side) | Supabase → API → service_role | 10 | yes |
| `PROOF_NOTIFY_EMAIL` | Destino de los comprobantes | definido por ZAKIPHARMA | 10 | no |

`.env.example` se emite con todas las claves y valores vacíos/falsos (§19.6). `.env` y `.env.*.local`
van en `.gitignore`. La app valida en `src/lib/env.ts` las variables **requeridas por el paso ya
alcanzado** y falla con error nombrado; nunca cae a un default para un secreto. "Required by step" es
un contrato con §9: una variable es requerida solo desde su paso y opcional antes.

### Files that must be committed

| File | Why it is committed | Ignore-file exception line |
|---|---|---|
| `.env.example` | Contrato de variables para el builder | `!.env.example` tras el patrón `.env*` |
| `biome.json`, `vitest.config.ts`, `playwright.config.ts`, `drizzle.config.ts`, `docker-compose.yml` | Configs que los gates necesitan | — no matched by any ignore pattern |
| `.claude/` (settings, rules, skills) | Configuración del agente builder | — not matched by any ignore pattern |
| `drizzle/**` | Migraciones versionadas | — not matched by any ignore pattern |

### Bootstrap
```bash
# order matters: scaffold → copy workspace (new configs) → edit scaffolded files →
#   ignore file + exceptions → repo init → first commit → install → start local services
#   (schema migrate + seed happen in step 2, which authors schema.ts)

# --- Scaffold (create-next-app AUTHORS package.json, tsconfig.json, next.config.ts, .gitignore) ---
# --no-eslint so NO linter config is generated; we ship biome.json via workspace/ with no conflict.
# --no-agents-md so it does not write its own AGENTS.md; it still writes a boilerplate CLAUDE.md.
pnpm create next-app@latest portal-zaki --ts --app --tailwind --no-eslint --no-agents-md --src-dir --use-pnpm
cd portal-zaki

# --- Place the workspace configs and agent files ---
# create-next-app writes a boilerplate CLAUDE.md (and AGENTS.md unless --no-agents-md). Remove those
# so OURS land — rsync --ignore-existing skips a file that already exists, which would keep the wrong one.
rm -f CLAUDE.md AGENTS.md
# cp -Rn copies only missing files (re-run safe). `|| true` because BSD/macOS cp exits 1 when it
# skips an existing file (GNU exits 0) — skipping is the intended outcome. No rsync dependency.
cp -Rn ../blueprints/portal-zaki/workspace/. ./ || true
# NEVER overwritten: package.json, tsconfig.json (edited below), the lockfile — none live in workspace/.

# --- Edit scaffolded files to this stack's pins and scripts (before first commit) ---
pnpm pkg set scripts.dev="next dev" scripts.build="next build" scripts.start="next start" \
  scripts.typecheck="next typegen && tsc --noEmit" scripts.lint="biome check ." scripts.format="biome check --write ." \
  scripts.test="vitest run" scripts.test:e2e="playwright test" \
  scripts.db:generate="drizzle-kit generate" scripts.db:migrate="drizzle-kit migrate" \
  scripts.db:studio="drizzle-kit studio" scripts.db:seed="tsx src/lib/db/seed.ts" \
  scripts.db:up="docker compose up -d db" scripts.db:down="docker compose down" \
  scripts.agent:sync="tsx src/agent/sync.ts" scripts.agent:once="tsx src/agent/sync.ts --once"
pnpm pkg set engines.node=">=24" packageManager="pnpm@11.20.0"
# tsconfig: add @/ alias (create-next-app sets it) and the module-resolution flags for tsx scripts.
node -e "const f='tsconfig.json',j=require('./'+f);j.compilerOptions.allowImportingTsExtensions=true;j.compilerOptions.rewriteRelativeImportExtensions=true;require('fs').writeFileSync(f,JSON.stringify(j,null,2))"

# --- Ignore file exception BEFORE the first commit (a tracked file ignores the ignore rule) ---
printf '\n!.env.example\n' >> .gitignore

# --- Repo init + first commit (idempotent) ---
git rev-parse --git-dir >/dev/null 2>&1 || git init -b main
git add -A && git commit -m "chore: scaffold" --allow-empty

# --- Install toolchain + dependencies (override scaffold pins to §11) ---
# pnpm 11 blocks build scripts of newly-added deps (esbuild, sharp, …) and `pnpm add` may EXIT
# non-zero reporting ERR_PNPM_IGNORED_BUILDS — expected; package.json is still written. Order is what
# matters: add FIRST, then approve-builds, then the frozen install is the real gate. (Verified live in
# a scratch dir: both adds exit 1, approve-builds exits 0, `install --frozen-lockfile` exits 0, and
# lint/typecheck/build/test all pass afterward.)
pnpm add -D typescript@~6.0.3 @biomejs/biome@2.5.7 vitest@4 @playwright/test@1 tsx@4 \
  drizzle-kit@0.31.10 @types/big.js@7 dotenv@17 || true
pnpm add drizzle-orm@0.45.2 drizzle-zod@0.8.3 postgres@3 zod@4 @tanstack/react-query@5 \
  react-hook-form@7 better-auth@1.6.26 resend@6 @supabase/supabase-js@2 big.js@7 pino@10 mssql@12 || true
pnpm approve-builds --all                       # whitelist the build scripts of everything just added
pnpm install --frozen-lockfile                  # the real gate — exits 0
pnpm exec playwright install --with-deps        # e2e needs the browser binaries

# --- Local services (the schema itself is authored in step 2, so migrate/seed run there, not here) ---
docker compose up -d db                          # Postgres for tests (compose from workspace/)
pnpm dev   # http://localhost:3000 — the /api/health route serves with no tables yet
```

---

## 11. Dependencies

Cada fila proviene del reporte de `stack-researcher` de esta sesión (2026-08-04) salvo donde se
indica. `typescript` es el caso especial: `latest` es 7.0.2 (reescritura nativa), pero Next.js 16 la
rechaza sin flag experimental, así que se pina la línea 6.0.x según la guía del track — la fuente
registra el `latest` real y el motivo de la desviación.

### Runtime

| Package | Version | Source | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| next | 16.3.0 | registry.npmjs.org/-/package/next/dist-tags | 2026-08-04 | §10 (create-next-app) | Framework, SSR, route handlers |
| react | 19.2.8 | registry.npmjs.org/-/package/react/dist-tags | 2026-08-04 | §10 (create-next-app) | UI |
| react-dom | 19.2.8 | registry.npmjs.org/-/package/react-dom/dist-tags | 2026-08-04 | §10 (create-next-app) | UI |
| drizzle-orm | 0.45.2 | registry.npmjs.org/-/package/drizzle-orm/dist-tags | 2026-08-04 | §10 Bootstrap | ORM / esquema |
| drizzle-zod | 0.8.3 | registry.npmjs.org/-/package/drizzle-zod/dist-tags | 2026-08-04 | §10 Bootstrap | Validación desde el esquema |
| postgres | 3.4.9 | registry.npmjs.org/-/package/postgres/dist-tags | 2026-08-04 | §10 Bootstrap | Driver Postgres |
| zod | 4.4.3 | registry.npmjs.org/-/package/zod/dist-tags | 2026-08-04 | §10 Bootstrap | Validación en fronteras |
| @tanstack/react-query | 5.101.4 | registry.npmjs.org/-/package/@tanstack/react-query/dist-tags | 2026-08-04 | §10 Bootstrap | Estado de servidor en leaves cliente |
| react-hook-form | 7.84.0 | registry.npmjs.org/-/package/react-hook-form/dist-tags | 2026-08-04 | §10 Bootstrap | Formularios |
| better-auth | 1.6.26 | registry.npmjs.org/-/package/better-auth/dist-tags | 2026-08-04 | §10 Bootstrap | Auth + OTP |
| resend | 6.18.1 | registry.npmjs.org/-/package/resend/dist-tags | 2026-08-04 | §10 Bootstrap | Correo transaccional |
| @supabase/supabase-js | 2.112.0 | registry.npmjs.org/-/package/@supabase/supabase-js/dist-tags | 2026-08-04 | §10 Bootstrap | Storage (fotos, comprobantes) |
| big.js | 7.0.1 | registry.npmjs.org/-/package/big.js/dist-tags | 2026-08-04 | §10 Bootstrap | Aritmética decimal de la cascada |
| pino | 10.3.1 | registry.npmjs.org/-/package/pino/dist-tags | 2026-08-04 | §10 Bootstrap | Logging estructurado (server + agente) |
| mssql | 12.7.0 | registry.npmjs.org/-/package/mssql/dist-tags | 2026-08-04 | §10 Bootstrap | Driver SQL Server (agente). Ojo: TLS legacy de SQL Server 2005/2008 puede requerir `encrypt:false`/`trustServerCertificate` (§14) |
| tailwindcss | 4.3.3 | registry.npmjs.org/-/package/tailwindcss/dist-tags | 2026-08-04 | §10 (create-next-app) | Estilos |
| dotenv | 17.4.2 | registry.npmjs.org/-/package/dotenv/dist-tags | 2026-08-04 | §10 Bootstrap | Carga de env para herramientas standalone |

### Development

| Package | Version | Source | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| typescript | ~6.0.3 | knowledge/runtime-tracks/ts-node.md (last verified 2026-07-27); `latest`=7.0.2 en registry.npmjs.org 2026-08-04, no usado por incompatibilidad con Next 16 | 2026-08-04 | §10 Bootstrap | Lenguaje. Pin en 6.0.x: Next.js 16 rechaza TS 7 sin `experimental.useTypeScriptCli` |
| @biomejs/biome | 2.5.7 | registry.npmjs.org/-/package/@biomejs/biome/dist-tags | 2026-08-04 | §10 Bootstrap | Lint + format |
| vitest | 4.1.10 | registry.npmjs.org/-/package/vitest/dist-tags | 2026-08-04 | §10 Bootstrap | Tests unit/integration |
| @playwright/test | 1.62.1 | registry.npmjs.org/-/package/@playwright/test/dist-tags | 2026-08-04 | §10 Bootstrap | Tests e2e |
| drizzle-kit | 0.31.10 | registry.npmjs.org/-/package/drizzle-kit/dist-tags | 2026-08-04 | §10 Bootstrap | Migraciones |
| tsx | 4.23.5 | registry.npmjs.org/-/package/tsx/dist-tags | 2026-08-04 | §10 Bootstrap | Runner TS (seed, agente) |
| @types/big.js | 7.0.0 | registry.npmjs.org/-/package/@types/big.js/dist-tags | 2026-08-04 | §10 Bootstrap | Tipos de big.js |

Node.js LTS 24 (24.19.0) y pnpm 11.20.0 verificados en nodejs.org/dist/index.json y
registry.npmjs.org/-/package/pnpm/dist-tags el 2026-08-04. Se pinan como `>=24` (engines) y
`pnpm@11.20.0` (packageManager) en §10.

Imagen de contenedor (no npm): `postgres:17` — Docker Hub, verificado 2026-08-04. Instalada por
`docker compose up -d db` (§10); usada por los tests locales e integración. El tag literal vive en
`docker-compose.yml` (§19.6).

### Deliberately not used

| Rejected | Instead | Why |
|---|---|---|
| nodemailer | resend | Resend es API de primera clase y despliega en Vercel sin servidor SMTP; SMTP propio queda como alternativa documentada (§20.3) |
| @tanstack/react-table | Tablas server-rendered simples | Evita la v9 recién saltada; el catálogo/admin no necesita el motor de tabla completo |
| tedious (directo) | mssql | `mssql` ya lo trae por debajo; usar el envoltorio de más alto nivel |
| typescript 7.0.2 | typescript ~6.0.3 | Next.js 16 rechaza TS 7 sin flag experimental; el tooling de framework necesita la API del compilador 6.x |
| Prisma | Drizzle | Runtime delgado y SQL a la vista para replicar y auditar la cascada de precios |

---

## 12. Deployment Strategy

### Hosting

- **Portal:** Vercel. Framework Next.js autodetectado; build `next build`; runtime Node 24. Región
  cercana a Venezuela (p. ej. `iad1`/US-East por latencia y disponibilidad).
- **DB + Storage:** Supabase (Postgres gestionado, pooler para serverless + URL directa para
  migraciones; Storage para fotos y comprobantes).
- **Agente de sync:** proceso Node en una PC Windows siempre encendida dentro de la red de ZAKIPHARMA,
  lanzado por el Programador de tareas cada 1–2 min (`pnpm agent:once`). No corre en Vercel.

### Environments

| Environment | Branch | URL | Database | Third-party mode |
|---|---|---|---|---|
| Local | — | localhost:3000 | Postgres del compose (§19.6) | claves de prueba |
| Preview | cualquier PR | auto (Vercel) | branch db de Supabase | claves de prueba |
| Production | `main` | dominio de ZAKIPHARMA | Supabase prod | claves reales |

### CI/CD

Pipeline (`.github/workflows/ci.yml`), en orden: instalar con lockfile congelado → `pnpm typecheck`
→ `pnpm lint` → levantar Postgres de servicio → `pnpm db:migrate` → `pnpm test` → `pnpm build` →
`pnpm test:e2e`. Es el mismo conjunto del gate de §20.1. La conexión de Postgres en CI usa el mismo
`docker-compose.yml`.

### Release and rollback

Deploy por push a `main` (Vercel promueve). Rollback: re-promover el deploy anterior en Vercel (near
instant). Migraciones: como paso de deploy explícito, antes de que el nuevo código sirva tráfico,
nunca al arrancar; expand→migrate→contract para cambios destructivos.

### Domain, DNS, TLS

Dominio de ZAKIPHARMA apuntado a Vercel (registro A/CNAME según Vercel); TLS gestionado por Vercel;
redirección apex ↔ www. El agente on-prem solo necesita salida HTTPS hacia `INGEST_URL`.

---

## 13. Testing Strategy

| Layer | Framework | What it covers | Where | Runs |
|---|---|---|---|---|
| Unit | Vitest | Cascada de precios, money, firma del agente — lógica pura, sin DB | `tests/unit/**` | cada commit |
| Integration | Vitest | Ingest, catálogo, carrito, pedidos, auth, admin contra Postgres de prueba | `tests/integration/**` | cada commit |
| E2E | Playwright | Flujo entrar→catálogo→carrito→enviar pedido | `tests/e2e/**` | pre-deploy |

### Critical flows to cover E2E

1. Entrar → ver catálogo con precio propio → agregar al carrito → enviar pedido → cotización creada.
2. Registrar un comprobante de pago → correo despachado → aparece en la cuenta.
3. Admin oculta un producto → desaparece del catálogo del cliente.

### Test data

El Postgres de prueba lo levanta `docker-compose.yml` (§19.6) apuntado por `TEST_DATABASE_URL`. Cada
suite de integración migra y siembra un dataset mínimo y limpia entre corridas; los tests no comparten
estado mutable ni dependen del orden. Los tests unitarios de la cascada no tocan DB.

### What is deliberately not tested

El agente contra el **Profit Plus real** (necesita el SQL Server on-prem) no se prueba en CI; se
valida en la lista de lanzamiento. La entrega real de correo por Resend se prueba una vez en el
lanzamiento, no en cada build (los tests usan un doble del cliente).

---

## 14. Security & Secrets

| Concern | Control | Implemented in |
|---|---|---|
| Secret storage | Variables de entorno de Vercel/Supabase; nunca en el repo | plataforma |
| Secret rotation | `SYNC_SHARED_SECRET` y `BETTER_AUTH_SECRET` rotables; procedimiento en runbook | plataforma |
| Input validation | `zod` en cada route handler y server action | `src/app/**`, `src/lib/**` |
| Output encoding / XSS | Escapado por defecto de React; sin `dangerouslySetInnerHTML` | `src/components/**` |
| SQL injection | Solo consultas parametrizadas de Drizzle/`postgres`; nunca SQL por concatenación | `src/lib/db/**`, `src/agent/profit.ts` |
| AuthN / AuthZ | Better Auth + guard server-side en cada request (§8) | `src/lib/auth.ts` |
| CSRF | Server actions con verificación de origen; `/api/ingest` sin cookies (HMAC) | framework, `src/app/api/ingest/route.ts` |
| Rate limiting / abuse | Límites en ingest, login y activación (§5) | `src/app/api/**` |
| Webhook/ingest verification | Firma HMAC verificada antes de parsear + libro de idempotencia | `src/app/api/ingest/route.ts` |
| Dependency audit | `pnpm audit` en CI | CI |
| Security headers | CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | `next.config.ts` |
| PII handling | Correo/teléfono/RIF de clientes espejados; retención según Profit; no se exponen entre clientes | `src/lib/**` |
| Logging hygiene | `pino` con redacción de secretos y credenciales; nunca se loguea el cuerpo de un comprobante | `src/lib/**`, `src/agent/**` |

**Hard rules**
- Ningún secreto se commitea, se imprime en logs, se manda al tracker de errores ni se embebe en el
  bundle cliente.
- Toda autorización server-side corre antes del trabajo.
- El cuerpo del ingest se verifica por firma antes de parsearse como confiable.

**SQL Server 2019 Enterprise (confirmado, 15.0.2180.2):** el driver moderno `mssql` conecta con TLS
estándar; **no** hace falta el workaround de TLS legacy. Se usa `options.trustServerCertificate=true`
solo si el servidor tiene un certificado autofirmado, y siempre **dentro de la red local** — nunca se
expone el SQL Server a internet. Las funciones modernas de T-SQL (`STRING_SPLIT`, `TRY_CONVERT`,
`OFFSET/FETCH`) están disponibles.

Datos regulados: se manejan datos de contacto y financieros de clientes (cupo, saldo). No hay datos
de salud de pacientes. Se aplica minimización (solo lo necesario para vender) y aislamiento por
cliente (§8).

---

## 15. Accessibility

**Target: WCAG 2.2 Level AA.**

### Baseline requirements

| Requirement | Rule |
|---|---|
| Semantic HTML | Landmarks, un `h1` por página, encabezados en orden, listas para listas |
| Keyboard | Todo interactivo operable por teclado; orden lógico; sin trampas; skip-to-content |
| Focus visible | Indicador de foco ≥3:1 sobre su fondo |
| Contrast | Texto 4.5:1, UI 3:1 — la paleta de §7 ya lo cumple |
| Forms | Cada input con label programático; errores en texto, no solo color; anunciados |
| Images | Fotos de producto con alt; decorativas con `alt=""` |
| Motion | Respeta `prefers-reduced-motion: reduce` |
| Zoom / reflow | Usable a 200% y a 320px sin scroll horizontal |
| Live regions | Cambios async anunciados con `aria-live` |

### WCAG 2.2 additions

| SC | Requirement |
|---|---|
| 2.4.11 Focus Not Obscured | El foco nunca queda oculto tras barras fijas |
| 2.5.7 Dragging Movements | El stepper de cantidad tiene alternativa por botones |
| 2.5.8 Target Size | Objetivos ≥ 24×24 px |
| 3.3.7 Redundant Entry | Datos ya dados no se re-piden en el flujo de pedido |
| 3.3.8 Accessible Authentication | Permite gestores de contraseñas; nunca bloquea pegar el OTP |

### Verification

```bash
pnpm test:e2e tests/e2e/a11y.spec.ts   # axe run — expect: 0 violations
```

Los chequeos automáticos cubren ~un tercio. Antes del lanzamiento: recorrido solo-teclado de los
flujos críticos, una pasada con lector de pantalla del flujo de pedido, y una pasada a 200% en el
breakpoint más angosto.

---

## 16. Observability & Cost

### Instrumentation

| Signal | Tool | What it captures | Who looks at it |
|---|---|---|---|
| Errors | Sentry (o el tracker de Vercel) | Excepciones no manejadas con release y contexto, PII redactada | equipo ZAKIPHARMA |
| Logs | `pino` (JSON) + Vercel logs | Líneas estructuradas con request id; el agente loguea cada ciclo | equipo |
| Metrics | `/api/health` + panel admin | Frescura del espejo, última corrida de sync | admin |
| Uptime | Monitor externo sobre `/api/health` | Disponibilidad del portal | equipo |

### The metrics that matter for this project

| Metric | Target | Alert at |
|---|---|---|
| Frescura del espejo (edad de `max(products.synced_at)`) | ≤ 2 min laboral | > 10 min por 15 min |
| Tasa de error de envío de pedidos | < 1% | > 2× línea base |
| Diferencias de precio portal↔Profit (conciliación) | 0 | ≥ 1 |
| p95 de carga del catálogo | < 1.5 s | > 3 s |

### Health check

`/api/health`: verifica DB alcanzable y la edad de `max(products.synced_at)`; devuelve `ok` fresco o
`degraded` si supera el umbral. Lo consulta el monitor de uptime y el panel admin.

### Cost model

| Service | Free tier | Cost at v1 (~2.000 clientes) | Cost at 10× | Cliff to watch |
|---|---|---|---|---|
| Vercel | Hobby/Pro | Pro ~$20/mo | ~$20–50/mo | funciones/ancho de banda alto |
| Supabase | Free/Pro | Pro ~$25/mo | ~$25–100/mo | tamaño de DB y Storage |
| Resend | 3k correos/mes free | free–$20/mo | ~$20/mo | volumen de correos |
| PC on-prem (agente) | — | costo eléctrico | igual | — |

**Estimated monthly cost at launch: ~$45–65/mo.** El mayor renglón es Supabase Pro; la palanca más
barata para recortar es quedarse en el free tier mientras el volumen lo permita. Ningún servicio
escala superlinealmente al volumen de v1.

---

## 17. Model Routing

NOT APPLICABLE — this project does not call an LLM at runtime.

---

## 18. Skills to Use During Build

Nombres e instalación desde `knowledge/skills-registry.md`. Sin barra = auto-activa (se nombra en
prosa). Nunca se depende en firme de un skill; si falta, el builder cae en la guía del blueprint.

| Skill | Build steps | Why | Install |
|---|---|---|---|
| `ui-ux-pro-max` | 7, 8, 12 | Sistema visual del catálogo/carrito/admin sobre la paleta de §7 | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` |
| `frontend-design` | 7, 8, 10, 12 | UI de tienda en fase de build | `/plugin marketplace add anthropics/frontend-design` |
| `playwright-cli` | 14 | E2E de los flujos críticos | `/plugin marketplace add anthropics/playwright-cli-skill` |

Si alguno no está disponible, el builder usa esta base de conocimiento más `WebSearch`/`WebFetch`, lo
nota en una línea y continúa.

---

## 19. Agent Workspace

Los archivos bajo `workspace/` se copian al raíz del proyecto en la primera acción del builder (copia
guardada, §10). `.claude/commands/` no se emite. Todo lo emitido cumple los gates del propio proyecto
(Biome), y cada config excluye la ruta del bundle (`blueprints/`).

### 19.1 `CLAUDE.md`

Ver `workspace/CLAUDE.md` (bundle). Contenido completo emitido ahí, bajo 200 líneas, comandos primero.

### 19.2 `AGENTS.md`

Ver `workspace/AGENTS.md` (bundle). Stub tool-neutral que apunta a `CLAUDE.md`.

### 19.3 `.claude/settings.json`

Ver `workspace/.claude/settings.json`. Pre-aprueba cada comando de los `Verify` de §9 y del gate de
§20.1; deniega leer `.env`, push y comandos destructivos.

### 19.4 Project skills — `.claude/skills/<name>/SKILL.md`

| Skill | Triggers on | What it automates |
|---|---|---|
| `add-migration` | "nueva migración", "cambié el esquema" | Editar `schema.ts` → `db:generate` → `db:migrate` → verificar |
| `add-mirror-table` | "nueva tabla espejo de Profit" | Añadir tabla espejo + rama de ingest + cursor de sync |

Ver `workspace/.claude/skills/*/SKILL.md`.

### 19.5 `.claude/rules/*.md`

| File | `paths` globs | Covers |
|---|---|---|
| `.claude/rules/db.md` | `src/lib/db/**`, `drizzle/**` | Convenciones de esquema y migraciones |
| `.claude/rules/pricing.md` | `src/lib/pricing/**`, `src/lib/money.ts` | Reglas de la cascada, EXCLUIDOS, dinero con big.js |
| `.claude/rules/agent.md` | `src/agent/**` | Solo lectura de Profit, RTRIM, firma, sin React |

Ver `workspace/.claude/rules/*.md`.

### 19.6 Verify-critical config and local infrastructure

Archivos reales bajo `workspace/`, en la ruta que ocupan en el proyecto.

| File | Path in project | Which `Verify` needs it | Resolution/env handling it carries | Bundle-path exclusion |
|---|---|---|---|---|
| `biome.json` | `biome.json` | pasos 1–13 (`pnpm lint`) | `css.parser.tailwindDirectives: true` para Tailwind v4; sin env | `files.includes` niega `!blueprints/**` |
| `vitest.config.ts` | `vitest.config.ts` | pasos 1–13 (`pnpm test`) | `resolve.alias '@' → ./src`; carga dotenv en setup para `TEST_DATABASE_URL` | `test.exclude` incluye `blueprints/**` |
| `tests/setup.ts` | `tests/setup.ts` | integración | `import 'dotenv/config'` para las herramientas de test | n/a — this file never walks the tree |
| `playwright.config.ts` | `playwright.config.ts` | paso 13 (`pnpm test:e2e`) | `testDir: tests/e2e`; baseURL localhost:3000 | `testDir` acota a `tests/e2e` (excluye el bundle) |
| `drizzle.config.ts` | `drizzle.config.ts` | pasos 2–13 (`db:migrate`/`generate`) | `import 'dotenv/config'` al tope carga `DATABASE_URL` | n/a — reads only `src/lib/db/schema.ts` |
| `docker-compose.yml` | `docker-compose.yml` | pasos 2–13 (Postgres de prueba) | image `postgres:17` con healthcheck; `TEST_DATABASE_URL` en §10 | n/a — this tool never walks the tree |
| `.env.example` | `.env.example` | referencia de §10 | todas las claves, valores vacíos | n/a — data file |

`tsconfig.json` (alias `@/` + flags de resolución) y `biome.json` requieren que Biome excluya
`blueprints/`; la exclusión se escribe literal en `biome.json` emitido. `package.json` lo genera
create-next-app y lo edita §10 (no se emite bajo `workspace/`).

#### Resolution convention matrix

**La convención, una vez:** importar con alias `@/` → `src/`, sin extensión relativa (p. ej.
`@/lib/pricing/price`).

| Context | Command that exercises it | Convention as it appears there | Config + literal setting that makes it work |
|---|---|---|---|
| Application source | `pnpm build` | `@/lib/...` | `tsconfig.json` — `compilerOptions.paths` `"@/*": ["./src/*"]` (create-next-app) |
| Test files | `pnpm test` | `@/lib/...` | `vitest.config.ts` — `resolve.alias { '@': path.resolve(__dirname,'./src') }` |
| Standalone scripts (seed, agente) | `pnpm db:seed`, `pnpm agent:once` | `@/lib/...` | `tsconfig.json` — mismo `paths`; `tsx` resuelve `paths` de tsconfig |
| Build / bundle | `pnpm build` | `@/lib/...` | Next/Turbopack resuelve `paths` de tsconfig |

Los scripts standalone corren con `tsx`, que resuelve los `paths` de `tsconfig.json`; no se usan
extensiones relativas, así que `allowImportingTsExtensions`/`rewriteRelativeImportExtensions` cubren
cualquier import relativo con extensión `.ts` que llegara a introducirse.

#### Cross-artifact value reconciliation

| Shared value | Single source | Literal value | Every other place it appears | Compared |
|---|---|---|---|---|
| Health endpoint path | `src/app/api/health/route.ts` | `/api/health` | §5 rutas · §9 pasos 1,13 · §16 · §20.1 | yes |
| Ingest endpoint path | `src/app/api/ingest/route.ts` | `/api/ingest` | §5 · §9 pasos 3,4 · §10 (`INGEST_URL`) | yes |
| Dev/app port | `docker-compose`/Next | `3000` | §10 Bootstrap · §12 · `playwright.config.ts` (baseURL) | yes |
| Postgres image tag | `docker-compose.yml` | `postgres:17` | §11 (fila) · §19.6 | yes |
| Project/package name | `package.json` | `portal-zaki` | §3 árbol · §10 (create-next-app) · bundle dir | yes |
| Path alias | `tsconfig.json` | `@/* → ./src/*` | `vitest.config.ts` · §3 boundary · §19.6 matriz | yes |
| Módulo raíz de fuente | `tsconfig.json` | `src/` | vitest roots · biome includes · §3 | yes |
| Bundle path (a excluir) | configs emitidos | `blueprints/` | `biome.json` · `vitest.config.ts` | yes |

#### Byte-exact artifact reconciliation

NOT APPLICABLE — this blueprint authors no byte-exact expected output file. Los valores exactos de la
cascada (8919.57, 6440.49, 28581.00, 51091.22) son afirmaciones numéricas de un test sobre una
función pura determinista, no bytes emitidos por el runtime: `big.js` produce esos decimales en
cualquier versión pinada, y el test los compara como strings de `Big.toFixed(2)`, no contra un golden
file. Provienen de facturas reales de Profit del 2026-07-31 (dossier §3.4), no de memoria.

---

## 20. Acceptance Gate, Risks & Decision Log

### 20.1 Global acceptance gate

El proyecto está **listo** cuando cada comando sale 0 en un checkout limpio, y no antes.

```bash
pnpm install --frozen-lockfile   # expect: exit 0
pnpm typecheck                   # expect: exit 0, 0 errors
pnpm lint                        # expect: exit 0, 0 errors, 0 warnings
docker compose up -d db          # expect: exit 0, Postgres healthy
pnpm db:migrate                  # expect: exit 0
pnpm test                        # expect: exit 0, 0 failed, 0 skipped
pnpm build                       # expect: exit 0
pnpm test:e2e                    # expect: exit 0, 0 failed
pnpm test tests/smoke/health.test.ts  # expect: exit 0 — the /api/health handler returns 200
pnpm test:e2e tests/e2e/a11y.spec.ts  # expect: 0 violations
```

Cada expectativa es una propiedad, no un conteo. Cada línea sale 0 en un build correcto. Cada línea
es decidible en su medio.

Manual gates, cada uno chequeado una vez antes del lanzamiento:

- [ ] Cada paso de §9 tiene su tag en git (`git tag -l 'step-*'` lista uno por paso; 14 pasos, 14 tags). El repo lo crea §10, no un scaffolder.
- [ ] Cada archivo de la tabla *Files that must be committed* (§10) existe en un checkout limpio (`git ls-files --error-unmatch <path>` sale 0 por cada uno — un path por invocación).
- [ ] Por cada uno de esos paths, `git check-ignore -q <path>; test $? -eq 1` (1 = no ignorado).
- [ ] El `.gitignore` estaba antes del primer commit: `git log --diff-filter=A --format=%H -- .gitignore` lo muestra en el commit de Bootstrap, no en un paso de §9.
- [ ] §10 Bootstrap re-corrido una vez sobre un árbol ya inicializado **sale 0** y no cambia el manifiesto: `package.json` sigue listando cada dependencia instalada.
- [ ] Cada fila de *Cross-artifact value reconciliation* (§19.6) lee `Compared: yes`, y `lint`/`typecheck` corrieron desde el raíz **con el bundle presente**.
- [ ] §9.1 aplica: cada fila de paridad probada, el kill switch ejercido una vez, y el canal viejo aún disponible y reversible.
- [ ] Cada non-goal de §1 sigue sin construirse.
- [ ] Cada variable de §10 está en producción y ausente del repo.
- [ ] Los flujos e2e críticos de §13 pasan contra la URL de producción.
- [ ] Pasada solo-teclado y una con lector de pantalla del flujo de pedido (§15).
- [ ] El tracker de errores recibe un error de prueba disparado a propósito (§16).
- [ ] Un rollback ejecutado una vez, a propósito, en un entorno preview (§12).
- [ ] Prueba on-prem del agente contra el Profit real: un ciclo `pnpm agent:once` empuja y el espejo refleja el cambio (§13, fuera de CI).

**No se ignora ninguna advertencia.**

### 20.2 Risk register

| Risk | Likelihood | Impact | Early signal | Mitigation |
|---|---|---|---|---|
| Cascada mal replicada → precio firme incorrecto (venta bajo costo) | M | H | Un pedido del piloto con precio distinto al de Profit | Tests al céntimo (paso 5) + período sombra con 0 diffs como gate de corte (§9.1); pendientes `[P]` de cascada bloquean go-live |
| Conexión del agente al SQL Server falla | L | H | El agente no conecta en la Fase 0 | SQL Server 2019 confirmado: TLS estándar del driver `mssql`, sin workaround legacy; error nombrado si falla |
| Combinación de `oferta_cli` con las ofertas por segmento no queda exacta | M | H | Un precio del piloto que no cuadra pese a la cascada base | Confirmar la regla de combinación de `oferta_cli` (pendiente) antes del corte; el período sombra la detecta |
| Segmentación del cliente (`co_seg`) desactualizada en el espejo | L | M | Un cliente EXCLUIDOS recibe descuento de otro segmento | El agente sincroniza `co_seg` por `row_id`; test de segmento en el paso 5 |
| Clientes sin correo (22,5%) no pueden auto-activarse | H | L | Clientes que no logran entrar | Activación manual por admin (paso 12); depurar contactos en Profit |
| Frescura del espejo cae si la PC del agente se apaga | M | M | `synced_at` envejece; `/api/health` degradado | Alerta de frescura (§16); Programador de tareas con reinicio; agente idempotente |
| Deliverabilidad de correo (Resend) requiere dominio verificado | L | M | Correos que no llegan | Verificar dominio antes del lanzamiento; alternativa SMTP propio (§20.3) |

### 20.3 Decision log

| # | Decision | Rejected alternative | Why | Would reverse if |
|---|---|---|---|---|
| 1 | Runtime TS/Next.js | Python/Rails/Go | Un lenguaje para portal, agente y tests; la UI es el producto | El equipo estandarizara en otro stack ya en producción |
| 2 | Sync unidireccional (solo lectura de Profit) + salida por correo | Escritura directa de pedidos en Profit | El ERP es fuente de verdad y debe quedar intacto; calca el flujo actual | Profit exponga import soportado por el proveedor |
| 3 | Precio firme calculado en el portal | Precio referencial confirmado por Profit | El usuario pidió firme desde el día 1 | Aparezca un mecanismo de descuento no replicable de forma confiable |
| 4 | `numeric` + big.js para dinero | Entero en unidades mínimas | Profit usa precios unitarios de 5 decimales y cascada multiplicativa; el entero perdería precisión | El negocio pasara a precios de 2 decimales sin cascada |
| 5 | Better Auth (usuarios en nuestra DB) | Clerk / Supabase Auth | ~2.000 clientes sin costo por MAU y FK al espejo de clientes | Se exija SSO empresarial o el mantenimiento del auth propio pesara más que su costo |
| 6 | Postgres/Supabase + Drizzle | Prisma / otra DB | SQL a la vista para auditar la cascada; Storage y DB en un servicio | Se necesitara un GUI/DX de Prisma por encima del control de query |
| 7 | Resend para correo | nodemailer + SMTP propio | API de primera clase, cero servidor SMTP | ZAKIPHARMA prefiera enrutar por su propio servidor de correo |
| 8 | Agente on-prem que empuja | Conexión directa nube→SQL Server | El SQL Server está en IP privada; nunca se expone a internet | Profit se moviera a un host con acceso seguro desde la nube |
| 9 | Escalas de volumen y `oferta_cli` fuera de v1 | Incluirlas ya | El dossier no las verificó; incluirlas a ciegas arriesga precio incorrecto | La Fase 0 confirme su contenido y rol |

### 20.4 What to build next

1. **Escalas de descuento por volumen (posición 2, `descuen`)** — cuando la Fase 0 confirme su
   contenido; habilita "agrega N y bajas de escalón".
2. **Ofertas por cliente (`oferta_cli`)** — cuando la Fase 0 resuelva su rol en la cascada.
3. **Lotes y fechas de vencimiento** — cuando las farmacias pidan ver vencimientos.
4. **Pasarela de pago en línea** — si un segmento exige pagar con tarjeta/PSE.
5. **Export nativo de pedidos a Profit** — cuando exista un formato de importación soportado, para
   eliminar el paso manual del operador.

---

*End of blueprint. Build order is §9. Stop when §20.1 is green.*
