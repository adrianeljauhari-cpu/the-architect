# Runtime Track: TypeScript / Node.js

> The default track. Choose it unless the project has a concrete reason to leave the JS ecosystem.

**Last verified: 2026-07-27** — every version below was checked against the npm registry
(`https://registry.npmjs.org/-/package/<name>/dist-tags`) and, where noted, against the vendor's own
docs on this date. When refreshing this file, re-verify and update this line.

## When to choose this track

- **One language across the whole stack.** Server, client, build scripts, and tests share types.
  For a small team this is the single biggest velocity multiplier available.
- **The UI is the product.** Anything with a real frontend starts here. React's ecosystem depth is
  not close to matched elsewhere.
- **You want to deploy in minutes, not days.** Vercel, Cloudflare, Netlify, Fly, and Railway all
  treat Node as a first-class target with zero-config adapters.
- **AI/LLM work.** The Vercel AI SDK and the Anthropic SDK are both first-class here, and streaming
  UI is a solved problem.

Leave this track when: you need heavy numeric/ML work in-process (`python.md`), you need a single
static binary or sub-10ms cold starts at high concurrency (`go.md`), you want batteries-included
server-rendered CRUD with a mature admin (`rails-laravel.md`), or you are shipping to App Store /
Play Store (`mobile-native.md`).

## Pinned versions

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | **24.18.0** (LTS "Krypton") | Active LTS. 22.23.1 "Jod" for maintenance-only projects; 26.5.0 is Current, not LTS — do not ship on it. |
| Package manager | pnpm | **11.17.0** | Strict node_modules catches phantom dependencies. Workspaces for monorepos. |
| Language | TypeScript | **6.0.3** (default) / **7.0.2** (opt-in) | 7.0 is the Go-native rewrite, GA 2026-07-08, 8–12x faster. It has no stable JS compiler API yet — see Gotchas. Pin `~6.0.3` explicitly. |
| React framework | Next.js | **16.2.12** | App Router. Turbopack default. React peer range: `^18.2.0 \|\| 19.0.0-rc-de68d2f4-20241204 \|\| ^19.0.0`. Requires Node `>=20.9.0`. |
| UI library | React / React DOM | **19.2.8** | |
| React types | `@types/react` / `@types/react-dom` | **19.2.17** / **19.2.3** | |
| Content/static framework | Astro | **7.1.4** | Marketing, docs, blogs. Requires Node `>=22.12.0`. Strict HTML validation — see Gotchas. |
| SPA / non-Next bundler | Vite | **8.1.5** | Requires Node `^20.19.0 \|\| >=22.12.0`. |
| Vite React plugin | `@vitejs/plugin-react` | **6.0.4** | Exports `reactCompilerPreset`. `@vitejs/plugin-react-oxc` 0.4.3 for the oxc pipeline. |
| React Compiler | `babel-plugin-react-compiler` | **1.0.0** | Optional. Next enables it via `babel-plugin-react-compiler` as an optional peer. |
| Typed router / full-stack SPA | `@tanstack/react-router` / `@tanstack/react-start` | **1.170.18** / **1.168.32** | Both on the 1.x line. Start is the full-stack option when you want Vite instead of Next. |
| Styling | Tailwind CSS | **4.3.3** | Plus `@tailwindcss/vite` **4.3.3** or `@tailwindcss/postcss` **4.3.3**. CSS-first config — see Gotchas. |
| Component source | `shadcn` CLI | **4.16.0** | Copies components into your repo. Not a dependency. |
| ORM (default) | `drizzle-orm` / `drizzle-kit` | **0.45.2** / **0.31.10** | The stable line is 0.x. v1 is at `1.0.0-rc.4` — see Gotchas. |
| ORM (alternative) | `prisma` | **7.9.1** | Pick when you want a generated client and a GUI (Studio) over SQL-shaped queries. |
| Postgres drivers | `postgres` / `pg` / `@neondatabase/serverless` | **3.4.9** / **8.22.0** / **1.1.0** | Use the Neon driver only on Neon over HTTP/WS. |
| Server data | `@tanstack/react-query` | **5.101.4** | Devtools: `@tanstack/react-query-devtools` **5.101.4**. |
| Validation | `zod` | **4.4.3** | v4 is the current major. Schema-first everywhere: env, forms, API boundaries. |
| Forms | `react-hook-form` | **7.83.0** | 8.x is still beta. |
| Standalone HTTP server | `hono` | **4.12.32** | Plus `@hono/node-server` **2.0.12**, `@hono/zod-validator` **0.9.0**. Runs on Node, Bun, Workers, Deno. |
| Auth (self-hosted) | `better-auth` | **1.6.25** | 1.7.0 is at rc.2 — stay on 1.6.x. |
| Auth (hosted) | `@clerk/nextjs` | **7.6.2** | |
| BaaS | `@supabase/supabase-js` | **2.110.9** | |
| Payments | `stripe` | **22.3.2** | |
| AI SDK | `ai` / `@ai-sdk/react` | **7.0.38** / **4.0.41** | The `ai` core and the React binding version independently — do not assume matching majors. |
| Anthropic SDK | `@anthropic-ai/sdk` | **0.115.0** | Never hand-write model IDs — invoke the bundled `claude-api` skill. |
| Lint + format | `@biomejs/biome` | **2.5.5** | One tool, one config, Rust-fast. Replaces ESLint + Prettier. ESLint 10.8.0 only if a required plugin has no Biome equivalent. |
| Unit tests | `vitest` | **4.1.10** | Requires Node `^20 \|\| ^22 \|\| >=24`. |
| E2E tests | `@playwright/test` | **1.62.0** | |
| Monorepo | `turbo` | **2.10.7** | Only when you actually have 2+ deployable apps. |
| Node TS runner | `tsx` | **4.23.1** | For scripts and seeds. Node's own type stripping covers most cases on 24.x. |
| Cloudflare CLI | `wrangler` | **4.114.0** | |

## Setup

```bash
# Pin the toolchain first — this is what makes a build reproducible.
corepack enable && corepack prepare pnpm@11.17.0 --activate
node -v   # expect v24.x

# --- Full-stack app (default) ---
pnpm create next-app@latest my-app --ts --app --tailwind --eslint=false --src-dir --use-pnpm
cd my-app
pnpm add -D typescript@~6.0.3 @biomejs/biome@2.5.5 vitest@4 @playwright/test@1
pnpm add zod@4 @tanstack/react-query@5 drizzle-orm@0.45.2
pnpm add -D drizzle-kit@0.31.10
pnpm dlx @biomejs/biome@2.5.5 init
pnpm dlx shadcn@4 init

# --- Content / marketing site ---
pnpm create astro@latest my-site -- --template minimal --typescript strict
cd my-site && pnpm add -D typescript@~6.0.3   # Astro tooling requires the 6.x line
pnpm astro add tailwind sitemap

# --- Standalone API (no UI) ---
pnpm create hono@latest my-api
cd my-api && pnpm add zod@4 drizzle-orm@0.45.2 && pnpm add -D drizzle-kit@0.31.10 tsx@4

# --- SPA / non-Next React ---
pnpm create vite@latest my-spa -- --template react-ts
cd my-spa && pnpm add -D @tailwindcss/vite@4.3.3
```

## Conventions

```
src/
  app/                  # Next.js App Router: routes, layouts, route handlers
    (marketing)/        # route groups for layout boundaries, not URL segments
    api/
  components/
    ui/                 # shadcn primitives — generated, edit freely, do not abstract early
    <feature>/          # feature-owned components
  lib/
    db/
      schema.ts         # Drizzle schema — the single source of truth for table shapes
      index.ts          # the exported db client
    auth.ts
    env.ts              # zod-parsed process.env, imported everywhere instead of process.env
  server/
    <feature>/          # server-only business logic; never imported from a "use client" file
proxy.ts                # NOT middleware.ts — see Gotchas
drizzle/                # generated SQL migrations, committed
```

- **Server-first.** A component is a Server Component until it needs state or an event handler.
  `"use client"` goes on the smallest leaf that needs it, never on a layout.
- **Validate at every boundary.** `zod` schema for env, for each route handler body, for each form.
  Infer types from the schema (`z.infer`), never declare them twice.
- **300 lines is the component ceiling.** Past that, split by responsibility, not by line count.
- **No barrel files** (`index.ts` re-export hubs). They defeat tree-shaking and slow down every
  bundler and type-checker in this table.
- **`type` over `interface`** unless you need declaration merging. Consistency beats theology.
- **ESM only.** `"type": "module"` in `package.json` for anything that is not a Next.js app.

## Testing / Lint / Build commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Type check | `pnpm exec tsc --noEmit` |
| Lint | `pnpm exec biome check .` |
| Lint + autofix | `pnpm exec biome check --write .` |
| Unit tests | `pnpm exec vitest run` |
| Unit tests (watch) | `pnpm exec vitest` |
| Coverage | `pnpm exec vitest run --coverage` |
| E2E tests | `pnpm exec playwright test` |
| Install E2E browsers | `pnpm exec playwright install --with-deps` |
| Production build | `pnpm build` |
| Build with webpack (fallback) | `pnpm exec next build --webpack` |
| Generate migration | `pnpm exec drizzle-kit generate` |
| Apply migration | `pnpm exec drizzle-kit migrate` |
| Inspect DB | `pnpm exec drizzle-kit studio` |
| Full CI gate | `pnpm exec biome ci . && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm build` |

## Deployment notes

- **Next.js → Vercel.** Zero-config, and every feature in the table above ships there first. Self-host
  with `output: "standalone"` + a Node 24 slim image when you must.
- **Astro → Cloudflare Pages or Netlify.** Static output by default; add an adapter only when you
  actually need SSR.
- **Hono → Cloudflare Workers** (`wrangler deploy`) or a Node container. Hono's portability is the
  reason to pick it; do not import Node built-ins in shared handler code or you lose it.
- **Database.** Neon or Supabase for serverless Postgres; both give branch-per-PR databases, which
  is worth more than any performance difference at this stage.
- **Pin the runtime in CI.** `.nvmrc` with `24` and `packageManager: "pnpm@11.17.0"` in
  `package.json`. Unpinned CI is the most common source of "works on my machine".
- Run migrations as an explicit deploy step, never on app boot. Concurrent instances will race.

## Gotchas

- **`middleware.ts` is gone — the file is now `proxy.ts`.** Renamed and deprecated in Next.js 16.0.0.
  The exported function is `proxy`, not `middleware`. Migrate with
  `npx @next/codemod@canary middleware-to-proxy .`. Proxy now defaults to the **Node.js runtime**, and
  setting the `runtime` route-segment config inside a proxy file throws.
  Related trap: Server Functions are POSTs to the route that uses them, so a matcher that excludes a
  path silently skips auth for its Server Functions. Authorize inside each Server Function.
- **`experimental.ppr` and `experimental.dynamicIO` no longer exist.** Next.js 16.0.0 folded `ppr`,
  `useCache`, and `dynamicIO` into a single top-level `cacheComponents: true` flag, paired with the
  `"use cache"` directive. `experimental_ppr` as a route-segment export was removed outright. Under
  `cacheComponents`, PPR is the default App Router behavior and navigation preserves state via React
  `<Activity>` — components stay mounted instead of unmounting.
- **Turbopack is the default for `next dev` AND `next build`** as of 16.0.0. Consequences: `webpack()`
  config in `next.config.js` is ignored, webpack *plugins* are unsupported (loaders are), Yarn PnP is
  unsupported, and `sassOptions.functions` does not work. Opt out per-command with `--webpack`.
  On platforms with no native bindings (FreeBSD, OpenBSD) `--webpack` is mandatory.
- **Drizzle v1 is a release candidate. Never pin `^1`.** The npm `latest` tag is `drizzle-orm@0.45.2`;
  `1.0.0-rc.4` sits behind the `rc` tag with dozens of ad-hoc prerelease tags around it. Pin the exact
  0.x pair (`drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`) — a caret on a 0.x package still moves the
  minor, and Drizzle ships breaking changes in minors.
- **Tailwind v4 is configured in CSS, not JavaScript.** `@import "tailwindcss";` then `@theme { ... }`
  in your global stylesheet. If you see a `tailwind.config.js` in a v4 project it is a v3 leftover
  being ignored — delete it and port the tokens into `@theme`. Wire it with `@tailwindcss/vite` (Vite)
  or `@tailwindcss/postcss` (Next/PostCSS), never the old `tailwindcss` PostCSS plugin entry.
- **TypeScript 7 is GA but will break framework tooling.** `pnpm add -D typescript` installs **7.0.2**,
  the Go-native rewrite. It has no stable programmatic compiler API, so Vue, Svelte, Astro, MDX, and
  Angular template tooling must stay on the **6.0.x** line — Microsoft says so explicitly in the 7.0
  announcement. It also drops the `tsserver` binary (`bin` is `tsc` only), removes ES5/AMD/UMD targets,
  and defaults `strict: true` and `types: []`. **Next.js additionally refuses TS 7 unless you set
  `experimental.useTypeScriptCli: true`** — `next build` exits with instructions otherwise. Default to
  `typescript@~6.0.3` for the whole track; adopt 7 deliberately, per-project, for the 8–12x speedup.
- **Do not claim Next.js requires a specific React minor.** Its actual peer range is
  `"react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0"`. React 18 apps upgrade to Next 16
  without touching React.
- **The React Compiler Vite export is `reactCompilerPreset`, not a "plugin".** From
  `@vitejs/plugin-react` 6.x: `import react, { reactCompilerPreset } from '@vitejs/plugin-react'`, then
  `plugins: [react(), babel({ presets: [reactCompilerPreset()] })]`. It needs `@rolldown/plugin-babel`,
  `@babel/core`, and `babel-plugin-react-compiler` as peers. There is no
  `preconfiguredReactCompilerPlugin` export in any current version — the README uses the word
  "preconfigured" only to describe the preset's default file filter.
- **Astro 7 has a Rust compiler that no longer forgives bad markup.** Unclosed non-void tags are now
  errors, and semantically invalid HTML is passed through as-is instead of being silently reordered.
  Expect a v6 → v7 migration to surface markup bugs that were previously invisible. It also requires
  Node `>=22.12.0`.
- **TanStack Start is on the 1.x line** (currently 1.168.32) and moves fast. Pin the exact version and
  upgrade deliberately; do not describe any single release as the long-awaited stable milestone.
- **The AI SDK's core and React packages are on different majors** (`ai` 7.x, `@ai-sdk/react` 4.x).
  Upgrading one without checking the other's peer range is a routine, avoidable break.

## Shapes that use this track

Default track:

- `knowledge/shapes/saas-webapp.md`
- `knowledge/shapes/marketing-site.md`
- `knowledge/shapes/internal-tool.md`
- `knowledge/shapes/content-community-platform.md`
- `knowledge/shapes/ecommerce-storefront.md`
- `knowledge/shapes/agent-app.md`
- `knowledge/shapes/generative-media-app.md`
- `knowledge/shapes/automation-bot-integration.md`
- `knowledge/shapes/cli-library-mcp.md`
- `knowledge/shapes/browser-extension.md`
- `knowledge/shapes/desktop-app.md`
- `knowledge/shapes/api-backend.md`

Not the default, but commonly paired with it:

- `knowledge/shapes/mobile-app.md` — the app itself uses `knowledge/runtime-tracks/mobile-native.md`;
  its backend and web dashboard land here.
- `knowledge/shapes/data-pipeline-analytics.md` — pipelines default to
  `knowledge/runtime-tracks/python.md`; the dashboard on top of them lands here.

## See also

- `knowledge/stack-compatibility.md` — combinations from this table that are known to conflict
- `knowledge/capabilities/frontend-architecture.md` — server vs client component boundaries
- `knowledge/capabilities/database.md` — choosing between Drizzle and Prisma for a given shape
- `knowledge/capabilities/testing.md` — what to cover with Vitest vs Playwright
- `knowledge/runtime-tracks/python.md` — when the workload is ML/numeric rather than product UI
- `knowledge/runtime-tracks/go.md` — when you need a single binary or extreme concurrency
