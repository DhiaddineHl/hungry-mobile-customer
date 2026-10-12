---
description: Implement the task in docs/tasks whose suffix matches the argument, then verify it
argument-hint: <TASK-SUFFIX>
---

# Implement Task by Suffix

Locate the task file in `docs/tasks/` identified by the suffix `$ARGUMENTS`, implement it
phase by phase, and verify the result against the task's own definition of done.

## What This Command Does

1. **Resolve the task**: find the single file in `docs/tasks/` whose `suffix` frontmatter
   field equals the argument.
2. **Check dependencies**: refuse to start if a task it depends on is not done.
3. **Load context**: read the task file in full, plus the plan it references.
4. **Plan the work**: create one todo per phase with TodoWrite.
5. **Implement**: work through the phases in order, honouring the task's constraints.
6. **Verify**: run the task's verification commands and check every definition-of-done box.
7. **Report**: state what changed, show real command output, and list anything deferred.

## Usage

```bash
/task "RESTO-01"
/task RESTO-01
```

## Implementation Steps

### 1. Resolve the Task File

Strip surrounding quotes and whitespace from `$ARGUMENTS` to get the suffix.

Search for the matching task file:

```bash
grep -l "^suffix: <SUFFIX>$" docs/tasks/*.md
```

Task files are named `<descriptive-name>-<SUFFIX>.md` (for example
`docs/tasks/restaurants-catalog-RESTO-01.md`) and declare the suffix in their YAML
frontmatter. The frontmatter is authoritative — match on it, not on the filename.

If exactly one file matches, proceed to step 2.

If **no** file matches:

- List the available suffixes:
  ```bash
  grep -h "^suffix:" docs/tasks/*.md
  ```
- Report that the suffix was not found, show the available ones, and STOP.
- DO NOT guess at the closest match and DO NOT invent a task.

If **more than one** file matches:

- Report the conflicting paths and STOP. Duplicate suffixes are an authoring bug that a
  human must resolve.

### 2. Check Dependencies

Read the resolved file's `depends_on` frontmatter field, if present. It names the suffix of
a task that must be complete first (for example `depends_on: RESTO-01`).

When `depends_on` is present, check the depended-on task's status:

```bash
grep -A1 "^suffix: <DEPENDENCY-SUFFIX>$" docs/tasks/*.md | grep "^status:" || \
  grep "^status:" $(grep -l "^suffix: <DEPENDENCY-SUFFIX>$" docs/tasks/*.md)
```

If the dependency's `status` is **not** `done`:

- Report that the task is blocked, naming both suffixes and the dependency's actual status.
- STOP.
- DO NOT implement the dependency's scope as part of this task. DO NOT proceed anyway.

If the dependency file cannot be found at all, report the dangling reference and STOP.

Task files also list concrete prerequisite checks (files that must exist, `npm test` passing).
Run those before implementing — a `status: done` frontmatter that does not match the working
tree means someone edited the field by hand, and the checks catch it.

When `depends_on` is absent, proceed directly.

### 3. Load Full Context

Read, in this order:

1. The resolved task file, completely.
2. The plan named in its `plan:` frontmatter field — completely, not skimmed. Plans carry
   verified API contracts and counter-intuitive backend behaviour that the task file only
   summarises.
3. `CLAUDE.md` at the repository root, if it exists.

Check the task's `status:` field:

- `status: todo` → proceed.
- `status: in-progress` → report that the task appears partially done, run `git status` and
  `git diff --stat` to show existing work, and continue from the first incomplete phase.
- `status: done` → report that it is already complete and STOP. DO NOT redo it.

Set `status: in-progress` in the frontmatter before starting implementation.

### 4. Create the Todo List

Use TodoWrite to create one todo per phase in the task file, named after the phase
headings (for example "Phase 1 — Test harness").

Mark each todo `in_progress` when starting it and `completed` immediately on finishing it.
DO NOT batch completions at the end.

### 5. Implement Phase by Phase

Work through phases **in the order the task file gives**. Phases are ordered by
dependency — a later phase usually cannot be verified before an earlier one exists.

For each phase:

1. Read the existing files the phase touches before editing them.
2. Make the changes with Edit or Write.
3. Run any verification the phase itself specifies before moving on.
4. Mark the todo completed.

Honour the task's **Constraints** section exactly. Constraints written as "DO NOT" are
hard rules, not preferences — in particular, never modify code outside this repository
unless the task explicitly says to.

Match the conventions of surrounding code — imports, quoting, theme tokens, component
idioms. When unsure, read a neighbouring file and copy its shape.

### 6. Verify

Run every command in the task's verification phase and capture the real output.

For this repository the standard checks are:

```bash
npx tsc --noEmit
npm test
npx eslint .
```

If a check fails:

- Fix the underlying cause and re-run it.
- DO NOT silence a type error with `any`, `as`, or `@ts-ignore`.
- If the same failure survives 3 fix attempts, STOP and report it with the full error.

Then walk the task's **Definition of done** list item by item and confirm each one
against actual evidence, not assumption.

### 7. Update Status and Report

Set `status: done` in the task file's frontmatter only when every definition-of-done item
passes. If any item does not pass, leave the status as `in-progress` and say which items
are outstanding.

Report in this format:

```
## RESTO-01 — <task title>

**Status**: DONE | INCOMPLETE | BLOCKED

**Files created**: <paths>
**Files modified**: <paths>

**Verification**:
- npx tsc --noEmit  → 0 errors
- npm test          → 24 passed, 0 failed
- npx eslint .      → clean

**Definition of done**: <n>/<total> — <which failed, if any>

**Deferred / notes**: <anything out of scope, blocked, or worth a follow-up>
```

## Important Notes

- **NEVER modify files outside this repository** unless the task file explicitly says to.
- **NEVER mark a task `done` with a failing check** — report INCOMPLETE instead.
- **DO NOT commit or push** unless the task file or the user explicitly asks.
- **DO NOT expand scope.** Tasks carry an out-of-scope list; respect it even when adjacent
  work looks trivial. Note the opportunity in the report instead.
- **DO NOT re-derive the API contract** the plan already documents and verified. If reality
  contradicts the plan, report the contradiction rather than silently coding around it.
- Report honestly: if a live verification could not run because a service was down, say so
  rather than describing the check as passed.

## Error Handling

If any step fails:

- Report the exact command that failed and its full error output.
- Fix the root cause and retry once.
- If it fails again for the same reason, STOP and ask how to proceed. DO NOT retry in a
  loop and DO NOT work around it by weakening types or deleting the check.

## Adding New Tasks

To make a new task triggerable by this command, create
`docs/tasks/<descriptive-name>-<SUFFIX>.md` with this frontmatter:

```yaml
---
suffix: SHORT-ID
title: One-line description
status: todo
plan: docs/plans/<the-plan>.md
depends_on: OTHER-SUFFIX   # optional — omit when the task stands alone
---
```

Keep suffixes unique, uppercase, and short (`RESTO-01`, `CART-02`, `AUTH-03`).

`depends_on` takes a single suffix and is enforced by step 2: the command refuses to start
until that task's `status` is `done`. Chain tasks by pointing each at its predecessor rather
than listing several dependencies.

## Current Tasks

| Suffix | Task | Depends on |
| --- | --- | --- |
| `RESTO-01` | Fetch and display restaurants | — |
| `MENU-01` | Fetch and display restaurant products (menu) | `RESTO-01` |
| `CART-01` | Add products to a cart and persist it in the backend | `MENU-01` |
| `ORDER-01` | Checkout — fee modals, payment method, order creation | `CART-01` |
