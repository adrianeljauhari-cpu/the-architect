# Phase 4: Generate

> Say how long it will take, verify versions, decide the output format, compose, validate, write to
> the user's directory, hand off.

Last verified: 2026-07-27

**Paths in this file:** every bare path (`templates/…`, `knowledge/…`, `questions/…`) is relative to
the plugin root — open it as `${CLAUDE_PLUGIN_ROOT}/<path>`. The one exception is `./blueprints/`,
which is always the **user's current working directory**.

Phase 4 is a procedure, not a conversation. Follow the eight steps in order. **You do not interview
the user here.** The interview is over; every decision that remains is yours to make and *announce*.
The one thing you may stop to ask is destructive — overwriting an existing blueprint, in Step 7.
Every step below carries a *Done when* — you do not advance past a step whose condition you cannot
observe.

**You are the only participant in Phase 4 with a shell.** `blueprint-writer` has `Read, Write, Glob,
Grep`; `blueprint-validator` has `Read, Grep`. Neither can run a command. Every instruction anywhere
in this plugin that says a block must be *executed* before shipping — `templates/blueprint-template.md`
§10 Bootstrap, `knowledge/stack-compatibility.md` — resolves to **you, in Step 6**. If you do not run
it, nobody does.

---

## Preconditions

Do not start until all of these hold. They come out of `questions/phase-3-confirmation.md`:

- Zero outstanding `[NEEDS CLARIFICATION]` markers
- Gate B (adversarial pre-mortem) run, survivors routed
- The user approved the architecture

If any is false, go back to Phase 3. A blueprint generated over an open marker bakes the guess in
permanently — the builder agent has no one to ask.

---

## Before Step 1 — tell the user how long this takes

**One message, before you run anything.** Generation is the only stretch of this flow where the user
sits in silence, and it is by far the longest. Steps 1 through 7 together run **roughly 25–35
minutes for a bundle** and **12–20 for a single file**: live registry calls for every pin, a full
composition pass, at least one validator round trip, and a live smoke test in a scratch directory
that runs the bootstrap, step 1, **and the first build step that touches the database** (Step 6).
Nothing streams back while it happens.

A user who was not warned does not experience that as thorough. They experience it as hung, and the
previous version of this tool was liked precisely because it answered fast. Silence is the worst
option available to you here.

Say three things, in three lines, in the user's language:

1. **What you are about to do** — verify every version against the live registries, compose the
   blueprint, validate it, run its bootstrap *and its first database step* once for real, write the
   files.
2. **Roughly how long, as a range in minutes.** Give the real number. An honest half hour beats a
   cheerful "one moment" followed by twenty-five minutes of nothing.
3. **That there is no intermediate output** — the next thing they see is the finished path and the
   first command.

> "Generating now. I verify every version against the live registries, compose the bundle, run the
> validator over it, and run its setup commands plus its first database step once in a scratch
> directory to prove they work — about 30 minutes, with no output until it's done. What comes back
> is the file path and the first command to run."

Then start. Do not ask permission — the user already approved the architecture at the Phase 3 gate.
If a later step blows well past the range you gave (a validator loop that will not converge, a
registry that is down), say so in one line rather than extending the silence.

*Done when:* a time range and a one-line description of the work are in the conversation, before the
first registry call.

---

## Step 1 — Verify every version before pinning it

**Never write a version number from memory.** v1 of The Architect hardcoded pins into thirteen files
and went stale in four months. This step is the structural fix.

Delegate to the **`stack-researcher`** subagent. It checks live registries and returns current
versions with their compatibility notes. If it cannot be dispatched, do the registry checks yourself —
see *Never hard-depend on a subagent* at the end of this file. The delegation is optional; the
checking never is.

Hand it:

- The approved stack, layer by layer (framework, runtime, styling, ORM, test runner, package manager…)
- The chosen runtime track file, so it knows which ecosystem's registry to hit
- Any constraint the user gave ("must run on their existing hosting", "team is on the LTS line")

Get back, per layer: current version, whether it is stable or pre-release, peer-dependency ranges,
and any rename or breaking change since the last major.

Rules:

| Rule | Why |
|---|---|
| Every pin in the blueprint traces to a result from **this session** | Yesterday's answer is already a guess |
| Never pin a pre-release as if it were stable | A `^1` on a package still in RC breaks installs |
| Never assert a peer range you did not read | "Framework X requires Runtime Y" is the single most confidently-wrong claim models make |
| If a version cannot be verified, write "verify before install" in the blueprint | An honest gap beats a wrong pin |

Pins live in the blueprint's stack table and nowhere else. Prose says "the project's ORM", not the
number.

**Authority:** the `stack-researcher` report produced in *this session* wins. The chosen
`knowledge/runtime-tracks/<track>.md` is the **fallback** for any package the researcher did not
resolve — and its unverified caveats carry through into the blueprint verbatim. A track file is a
cache, not a source of truth: right the day it was written, drifting ever since. Never write a pin
from memory, and never let a cached file override a live registry check.

Every pin ships with its provenance — package, version, source URL, date checked — into the
blueprint's version-provenance table. A package that was not researched says so, rather than
implying a verification that never happened.

*Done when:* every layer in the stack table carries a VERIFIED or UNVERIFIED status from a
`stack-researcher` report dated today, each with a source URL and a checked date. Zero unlabeled
layers.

---

## Step 2 — Decide the emission mode, and announce it

**Do not ask.** This used to be a question, and it was the wrong one: it is the only decision in the
whole flow whose answer changes *zero* design decisions, it was asked last, after the architecture
was already approved, and it was phrased in the tool's own vocabulary rather than the user's.
Non-negotiable rule 3 says be opinionated and recommend one option — asking here contradicted it.

**Derive it from the step count** in the build order you drafted in Phase 3:

| Steps in the build order | Mode | Output |
|---|---|---|
| **12 or more** | **Bundle** | `./blueprints/<project-slug>/` |
| **11 or fewer** | **Single file** | `./blueprints/<project-slug>-blueprint.md` |

Why twelve: below it a builder holds the whole blueprint in one context and `tasks.json` buys
nothing but files to keep in sync. At or above it the build spans sessions, and resumable state is
the difference between finishing and starting over. The template's step budget is 10–18, so both
sides of this threshold are reachable — it is a real split, not a formality.

**An explicit user preference wins, always.** If the user said "just give me one file", "keep it in
a bundle", or anything equivalent at any point in this conversation, honor it and skip the
derivation entirely. Never re-ask something they already answered.

**Announce the choice in one line — a statement, not an opening for discussion:**

> "Bundle: 15 steps, so this build spans sessions and `/architect-next` needs `tasks.json`."

Both modes carry identical acceptance criteria and verify commands; the difference is packaging
only. If the user pushes back, re-emit in the other mode — that costs one generation pass, not a
redesign. Say so in one line rather than debating it.

**This step is authoritative on emission mode.** A Mode table in `commands/architect.md`,
`commands/architect-brownfield.md` or `commands/architect-quick.md`, or the emission-mode block in
`templates/blueprint-template.md`, is input to the threshold above — never a competing decision, and
never a reason to reopen it with the user. **Any of those files that still says to *ask*, *confirm*,
or *recommend and get a yes* on the mode is stale and does not override this step.** Derive, then
announce. The only input that outranks the threshold is an explicit preference the user already
volunteered.

*Done when:* the mode is stated in the conversation in one line with the step count it came from,
and that step count is the one that goes into the blueprint's build order.

---

## Step 3 — Output layout

Slug the project name to kebab-case. `<project-slug>` below is that slug. This is the canonical
layout — there are no variants.

### Bundle

```
./blueprints/<project-slug>/
├── blueprint.md          # the 20-section narrative artifact — templates/blueprint-template.md
├── tasks.json            # the machine-readable task DAG — templates/tasks-schema.md
├── epics/
│   ├── 01-<name>.md      # one file per epic — templates/epic-template.md
│   └── 02-<name>.md
└── workspace/            # copied INTO the target project root by the builder, as-is
    ├── CLAUDE.md         # templates/claude-md-template.md
    ├── AGENTS.md         # tool-neutral stub — claude-md-template.md, "Companion files"
    ├── <verify-critical config>   # every config a §9 Verify needs to run — blueprint §19.6
    └── .claude/
        ├── settings.json          # allowlist covering every verify command in blueprint §9
        ├── skills/<name>/SKILL.md # repeatable project workflows — blueprint §19.4
        └── rules/<name>.md        # paths:-scoped conventions — blueprint §19.5
```

`workspace/` exists for exactly one reason: the builder copies **one directory** into the target
project root and is done. Say that explicitly in the handoff.

**`<verify-critical config>` is a set, not one file, and it is not optional.** It expands to the real
files §19.6 names — test-runner config, e2e-runner config, test setup or env-bootstrap file,
path-alias config, the local service compose file, and every file a `Verify` command names as an
argument — each at the path it occupies in the target project, because `workspace/` mirrors the
target repo layout exactly. The fixed entries above are literal; this row is the variable one. It is
empty only when §19.6 itself says `NOT APPLICABLE`, and a bundle whose §9 runs a test runner with no
runner config under `workspace/` fails at its first gate with an error that looks like broken code.

**`.claude/commands/` is never emitted, in either mode.** A slash command only fires when a human
types it, and an autonomous builder types nothing — a scaffolded command is dead weight that is
never invoked once. Repeatable project workflows go in `.claude/skills/<name>/SKILL.md`. Resuming is
`/architect-next`, a plugin command; it never needed a per-project copy.

Every epic file cross-links to its tasks in `tasks.json`, and every task carries its epic id. If they
disagree, the validator fails the run.

### Single file

```
./blueprints/<project-slug>-blueprint.md
```

Everything inline, in template order. Section 19 emits the workspace files as **fenced code blocks**
the builder copies out, instead of as real files. No `tasks.json`, no `epics/` — resume is manual.
No external references: a reader with zero context must be able to build from this one file alone.

### Both modes carry

- **Acceptance criteria in EARS form** — WHEN `<trigger>` THE SYSTEM SHALL `<observable response>`
- **A verify command per step** — the exact command, and what passing looks like
- Never `Done when: it works`. Always `Done when: pnpm test src/auth passes 4 tests`.
- All **20 numbered sections** of the blueprint template, even the inapplicable ones — those get
  `NOT APPLICABLE — <reason>` under the heading. Downstream tooling indexes by number.

*Done when:* the target paths for the chosen mode are written out literally, and `./blueprints/`
exists in the user's cwd.

---

## Step 4 — Compose via `blueprint-writer`

Delegate composition to the **`blueprint-writer`** subagent. A full blueprint is long; generating it
in the main thread floods the interview context and degrades everything after it — but if the
subagent cannot be dispatched, compose it in the main thread anyway rather than blocking. See *Never
hard-depend on a subagent* at the end of this file.

Hand it a complete brief — the subagent has no memory of the interview:

- Project name, slug, one-paragraph vision, target user
- Chosen shape, runtime track, and capability files (by manifest path — it reads them itself)
- The stack table **with the verified pins from step 1**
- Data model, scope in / scope out, and the Non-Goals from Gate B
- The Risk Register survivors from Gate B
- The design system decided in Phase 3 — real hex values, type pairing, component style
- Output mode from step 2, and the exact target paths
- The user's language, so the blueprint is written in it
- **The verify-critical config files it must emit** — say it explicitly in the brief, because this is
  the part writers skip. Every config file a §9 `Verify` command needs in order to run is emitted in
  §19.6 as a real file with complete content: test-runner config, e2e-runner config, test
  setup/env-bootstrap file, path-alias config, the local service compose file with pinned image tags
  and a healthcheck, and every file a `Verify` names as an argument. In bundle mode those land under
  `workspace/` at their target-repo paths (Step 3's `<verify-critical config>` row); in single-file
  mode they are fenced blocks in §19.6, each labelled with its destination path. Naming a file in §3's
  tree is not emitting it.
- **Who authors the package manifest**, stated as a decision and not left open — see *Who authors the
  package manifest* immediately below. Say which of the two origins applies to this stack, in the
  brief, in one line.
- **That §10's Bootstrap block will be executed verbatim in Step 6**, so every command in it must be
  non-interactive and in the order it is run — no TTY prompts, no "then configure as needed".

### Who authors the package manifest — decided here, not left to the writer

The **manifest** is whatever file the track's dependency manager reads: `package.json`,
`pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`. On a greenfield build nothing in
this plugin said who produces it, and two defensible readings existed — §19.6 requires emitting every
config a `Verify` needs, and §10's Bootstrap installs dependencies *before* step 1, which forces the
manifest to pre-date step 1; while validator finding #18 pushes against a build step that is already
satisfied by the blueprint. Only one of the two readings actually builds. **This is the ruling. Put it
in the brief.**

One question decides it: **does a command in §10's Bootstrap block generate the manifest?**

| Answer | Who authors it | What must NOT happen |
|---|---|---|
| **Yes** — Bootstrap runs a scaffolder that writes it (`pnpm create …`, `cargo new`, `uv init`, `go mod init`, `bundle init`) | **The scaffold command.** The blueprint owns the *edits* on top of it — added scripts, the engines/requires floor, an extra dependency — and each edit is a named command or an explicit written change inside §10, placed **after** the scaffold line and **before** step 1 | Do not also emit the manifest under `workspace/`. The copy would either be overwritten by the scaffolder or overwrite it, and which one wins depends on command order nobody stated |
| **No** — bare greenfield with no scaffolder, the normal case for a CLI, a library, an MCP server | **The blueprint.** Emit it as a real file in **§19.6**, under `workspace/` at the repo root in bundle mode, as a labelled fenced block in single-file mode. It is origin 2 under `templates/blueprint-template.md` §3, and the builder's single `workspace/` copy puts it in place before Bootstrap's first install command runs | Do not give §9 a step whose job is to write the manifest. Bootstrap already installed from it, so that step gates nothing — that is exactly finding #18 |

**Never split the file across both.** A stub under `workspace/` that step 1 "fills in" is two authors
and one file, which is the thing the writer rule below exists to prevent. One origin, complete
content, no `{placeholder}` fields, no "add your dependencies here".

**Finding #18 and §19.6 do not actually conflict once this is applied.** #18 is about a *build step*
that gates nothing; emitting a workspace file is not a build step and is never scored as one. The
combination #18 forbids is the third option neither rule wanted: a §9 step that authors a manifest
§10 already installed from.

The same ruling covers every other file Bootstrap consumes before step 1 exists — the lockfile
policy, the runtime-version file (`.nvmrc`, `.python-version`, `rust-toolchain.toml`), and the
compiler config when the install or the first `Verify` reads it. If Bootstrap touches it before step
1, a scaffold command makes it or `workspace/` ships it. Nothing else is available that early.

**The writer writes.** It composes *and* saves every file in the Step 3 tree. Never re-write those
files yourself afterwards — two authors with no arbiter is how a bundle ends up half-consistent.

*Done when:* `blueprint-writer` returned a path, a section count of **20/20 filled**, and an explicit
`Blocking gaps: none`. Anything less goes back to the writer before you validate.

---

## Step 5 — Validate via `blueprint-validator`

Delegate to the **`blueprint-validator`** subagent. It checks, at minimum: no unresolved markers, no
placeholder text, every build step has an observable "Done when", every task in `tasks.json` maps to
an epic, no orphan dependencies, every pin traceable to a provenance row, a complete
`workspace/CLAUDE.md`, and — the sweeps that exist because real builds died on them — that every
emitted config actually resolves what the gates import, that every standalone tool a gate invokes has
its environment loaded, and that every number the blueprint asserts matches what the blueprint
defines.

If the subagent cannot be dispatched, run its sweeps yourself out of `agents/blueprint-validator.md`,
in order, and say in one line that the audit was self-run. See *Never hard-depend on a subagent* at
the end of this file. An unvalidated blueprint never ships; a self-validated one does.

- **Fails → fix and re-run.** Send the specific failures back to `blueprint-writer`, or patch small
  ones directly.
- **Never present a blueprint that has not passed.** A validated blueprint is the entire product.
- If validation fails three times on the same item, stop and ask the user — that item is a design
  gap wearing a formatting bug's clothes.

*Done when:* `blueprint-validator` returned PASS with 0 BLOCKER and 0 MAJOR findings.

---

## Step 6 — Smoke-test the bootstrap **and the data layer**. You run it; nobody else can.

The validator reads. **This step executes.** A blueprint can pass every sweep in Step 5 and still be
unbuildable, because the failures that kill step 1 are not visible from reading: a scaffolding tool
that ignores the flag it documents, an approval prompt with no `--yes`, a generator that installs a
package the blueprint said to skip, a peer range that only conflicts once the resolver runs. Reading
cannot catch any of those. Running catches all of them, in about three minutes, before the user has
the file.

**Stopping at step 1 is not enough, and this is settled by evidence rather than opinion.** Two live
build tests ran this step, passed it, and then died anyway — the second one at step 3's literal first
command. Both deaths were in the same place: the moment something *other than the toolchain* had to
load. A migration CLI with no environment. A test runner whose config could not resolve the import
guard the blueprint mandates on every server module. A seed script that died before its first query.
None of those touch step 1, which is why step 1 kept passing while the blueprint kept failing.

So this step runs **three** things, and the third is the one that has been catching the real defects.
A fourth, short, is handed to you by the validator: running the blueprint's own formatter over
`workspace/`, which the validator is structurally unable to do.

**Only the main thread can do this.** `blueprint-writer` and `blueprint-validator` have no `Bash`.
Every "run this before shipping" line in the templates and in `knowledge/stack-compatibility.md`
is addressed here.

### What to run

In a **scratch directory outside both the bundle and the user's project** — `mktemp -d`, never the
cwd, never `./blueprints/`:

1. **The §10 Bootstrap block, verbatim, in order,** every command, start to finish. Not a summary of
   it, not the parts you think matter. If a command hangs on a prompt, that is the finding.
2. **Build step 1's `Verify` block,** every command, checking each against the expected result its
   trailing comment states.
3. **The first `Verify` command in §9 that touches the DATA LAYER** — and everything §9 says must run
   before it, so it can run at all.
4. **The formatter/linter check over `workspace/`** — the half of validator Sweep 12 that is handed to
   you by name, because the validator has no shell and cannot run a formatter. Copy `workspace/` into
   the scratch project root exactly as §19 tells the builder to, then run **the check command the
   blueprint itself mandates** (`<formatter> check .`, `<linter> .`) over that tree. A live run caught
   two real mismatches here that no amount of reading had found. Copy it where §19 puts it — after
   §10's Bootstrap has created the tree, before step 1 — so if §9 step 1 or §20.1 already runs that
   command, run 2 covers this for free and you need only read its output. Any failure is
   finding #22 and routes to *On failure* like every other: send it back to the writer, do not reformat
   the file yourself.

If the bootstrap needs environment variables, seed them from the `.env.example` the blueprint
specifies, using §10's literal local values. If a command still needs a real secret, it is a
partial-run case below — never invent a credential to get past a gate.

### Finding the data-layer command (run 3)

Walk §9 from step 1 and take the **earliest** `Verify` command that does any of these. Do not take
the first one that merely mentions the database in prose — take the first one that *executes* against it:

| It qualifies when the command… | Canonical shapes |
|---|---|
| Applies or generates schema | a migrate, push, generate or sync command |
| Writes or clears data | a seed, reset or fixture-load script |
| Runs a test that imports a server-side module | the first integration/API/repository test, not a pure-UI or pure-unit test |
| Starts the local service the gates depend on and proves it accepts connections | the compose up plus the first real query against it |

Then run **everything that command depends on**, in §9's order, or it is not a real test: the service
must be up, the schema applied, the env loaded exactly the way the blueprint says it is loaded. If
you find yourself typing a command the blueprint does not contain in order to make this work — an
export, a `cd`, a flag, a wait — **stop: that is the finding.** The builder will not know to type it
either. Send it back to the writer rather than typing it yourself.

That last rule is the whole value of run 3. Every defect the last two build tests hit had this exact
signature: a step that runs only if you already know the one thing the blueprint never says.

**A data layer that needs no service is a CLEAN PASS of run 3, not a blocked one.** Plenty of correct
architectures store state without anything to start: an embedded or in-process database, a
single-file store, an append-only log, a content-addressed cache, an index built from files on disk.
For those, run 3 is *easier*, not skipped — the earliest `Verify` that applies schema, writes or
clears data, or runs a test importing the storage module still exists, and you still run it and its
prerequisites in §9's order. It passes or it fails on the blueprint's merits, exactly like any other.
This has been executed for real: a live run took run 3 against an embedded database, with no service
anywhere in the stack, and passed fully.

So do not reach for the "not smoke-tested past the toolchain" note because the stack has no container
in it. That note is for a data layer you **could not reach**, never for one that had nothing to
start. A blueprint whose store is in-process and whose run 3 passed is **smoke-tested**, full stop,
and reporting it any weaker under-sells a build that was verified end to end.

Three situations that look adjacent, one verdict each:

| Situation | Run 3 verdict |
|---|---|
| The store is embedded/in-process/file-based, and its first `Verify` ran | **Clean pass.** Report it as `bootstrap, step 1 and <command> verified` |
| The data layer is genuinely serviceless *and* there is no schema, no write, no seed and no test that touches storage anywhere in §9 | Say so in one line — run 3 has no target, and that is a finding about §9, not about this machine. A blueprint with a data model and no gate that exercises it goes back to the writer |
| A service *is* required and this machine cannot start it | The environmental case below |

Rules for the run:

| Rule | Why |
|---|---|
| Scratch directory, deleted when the step ends | The user's cwd is not a test fixture, and a half-scaffolded project left behind is worse than no test |
| Non-interactive only — never answer a prompt by hand | A command needing a human here needs one during an unattended build too. The prompt *is* the defect |
| Cap each command; kill anything still running after ~5 minutes | A hang is indistinguishable from slow work, and this step must not blow past the time range you gave before Step 1 |
| Never run a command that writes outside the scratch directory or touches a live account | A blueprint's bootstrap can create real cloud resources — read it before you run it, and skip those commands under the partial-run rule below |
| Run every command **exactly as the blueprint writes it** — same working directory, same flags, same env loading | A command that only works with your improvement is a broken command. You are standing in for a builder who cannot improvise |
| Tear the local services down before deleting the scratch directory | A container left running holds a port, and the next run fails for a reason that has nothing to do with the blueprint |

### On failure

**A failed command is a validator finding.** Route it exactly the way Step 5 routes one — do not
patch the blueprint to match what happened to work, and do not soften the step so it stops failing:

1. Send `blueprint-writer` the failing command verbatim, its exit code, and the last ~20 lines of its
   output. That output is the specification for the fix — a real error message beats any guess.
2. Take back the corrected blueprint, **re-run Step 5**, then re-run this step from a fresh scratch
   directory. A fix that was not re-validated is not a fix.
3. **Three failures on the same command → stop and ask the user.** Same rule as Step 5, same reason:
   at three, it is a stack problem wearing a command's clothes, and the honest move is to say so.

### When it genuinely cannot run

Some bootstraps cannot execute here: no network, a toolchain this machine does not have, a paid
credential the user has not created yet, a command that would provision real infrastructure. Run 3
adds its own: **a data layer whose service this machine cannot start — no container runtime for the
local database, or a managed data service that needs the user's own credentials.**

Read that blocker as *a service is required and unavailable*. A stack whose data layer needs no
service at all is the clean-pass case above and never lands here — an in-process store is a design
choice, not a degraded environment, and treating it as a blocker reports a verified build as an
unverified one. Then:

- **Run everything up to the blocking command** and report a partial pass — "bootstrap verified
  through `pnpm install`; `supabase link` needs the user's project ref". A partial run is worth far
  more than none, and it still catches the scaffolding failures, which are the common ones.
- **Skipping is allowed only with an explicit, unmissable note in the output.** Step 8's handoff
  carries one line, in the user's language, saying the blueprint was **not smoke-tested**, exactly
  which commands were not run, and why. Never let a skip pass silently — an untested bootstrap
  presented like a tested one is the failure this whole step exists to prevent.
- Never skip because the run looks slow, or because Step 5 passed. Step 5 passing is not evidence
  about this step; they check different things.

**When runs 1 and 2 pass and run 3 cannot execute, you say so in those words.** The blueprint is
**smoke-tested through the toolchain only, not past it** — not "smoke-tested". Name the data-layer
command you could not run and the environmental reason, and carry that exact wording into Step 8:

> "Bootstrap and step 1 verified. **Not smoke-tested past the toolchain** — step 3's
> `pnpm db:migrate` needs a container runtime this machine does not have, so the data layer is
> unproven."

The distinction is the whole point of this revision. A blueprint whose toolchain runs and whose data
layer was never touched is exactly the artifact both failed build tests produced, and reporting it as
"smoke-tested" is what let it reach a builder twice. **Only an environmental blocker earns this
note** — a required service you cannot start, no credentials, no network. Two things are never
environmental blockers: a command that fails because the blueprint is wrong (that is *On failure*, and
it goes back to the writer), and a data layer that needs no service in the first place (that is a
clean pass — run it, and report it as verified).

*Done when:* the §10 Bootstrap block, step 1's `Verify` commands, **the first data-layer `Verify`
command with its prerequisites**, and the mandated formatter check over the copied `workspace/` tree
have each been executed in a scratch directory and either **all
exited as the blueprint says they should**, or the exact unexecuted commands, their environmental
reason, and — if run 3 was among them — the words **not smoke-tested past the toolchain** are written
down for Step 8's handoff. The services are torn down and the scratch directory deleted either way.

---

## Step 7 — Write location

**Write to the user's current working directory. Never inside the plugin.**

`${CLAUDE_PLUGIN_ROOT}` is a read-only cache that gets wiped on update. Anything written there is
lost and unreachable from the user's project.

- ✅ `./blueprints/<project-slug>/blueprint.md`
- ❌ `${CLAUDE_PLUGIN_ROOT}/blueprints/...`
- ❌ `output/` — the v1 location; it lived inside the repo and only worked in clone mode

If `./blueprints/` does not exist, create it. If a blueprint with that name already exists, say so
and ask before overwriting.

### Where the bundle sits relative to the code

**Every verify command in the blueprint runs from the TARGET PROJECT root** — never from the bundle
directory, never from an unrelated design directory. `pnpm test src/auth` means *that project's*
`pnpm` and *that project's* `src/`. Write the bundle where that relationship is unambiguous:

There is still only one location rule — `./blueprints/<project-slug>/`, relative to your current
working directory. The table below does not add a second one; it says **where that cwd should be**.

| Situation | Where the bundle goes |
|---|---|
| The project directory already exists (brownfield, or the user scaffolded it) | Run the design session **from inside the target project**, so the cwd *is* the project root and the one rule resolves to `<target-project>/blueprints/<project-slug>/`. If you are not already there, `cd` into it before writing. `/architect-next` then finds `tasks.json` and runs verify commands from that same root, with nothing to explain. |
| The project does not exist yet | The design session's cwd is fine — `./blueprints/<project-slug>/` there — but the handoff must say, in one line, that the bundle moves into the project root once it exists, so that the cwd-is-project-root relationship holds before `/architect-next` runs. |

`/architect-next` stops when the bundle is not inside the project it builds. That is correct: an
unrelated cwd makes every verify command fail for reasons that have nothing to do with the code.

*Done when:* every file in the Step 3 tree exists on disk under the user's cwd, and the bundle's
relationship to the target project root is settled. Check the tree the way Step 3 defines it: the
**fixed entries are literal** — `blueprint.md`, `tasks.json`, `epics/`, `workspace/CLAUDE.md`,
`workspace/AGENTS.md`, `workspace/.claude/settings.json` — and the `<verify-critical config>` row is
a **set**, satisfied when every file §19.6 lists exists under `workspace/` at its target-repo path.
An `ls` that matches the fixed entries and nothing else is a *failure*, not a pass: a bundle whose
§19.6 names a runner config that is not on disk cannot run its own first gate.

---

## Step 8 — Hand off

Short summary. Do not restate the architecture — the user just approved it.

1. **Path** — the exact absolute file or directory written
2. **Shape** — what it is and how many build steps, in one line
3. **Any "verify before install"** flags from step 1
4. **The smoke-test result from Step 6** — one line, and it must distinguish three outcomes, not two:

   | What happened | The line to write |
   |---|---|
   | Bootstrap, step 1, and the first data-layer verify all ran — **including every stack whose store needs no service to start** | "bootstrap, step 1 and `<the data-layer command>` verified in a scratch directory" |
   | Runs 1 and 2 ran, run 3 blocked environmentally — a **required service** could not be started here | **"not smoke-tested past the toolchain"** — name the data-layer command and the reason |
   | Blocked before that, or skipped | **"not smoke-tested"** — name what was not run and why |

   Never omit this line; a silent omission reads as a pass. And never write plain "smoke-tested" when
   the data layer was never touched — that sentence is what shipped two unbuildable blueprints.
5. **Where the verify commands run from** — the target project root (see Step 7). If the bundle is
   not already inside that project, say it must be moved there first.
6. **The immediate next command**

Bundle:

```
/architect-next
```

One line before it: copy `blueprints/<project-slug>/workspace/` into the target project root — that
one directory is `CLAUDE.md`, `AGENTS.md` and `.claude/` in the places the builder expects them.

Single file: open a fresh Claude Code session **in the target project directory** and point it at the
blueprint file — a clean context is the whole reason the blueprint is self-contained. The workspace
files are fenced blocks inside it; the builder copies them out before step 1.

Then stop. Do not start building. The Architect designs; a different instance builds.

*Done when:* the user has the absolute path, the Step 6 smoke-test result, the workspace-copy
instruction, and the next command.

---

## Subagent rules

**`AskUserQuestion` is stripped from every subagent.** A subagent that needs a decision cannot get
one — it will guess, or stall.

- **Every user question happens in the main thread.** Never delegate a question.
- Resolve all ambiguity *before* dispatching. If a subagent comes back with an open question, answer
  it in the main thread — with the user if needed — and re-dispatch.
- Subagents return text and write files. They do not talk to the user.

### Never hard-depend on a subagent

Steps 1, 4 and 5 delegate to `stack-researcher`, `blueprint-writer` and `blueprint-validator`. That
is the preferred path and you should take it whenever you can. **It is not a requirement, and this
phase never blocks on it.** SKILL.md rule 11 already says never hard-depend on a third-party *skill*;
this is the same rule for *subagents*, and it exists because in two consecutive live runs the Task
tool was unavailable and all three were undispatchable, leaving the operator to improvise a fallback
that was never written down.

**If a subagent cannot be dispatched — no Task tool, the agent is not installed, dispatch errors —
do its job in the main thread, say so in one line, and keep going.**

| Subagent | Doing it yourself means | What you must not drop |
|---|---|---|
| `stack-researcher` (Step 1) | Hit the registries directly with `WebFetch`/`WebSearch`, or `npm view <pkg> version` and its ecosystem equivalents | Every pin still carries source and check date; an unresolvable pin is still written `UNVERIFIED`, never guessed from memory |
| `blueprint-writer` (Step 4) | Compose and write the Step 3 tree yourself, reading `templates/blueprint-template.md` section by section | All 20 sections filled, §19.6 emitted with real file bodies, `Blocking gaps: none` still true before you validate |
| `blueprint-validator` (Step 5) | Run the sweeps yourself against `agents/blueprint-validator.md`, as written | Every sweep, in order — most of all Sweep 10 and Sweeps 15–19. Self-auditing is weaker than an adversarial read, so slow down rather than skipping |

Three rules on the fallback:

1. **Say it once, in one line, in the user's language** — "Running the validation sweeps in the main
   thread; the subagent isn't available in this session." Not a paragraph, not an apology, and never
   silence: the user should know the audit was self-run, because that is materially weaker.
2. **The standard does not move.** A fallback changes *who* does the work, never *whether* it is
   done. Step 5's exit gate is still zero BLOCKER and zero MAJOR, and Step 6 still executes.
3. **Never stop and ask whether to proceed without a subagent.** Availability is an environment fact,
   not a design decision, and the user has nothing to add to it. Fall back and continue.

Doing the work in the main thread costs context, which is the whole reason these are subagents. So
when you fall back on Step 4, write the files section by section and keep the RUNNING BRIEF current —
a compaction mid-composition is the real risk here, not the missing agent.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Builder agent asks clarifying questions | Blueprint is not self-contained | Validator should have caught it — re-run step 5 |
| `npm install` fails on a pin | Version came from memory | Re-run step 1; never skip it |
| Builder drifts mid-build | Steps too large, or no "Done when" | Split steps to one sitting each; add observable criteria |
| Blueprint contradicts itself | Composed in pieces without a final pass | Validator run must be on the finished artifact, not per-section |
| Subagent stalls or invents an answer | It hit a decision it could not make | You left ambiguity in the brief — resolve in main thread, re-dispatch |
| Step 1 of the build dies on a scaffolding prompt or an ignored flag | The bootstrap block was written from docs, never executed | Step 6 exists to catch exactly this — run it; a doc is not evidence |
| First gate fails with `No test files found` or `Cannot find module` | A verify-critical config was drawn in §3 but never emitted in §19.6 | Send it back to the writer with the missing paths — see Step 4's brief and Step 7's tree check |
| Step 1 passes, then the build dies at the first database step | Step 6 stopped at the toolchain; the data layer was never executed | Run 3 of Step 6 exists for this — run it, or report **not smoke-tested past the toolchain** |
| Every server-side test dies at import, in a config that exists | The emitted runner config does not handle a package the blueprint mandates on every server module | Validator finding #25 — the config must name the package or its resolution mechanism in its own bytes |
| A migration or seed command exits 1 having created nothing | The tool reads an env var and nothing in the blueprint loads the env file for it | Validator finding #26 — the loading mechanism belongs in the command itself |
| A verify command greps for a count and gets a different one on every machine | A derived number was written from impression, not counted | Validator finding #27 — assert the named entities, not the cardinality |
| Step 1's checkpoint fails with `not a git repository` or an unresolvable `HEAD` | §10 never created the repo and its first commit | Validator finding #28 |
| Bootstrap's first install exits 1 with `no package.json` / `go.mod not found` / `no pyproject.toml` | Nobody was assigned the manifest on a greenfield build | Step 4's *Who authors the package manifest* — either a §10 scaffold command generates it or §19.6 ships it under `workspace/`. Never a §9 step |
| Generation blocks because a subagent will not dispatch | A step was read as requiring delegation | It never does — fall back to the main thread, say so in one line, continue |

---

## See also

- `questions/phase-3-confirmation.md` — the gates that must pass before this phase runs
- `templates/blueprint-template.md` — the structure `blueprint-writer` fills
- `templates/tasks-schema.md` — the `tasks.json` contract for bundle mode
- `templates/epic-template.md` — per-epic file structure
- `templates/claude-md-template.md` — the CLAUDE.md shipped with every blueprint
