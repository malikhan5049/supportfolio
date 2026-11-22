# <Plan title>

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** YYYY-MM-DD
**Branch:** feat/<slug>
**Goal:** <one sentence — what this plan makes true>
**Spec:** docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md

## Global Constraints

- <standing rule every task obeys — platform, toolchain, environment>
- Conventional commits; every change ships as a pull request — never commit to `main`.
- Historical plans, specs, and retrospectives are read-only records (amended only with a dated note when explicitly approved).
- <verification command that must stay green from the first task to the last>

## Retrospective compliance

Brief run: YYYY-MM-DD (`npx tsx tools/retro-brief.ts`)

| ID | Kind | Disposition | Where |
|---|---|---|---|
| RA-001 | action | applied | Task 3 |
| RA-002 | action | deferred — outside this plan's scope | — |

The two rows above are examples: replace them with every RA/RP open on the plan date — `applied` names the task that carries it, `deferred` requires a reason.

## Tasks

### Task N: <imperative title>

**Files:** Create `<path>`; modify `<path>`.

**Interfaces:**
- Consumes: <artifact, format, or function from an earlier task>
- Produces: <artifact, format, or function later tasks rely on>

- [ ] **Step 1: <write the failing test / first change>** — what, where, expected result.
- [ ] **Step 2: Run it, expect <FAIL|PASS>** — `<command>` → `<expected output>`.
- [ ] **Step 3: <implement>** — behavior and edge cases.
- [ ] **Step 4: Verify** — `<command>` → `<expected output>`.
- [ ] **Step 5: Commit** — `git add <paths> && git commit -m "<type>(<scope>): <subject>"`

## Dispatch Ledger

One row per task, added as the task completes. `Lesson` is optional: one sentence on what the next plan should do differently.

| Task | Status | Notes | Lesson |
|---|---|---|---|
| 1 | done | <commit, deviation> | <one-line lesson> |
| 2 | done | <commit, deviation> | — |
