# Phase 4: Generate

> Verify versions, ask for the output format, compose, validate, write to the user's directory,
> hand off.

Last verified: 2026-07-27

**Paths in this file:** every bare path (`templates/…`, `knowledge/…`, `questions/…`) is relative to
the plugin root — open it as `${CLAUDE_PLUGIN_ROOT}/<path>`. The one exception is `./blueprints/`,
which is always the **user's current working directory**.

Phase 4 is a procedure, not a conversation. Follow the steps in order. The only question you ask the
user here is step 2. Every step below carries a *Done when* — you do not advance past a step whose
condition you cannot observe.

---

## Preconditions

Do not start until all of these hold. They come out of `questions/phase-3-confirmation.md`:

- Zero outstanding `[NEEDS CLARIFICATION]` markers
- Gate B (adversarial pre-mortem) run, survivors routed
- The user approved the architecture

If any is false, go back to Phase 3. A blueprint generated over an open marker bakes the guess in
permanently — the builder agent has no one to ask.

---

## Step 1 — Verify every version before pinning it

**Never write a version number from memory.** v1 of The Architect hardcoded pins into thirteen files
and went stale in four months. This step is the structural fix.

Delegate to the **`stack-researcher`** subagent. It checks live registries and returns current
versions with their compatibility notes.

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

## Step 2 — Ask: bundle or single file?

**Ask the user. In the main thread.** This is a real choice with real consequences and you cannot
guess it from the interview.

If the user already stated a preference earlier in the conversation, honor it and do not re-ask.

| | **Bundle** | **Single file** |
|---|---|---|
| Output | `./blueprints/<project-slug>/` | `./blueprints/<project-slug>-blueprint.md` |
| Best for | Multi-week builds, several epics, a team, resumable work | Weekend builds, prototypes, anything you'll paste elsewhere |
| Build loop | Agent reads `tasks.json`, works one task at a time, marks progress | Agent reads top to bottom |
| Portability | A directory to copy | One file to send, paste, or commit anywhere |
| Trade-off | More files to keep in sync | Long; the builder holds the whole thing in context |

Frame it in one line, with a recommendation — bundle for anything past a few days of work, single
file otherwise. Both carry the same acceptance criteria and verify commands; the only difference is
packaging.

**This step is authoritative on emission mode.** Any command Mode table, template rule or step-count
heuristic that looks like it already decided is input to your *recommendation*, never a substitute
for asking.

*Done when:* the user has said "bundle" or "single file" in this conversation.

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
    └── .claude/
        ├── settings.json          # allowlist covering every verify command in blueprint §9
        ├── skills/<name>/SKILL.md # repeatable project workflows — blueprint §19.4
        └── rules/<name>.md        # paths:-scoped conventions — blueprint §19.5
```

`workspace/` exists for exactly one reason: the builder copies **one directory** into the target
project root and is done. Say that explicitly in the handoff.

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
in the main thread floods the interview context and degrades everything after it.

Hand it a complete brief — the subagent has no memory of the interview:

- Project name, slug, one-paragraph vision, target user
- Chosen shape, runtime track, and capability files (by manifest path — it reads them itself)
- The stack table **with the verified pins from step 1**
- Data model, scope in / scope out, and the Non-Goals from Gate B
- The Risk Register survivors from Gate B
- The design system decided in Phase 3 — real hex values, type pairing, component style
- Output mode from step 2, and the exact target paths
- The user's language, so the blueprint is written in it

**The writer writes.** It composes *and* saves every file in the Step 3 tree. Never re-write those
files yourself afterwards — two authors with no arbiter is how a bundle ends up half-consistent.

*Done when:* `blueprint-writer` returned a path, a section count of **20/20 filled**, and an explicit
`Blocking gaps: none`. Anything less goes back to the writer before you validate.

---

## Step 5 — Validate via `blueprint-validator`

Delegate to the **`blueprint-validator`** subagent. It checks, at minimum: no unresolved markers, no
placeholder text, every build step has an observable "Done when", every task in `tasks.json` maps to
an epic, no orphan dependencies, every pin traceable to a provenance row, and a complete
`workspace/CLAUDE.md`.

- **Fails → fix and re-run.** Send the specific failures back to `blueprint-writer`, or patch small
  ones directly.
- **Never present a blueprint that has not passed.** A validated blueprint is the entire product.
- If validation fails three times on the same item, stop and ask the user — that item is a design
  gap wearing a formatting bug's clothes.

*Done when:* `blueprint-validator` returned PASS with 0 BLOCKER and 0 MAJOR findings.

---

## Step 6 — Write location

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

*Done when:* every file in the Step 3 tree exists on disk under the user's cwd — `ls` on the bundle
directory matches the tree — and the bundle's relationship to the target project root is settled.

---

## Step 7 — Hand off

Short summary. Do not restate the architecture — the user just approved it.

1. **Path** — the exact absolute file or directory written
2. **Shape** — what it is and how many build steps, in one line
3. **Any "verify before install"** flags from step 1
4. **Where the verify commands run from** — the target project root (see Step 6). If the bundle is
   not already inside that project, say it must be moved there first.
5. **The immediate next command**

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

*Done when:* the user has the absolute path, the workspace-copy instruction, and the next command.

---

## Subagent rules

**`AskUserQuestion` is stripped from every subagent.** A subagent that needs a decision cannot get
one — it will guess, or stall.

- **Every user question happens in the main thread.** Never delegate a question.
- Resolve all ambiguity *before* dispatching. If a subagent comes back with an open question, answer
  it in the main thread — with the user if needed — and re-dispatch.
- Subagents return text and write files. They do not talk to the user.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Builder agent asks clarifying questions | Blueprint is not self-contained | Validator should have caught it — re-run step 5 |
| `npm install` fails on a pin | Version came from memory | Re-run step 1; never skip it |
| Builder drifts mid-build | Steps too large, or no "Done when" | Split steps to one sitting each; add observable criteria |
| Blueprint contradicts itself | Composed in pieces without a final pass | Validator run must be on the finished artifact, not per-section |
| Subagent stalls or invents an answer | It hit a decision it could not make | You left ambiguity in the brief — resolve in main thread, re-dispatch |

---

## See also

- `questions/phase-3-confirmation.md` — the gates that must pass before this phase runs
- `templates/blueprint-template.md` — the structure `blueprint-writer` fills
- `templates/tasks-schema.md` — the `tasks.json` contract for bundle mode
- `templates/epic-template.md` — per-epic file structure
- `templates/claude-md-template.md` — the CLAUDE.md shipped with every blueprint
