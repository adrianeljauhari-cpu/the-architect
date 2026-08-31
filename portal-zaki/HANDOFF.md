# PORTAL-ZAKI — Traspaso al equipo de IT

> Paquete de entrega generado el 2026-08-31 desde el repositorio de trabajo original.
> Contiene la aplicación completa, su historial de git (23 commits) y el blueprint que la originó.

---

## 1. Qué es esto

**PORTAL-ZAKI** es el portal de venta mayorista B2B de la droguería **ZAKIPHARMA**. Las farmacias
clientes entran con su cuenta, ven el catálogo (~9.178 productos) con **su** precio y la existencia
real, arman un pedido que sale como **cotización por correo**, y registran sus **comprobantes de
pago**.

La regla que gobierna todo el diseño:

> El dato maestro —producto, precio, existencia, cliente, descuento, tasa— **vive en Profit Plus 2K8
> y nunca en el portal**. El portal es un **espejo de solo lectura** más un carrito.
> **El portal jamás escribe en el ERP.**

Un **agente de sincronización on-prem** corre dentro de la red de ZAKIPHARMA, lee Profit por
`row_id` incremental en modo solo lectura, y hace POST firmado con HMAC a `/api/ingest`. El SQL
Server nunca se expone a internet.

---

## 2. Estado real del proyecto

**Las 14 tareas del blueprint están implementadas.** Hay un commit por tarea, en orden:

| Épica | Tareas | Qué entregó |
|---|---|---|
| 01-cimientos | E1-T1 … E1-T6 | Scaffold + gate CI, esquema espejo + migración + seed, API de ingesta firmada e idempotente, agente on-prem de Profit, motor de cascada de precios, auth con OTP contra el espejo |
| 02-tienda | E2-T1 … E2-T8 | Catálogo PLP/PDP con precio por cliente, carrito autoritativo en servidor con anti-sobreventa, envío de cotización con precio congelado + correo, captura de comprobantes, cuenta (cupo, saldo, historial), panel admin, observabilidad + conciliación + health, E2E + a11y + CI + deploy |

⚠️ **`../blueprints/portal-zaki/tasks.json` dice `"status": "pending"` en las 14 tareas — está desactualizado.** El
constructor nunca actualizó ese archivo. Guíense por el historial de git (`git log --oneline`), no
por ese campo.

**Lo que está fuera de alcance por decisión explícita** (blueprint §1, "Non-Goals") — no lo
implementen aunque parezca un añadido pequeño: pasarela de pago en línea, escritura de pedidos
directa en Profit, escalas de descuento por volumen (`descuen` está vacía), lotes y vencimientos,
búsqueda por código de barras, app móvil nativa, marketplace multi-vendedor.

---

## 3. Arranque local (10 minutos)

Requisitos: **Node ≥ 24**, **pnpm 11.20.0**, **Docker** (para el Postgres local).

```bash
pnpm install --frozen-lockfile
cp .env.example .env          # rellenar — ver §5
pnpm db:up                    # Postgres 17 en localhost:5432
pnpm db:migrate
pnpm db:seed                  # dataset de demo del dossier; idempotente
pnpm dev                      # http://localhost:3000
```

**El gate del proyecto** — tiene que pasar antes de dar por terminado cualquier cambio:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

| Tarea | Comando |
|---|---|
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Typecheck · Lint · Format | `pnpm typecheck` · `pnpm lint` · `pnpm format` |
| Tests unit + integración | `pnpm test` — un archivo: `pnpm test <ruta>` |
| E2E (Playwright) | `pnpm test:e2e` |
| Postgres local arriba / abajo | `pnpm db:up` · `pnpm db:down` |
| Migración generar / aplicar | `pnpm db:generate` · `pnpm db:migrate` |
| Seed / Drizzle Studio | `pnpm db:seed` · `pnpm db:studio` |
| Agente de sync (on-prem) | `pnpm agent:once` (una pasada) · `pnpm agent:sync` (bucle 60 s) |

Para correr solo los tests de integración hace falta el Postgres local arriba (`pnpm db:up`):
apuntan a `TEST_DATABASE_URL`.

---

## 4. Cómo trabajar este repo con Claude Code

Este proyecto fue diseñado y construido con Claude Code, y viene preparado para que lo sigan
trabajando igual. Abran Claude Code **en la raíz de este repositorio** y carga solo:

| Archivo | Qué aporta |
|---|---|
| `CLAUDE.md` | Comandos, stack, arquitectura y la **tabla de fronteras entre capas**. Se carga en cada sesión. |
| `AGENTS.md` | Convenciones de código para agentes. |
| `.claude/rules/pricing.md` | Reglas del motor de precios — se activa al tocar `src/lib/pricing/**` y `src/lib/money.ts`. |
| `.claude/rules/db.md` | Esquema, tablas espejo y migraciones — al tocar `src/lib/db/**` y `drizzle/**`. |
| `.claude/rules/agent.md` | Convenciones del agente on-prem — al tocar `src/agent/**`. |
| `.claude/skills/add-migration/` | Skill: generar y aplicar una migración Drizzle verificada. |
| `.claude/skills/add-mirror-table/` | Skill: añadir una tabla espejo nueva de Profit (esquema + rama de ingesta + cursor). |
| `.claude/settings.json` | Permisos preaprobados (`pnpm test`, `db:migrate`, …). Deniega leer `.env` y `git push`. |
| `../blueprints/portal-zaki/blueprint.md` | Las 1.841 líneas de especificación: por qué está construido así. **Léanlo antes de cambiar el motor de precios o la ingesta.** |
| `../blueprints/portal-zaki/epics/`, `../blueprints/portal-zaki/tasks.json` | Plan de construcción con criterios de aceptación y comandos de verificación por tarea. |

> **Nota:** el directorio `.claude/` venía dentro del bundle del blueprint
> (`blueprints/portal-zaki/workspace/.claude/`), donde Claude Code nunca lo carga, así que sus
> reglas y skills **no estaban activas**. Se instalaron en `portal-zaki/.claude/`, que es donde se
> leen. El bundle conserva su copia como artefacto histórico.

**La regla de arquitectura que más rompe builds** (`CLAUDE.md`, "Boundaries"):

| Capa | Puede importar de | Nunca debe |
|---|---|---|
| `src/app/**` | `components`, `lib/catalog\|cart\|orders\|ingest`, `lib` | Importar `lib/db/` directo |
| `src/components/**` | `lib`, otros componentes | Importar `lib/db/` o `agent/` |
| `src/lib/pricing/**` | `lib/money`, `lib/db` (tipos) | Importar React o componentes |
| `src/agent/**` | `lib/db/schema`, `lib/env`, `lib/money` | Importar React o `components/` |
| `src/lib/db/**` | nada interno | Importar `lib/catalog\|orders\|…` |

Las mutaciones (carrito, pedido, comprobante) son **server actions**, nunca un `fetch` desde el
cliente.

---

## 5. Variables de entorno — quién provee cada una

Plantilla completa en `.env.example`. `src/lib/env.ts` valida con Zod y **falla al arrancar** si
falta una obligatoria; las de correo, almacenamiento y Profit se validan de forma perezosa, solo
cuando se usan.

| Variable | Qué es | De dónde sale |
|---|---|---|
| `DATABASE_URL` | Postgres de la app | Local: `postgres://portal:portal@localhost:5432/portal`. Prod: **Supabase** (connection string del proyecto) |
| `TEST_DATABASE_URL` | BD de los tests de integración | La misma local. **Nunca apuntarla a producción** |
| `SYNC_SHARED_SECRET` | HMAC entre el agente on-prem y `/api/ingest` | Generar: `openssl rand -hex 32`. **El mismo valor** en Vercel y en el host del agente |
| `INGEST_URL` | A dónde postea el agente | Prod: `https://<dominio>/api/ingest` |
| `BETTER_AUTH_SECRET` | Firma de sesiones | Generar: `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Origen público para cookies/callbacks | El dominio real en producción |
| `PROFIT_SQL_HOST` / `_USER` / `_PASSWORD` / `_DATABASE` | SQL Server de Profit Plus, **usuario solo lectura** | Administración de ZAKIPHARMA. **Solo en el host del agente on-prem, jamás en Vercel** |
| `RESEND_API_KEY` | Correo transaccional | Cuenta de Resend de ZAKIPHARMA |
| `ORDER_NOTIFY_EMAIL` | Buzón que recibe las cotizaciones | Operaciones / teleoperadores |
| `PROOF_NOTIFY_EMAIL` | Buzón que recibe los comprobantes | Cartera / cobranzas |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Storage de fotos de producto y comprobantes | Proyecto Supabase. La service key es **secreta**, solo servidor |

`.env` está en `.gitignore` y `.claude/settings.json` deniega leerlo. **Que siga así.**

---

## 6. Accesos que IT necesita conseguir

| # | Acceso | Para qué | Detalle |
|---|---|---|---|
| 1 | **Usuario solo lectura en el SQL Server de Profit Plus** | Que el agente lea el ERP | Debe poder hacer `SELECT` sobre `art`, `clientes`, `oferta`, `oferta_cli`, y leer `row_id` (rowversion). Sin permisos de escritura, por diseño |
| 2 | **Un host Windows dentro de la red de ZAKIPHARMA** | Correr el agente de sync | Node ≥ 24 + pnpm. El **Task Scheduler** ejecuta `pnpm agent:once` periódicamente (o `pnpm agent:sync` como servicio, bucle de 60 s). Necesita salida HTTPS al portal, **no** entrada desde internet |
| 3 | **Proyecto Supabase** | Postgres de producción + Storage | Un bucket para fotos de producto y otro para comprobantes de pago |
| 4 | **Cuenta Resend con dominio verificado** | Cotizaciones, comprobantes y OTP de activación | Sin dominio verificado los correos caen en spam y el login por OTP no funciona |
| 5 | **Proyecto Vercel** conectado a este repo | Hosting del portal | Región `iad1`. Deploy automático desde `main` |
| 6 | **Repositorio GitHub** | Código y CI | El workflow `.github/workflows/ci.yml` levanta Postgres 17 y corre typecheck, lint, migrate, seed, tests, build y E2E |

---

## 7. Antes de salir a producción — revisar sí o sí

Cuatro cosas que quedaron del período de demo y **no deben llegar al lanzamiento real**:

1. **Eliminar `src/app/api/demo/route.ts`.** Su propio comentario dice `TEMPORARY demo access —
   REMOVE before real launch`. Da acceso de lectura al catálogo saltándose el OTP mediante
   `/api/demo?key=<SYNC_SHARED_SECRET>`. **Riesgo agravado:** está protegida con el *mismo* secreto
   del HMAC de ingesta, así que si ese enlace de demo se filtró alguna vez (chat, correo, historial
   del navegador), el secreto de ingesta se filtró con él. Al eliminar la ruta, **rotar
   `SYNC_SHARED_SECRET`** en Vercel y en el host del agente a la vez.

2. **Quitar `pnpm db:seed` del `buildCommand` en `vercel.json`.** Hoy dice
   `pnpm db:migrate && pnpm db:seed && pnpm build`, así que **cada deploy inserta el dataset de demo
   del dossier en la base de producción** (productos y clientes de prueba). El seed es idempotente
   —`onConflictDoNothing`, no pisa datos reales— pero esos registros de demo no deberían existir en
   producción. Se puso ahí para el primer deploy; ya cumplió. Evalúen también sacar `db:migrate` del
   build y correr las migraciones como paso deliberado.

3. **Confirmar `NODE_ENV=production` en Vercel.** De eso depende que
   `src/app/api/dev/last-otp/route.ts` devuelva 404. Esa ruta expone el OTP de activación en
   memoria para que corra el E2E; en producción debe estar muerta.

4. **Los secretos de `ci.yml` son literales de prueba** (`ci-sync-secret-0123…`,
   `ci-auth-secret-0123…`). Están bien para CI contra un Postgres efímero, pero que nadie los
   reutilice en ningún entorno real.

Además, antes del corte total el blueprint (§9.1) pide un **período sombra**: correr el portal en
paralelo con el flujo actual y conciliar precios contra Profit hasta llegar a **0 diferencias**. La
métrica de éxito es paridad exacta de precio portal↔Profit.

---

## 8. Mapa del repositorio

```
.
├── CLAUDE.md                  Contexto que Claude Code carga en cada sesión
├── AGENTS.md                  Convenciones de código
├── .claude/                   Reglas por ruta, skills y permisos
└── (blueprint en ../blueprints/portal-zaki/)   Especificación completa + plan de construcción
│   ├── blueprint.md           1.841 líneas: el porqué de cada decisión
│   ├── tasks.json             14 tareas con criterios de aceptación (statuses desactualizados)
│   ├── epics/                 01-cimientos, 02-tienda
│   └── workspace/             Andamiaje original del blueprint (referencia histórica)
├── src/
│   ├── app/                   Rutas Next.js: (shop) (auth) (admin) api
│   ├── components/            UI: auth, shop
│   ├── lib/
│   │   ├── pricing/           ⚠️ Cascada de descuentos — la pieza más delicada
│   │   ├── db/                Esquema Drizzle, seed, cliente
│   │   ├── ingest/            Upsert al espejo desde el agente
│   │   ├── cart|orders|payments|admin|catalog/   server actions + queries
│   │   ├── env.ts             Validación Zod de entorno (falla rápido)
│   │   └── money.ts           Aritmética con big.js — nunca float
│   └── agent/                 Agente on-prem: sync, profit (lectura), push (HMAC)
├── drizzle/                   Migraciones SQL + snapshots
├── tests/                     unit · integration · e2e · smoke
└── .github/workflows/ci.yml   El gate completo
```

**La cascada de precios es multiplicativa, no aditiva:**
`neto_unit = prec_vta1 × (1-p1)(1-p2)(1-p3)(1-p4)`. Es decir, `0+6+17+12` **no** es 35 %.
La posición 2 la alimenta `oferta_cli` (por tipo/grupo de cliente), **no** `descuen` —esa tabla está
vacía y se confirmó con ZAKIPHARMA. Todo el dinero se calcula con `big.js`; nunca con `number`.
Si tocan algo aquí, lean `../blueprints/portal-zaki/blueprint.md` y `.claude/rules/pricing.md` primero, y corran
`pnpm test tests/unit/pricing.test.ts`.

---

## 9. Historial

Los 23 commits originales están preservados con sus fechas y autores. `git log --oneline` muestra
la construcción completa: el bundle del blueprint (2026-08-04), las confirmaciones de datos de la
Fase 0 con ZAKIPHARMA, y luego una tarea por commit desde `E1-T1` hasta `E2-T8`.
