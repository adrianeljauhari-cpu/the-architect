# Shape: CLI / Library / MCP Server

> Software whose consumer is a developer or an agent, not an end user — a command-line tool, a published package or SDK, or an MCP server. The deliverable is an API surface plus a distribution channel.

Last verified: 2026-07-27

## Is this your project?

**Yes if:**
- The user says "a CLI", "a command", "a tool for my team's terminal", "scriptable".
- They want to publish a package other people install and `import` — an SDK, a client wrapper, a lint rule set.
- They want to expose their system's actions to Claude or another agent host — that is an MCP server.
- Success is measured in installs, adoption, and "it didn't break my build" — not sessions or conversions.
- There is no UI in scope beyond `--help` and a README.

**No if:**
- Humans log in and click things — `knowledge/shapes/saas-webapp.md`.
- It is a hosted HTTP service backing your own frontend or partners — `knowledge/shapes/api-backend.md`.
- The point is glue between SaaS products on a schedule or a webhook — `knowledge/shapes/automation-bot-integration.md`.
- It has a window, a tray icon, or filesystem-wide UI — `knowledge/shapes/desktop-app.md`.
- End users chat with it as a product — `knowledge/shapes/agent-app.md`.
- The consumer is a person browsing the web and the tool augments the pages they are already on — `knowledge/shapes/browser-extension.md` (installed from a store by end users, not from a registry by developers).

## Default runtime track

**Go** — see `knowledge/runtime-tracks/go.md`. A CLI's job is to start fast and install in one step; a single static binary with no runtime prerequisite beats every alternative for adoption.

Alternatives:
- `knowledge/runtime-tracks/ts-node.md` — the deliverable is an npm package or SDK, or an MCP server whose users already live in the JS ecosystem and expect `npx`.
- `knowledge/runtime-tracks/python.md` — the tool operates on data, notebooks, or ML pipelines, or its users install with `pipx`/`uvx`.

Pick the track by where the *consumer* already is. A Python data team will not install a Go binary to get a dataframe helper.

## Core capabilities

| Capability | Why this shape needs it | File |
|---|---|---|
| API design | The public surface *is* the product; naming and versioning are the architecture | `knowledge/capabilities/api-design.md` |
| Testing | Contract tests + a cross-version matrix are the only defense against silent breakage | `knowledge/capabilities/testing.md` |
| Deployment | Here it means release automation, artifact signing, and registry publication | `knowledge/capabilities/deployment.md` |
| Observability | Opt-in telemetry, structured diagnostics on stderr, crash reports with no PII | `knowledge/capabilities/observability.md` |
| Auth | Only when the tool talks to an authenticated API or the MCP server fronts a user's account | `knowledge/capabilities/auth.md` |
| AI / LLM integration | Only when the tool itself calls a model — MCP servers usually do not | `knowledge/capabilities/ai-llm-integration.md` |

## Data model

Most projects in this shape have **no database**. State lives in files and process memory. Model these concepts anyway — they become your types.

| Entity | Holds | Notes |
|---|---|---|
| Command / Tool | name, description, input schema, handler | For MCP, the description is read by a model — write it for the model |
| Parameter | name, type, required, default, validation | One schema drives parsing, `--help`, and MCP tool JSON |
| Config | resolved settings + provenance of each value | Precedence: flag → env → project file → user file → default |
| Credential | token, scope, expiry | OS keychain or a mode-restricted file — never the repo, never a plain env dump |
| Session / Context | per-connection state for MCP; per-invocation for a CLI | MCP connections are long-lived; keep them isolated per client |
| Cache entry | key, payload, TTL, schema version | Bump the schema version on layout change or you will ship poisoned caches |
| Release artifact | version, platform, checksum, provenance | Reproducible from a tag alone |

## Directory structure

```
cmd/ or bin/         # entrypoint only — parse args, wire deps, exit. No logic.
internal/            # everything private. Default home for new code.
  core/              # the actual behavior, callable without a terminal
  config/            # precedence resolution, one place
  output/            # human renderer + machine (JSON) renderer, same data source
pkg/ or src/index    # THE public surface. Explicit allowlist of exports.
mcp/                 # server: transport, capability negotiation, tool registry
  tools/             # one file per tool, schema colocated with handler
docs/
  examples/          # every example is executed by the test suite
testdata/            # golden files for output assertions
.github/workflows/   # test matrix + tag-triggered release
```

Rule: `internal/` is the default and `pkg/` is the exception. Anything reachable from the public entrypoint is a promise you now maintain.

## Build order

1. **Consumer brief + README first** — write the usage section before any code: three real invocations, each paired with the exact output it will print. *Done when:* `README.md` contains exactly three invocation blocks, each followed by a fenced expected-output block, and each expected output is also committed verbatim to `docs/examples/NN-<name>.txt`; a script asserts the README block and its file are byte-identical and fails on drift. Step 9 later runs these files as tests, so writing the output wrong now costs you a red build then — which is the point.
2. **Freeze the public surface** — list every exported symbol, command, or MCP tool with its signature in one file. Everything else is internal. *Done when:* `docs/surface.md` exists and a script diffs it against the real exports, failing on drift.
3. **Skeleton + argument parsing** — command tree, flags, no behavior yet. *Done when:* `--help` prints the full tree and exits 0; an unknown flag prints usage to stderr and exits non-zero.
4. **Core logic behind the surface** — implemented as a callable library, with the CLI as one thin caller. *Done when:* unit tests cover the happy path plus two failure modes, invoking core directly with no terminal involved.
5. **Output contract** — human renderer on a TTY, `--json` for machines, diagnostics on stderr. *Done when:* `tool run --json | jq .` parses with zero stray stdout lines, and `NO_COLOR=1` output contains no escape sequences.
6. **Exit codes + typed errors** — a documented table (0 success, 1 expected failure, 2 usage error, and any domain codes). *Done when:* a test asserts the code for each row of the table.
7. **Config precedence** — flag → env → project file → user file → default, with `tool config show` reporting where each value came from. *Done when:* a test proves each level overrides the one below it.
8. **Versioning + deprecation policy** — written down: what is public, what semver means here, how long a deprecated symbol survives. *Done when:* `VERSIONING.md` exists and CI fails a PR that changes a public signature without a release note entry.
9. **Tested documentation** — extract examples from docs and run them. *Done when:* the docs test executes every example in `docs/examples/` and fails on any output drift.
10. **Compatibility matrix** — CI runs the suite on every supported OS and on the oldest runtime the track declares as the floor. *Done when:* the matrix is green and the floor is stated in the package manifest, not just the README.
11. **Packaging + distribution** — build the real artifact for the ecosystem (see table below). *Done when:* a clean container installs it in one command and `tool --version` prints the tag.
12. **Release automation** — tag push builds, checksums, signs, generates the changelog, publishes. *Done when:* a dry run produces artifacts and a changelog with no manual step other than pushing the tag.
13. **MCP only — transport and handshake** — support stdio and streamable HTTP; negotiate capabilities on connect. *Done when:* an MCP inspector connects over both transports, completes `initialize`, and lists every tool with its schema.
14. **Adoption smoke test** — in a clean container with no source tree present, install the *published* artifact from the registry and run the README's first example. *Done when:* the install command exits 0, and the example's stdout byte-matches `docs/examples/01-*.txt` — with the local build directory absent from the container, so nothing can resolve to the workspace copy.

## Distribution by ecosystem

| Track | Primary channel | Also ship | Verify with |
|---|---|---|---|
| Go | Tagged release binaries per OS/arch | Homebrew tap, `go install`, container image | Install on a clean machine, no toolchain present |
| TypeScript / Node | npm registry with provenance attestation | `npx` one-shot use, correct exports map for both module systems | `npm pack` and install the tarball, not the workspace |
| Python | PyPI wheel + sdist | `pipx` / `uvx` for tools, extras for optional deps | Fresh virtualenv install, import in a REPL |
| MCP server | However the host runs it — binary, `npx`, `uvx` | A copy-paste host config block in the README | Connect with an inspector before publishing |

## Pitfalls

- **Assuming MCP went stateless.** The current *ratified* MCP spec is the stateful one; the stateless revision is an unratified draft, and its own compatibility matrix says modern-only servers fail against deployed hosts. Build dual-era and default to the `initialize` handshake.
- **Anything printed to stdout that is not data.** Logs on stdout break pipes, and on an MCP stdio transport one stray print corrupts the JSON-RPC stream permanently. Data to stdout, everything else to stderr.
- **A barrel file that re-exports everything.** Every accidental export is a support obligation. Allowlist exports; keep the rest internal.
- **Untested examples.** Docs drift within one release. If an example is not executed by CI, assume it is already wrong.
- **Interactive prompts with no escape hatch.** A CLI that blocks on a prompt hangs CI forever. Detect a non-TTY, honor `--yes`, and fail loudly instead of waiting.
- **Breaking changes shipped as patches.** Renaming a flag, changing an exit code, or altering JSON output shape is a major. Removing a log line is not.
- **Too many MCP tools.** Tool names and descriptions are consumed as prompt context. Ten sharp tools beat forty thin ones; return compact structured results, not raw API dumps.
- **Publishing from a laptop.** No provenance, no reproducibility, and one compromised machine owns your users. Release only from CI on a tag.
- **Requiring the newest runtime.** Declare a floor, test it in the matrix, and raise it only in a major.

## Skills for the build phase

Reference `knowledge/skills-registry.md` for install commands. Every reference degrades gracefully — if a skill is absent, fall back to the knowledge base or built-in `WebSearch`/`WebFetch`, note it in one line, and keep going.

| Skill | Use it for |
|---|---|
| `/last30days` | Current ecosystem norms — packaging conventions and registry policy move fast |
| `find-skills` | Discovering build-phase skills worth naming in the blueprint |
| `agent-browser` | Pulling the current MCP spec or a registry's publishing rules into markdown |
| `/humanizalo` | The README and docs — this is the marketing surface for a developer tool |
| `claude-api` | **Mandatory** before writing any model ID, price, or API parameter if the tool calls Claude |

Skip the UI skills entirely. There is no interface to design here.

## See also

- `knowledge/runtime-tracks/go.md` — the default track: static binaries, cross-compilation, release tooling
- `knowledge/runtime-tracks/ts-node.md` — npm packaging, exports maps, and the JS-ecosystem MCP path
- `knowledge/runtime-tracks/python.md` — wheels, `uvx`, and data/ML tooling
- `knowledge/capabilities/api-design.md` — versioning and surface design, the core of this shape
- `knowledge/capabilities/testing.md` — contract tests, golden files, matrix strategy
- `knowledge/shapes/api-backend.md` — when it is actually a hosted service, not a distributed artifact
- `knowledge/shapes/agent-app.md` — when the agent itself is the product rather than the tools it calls
- `knowledge/shapes/browser-extension.md` — when the consumer is a person on a web page, not a developer at a registry
