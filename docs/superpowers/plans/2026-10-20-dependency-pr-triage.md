# Dependency-PR Triage Plan (5 Open PRs)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock and land all 5 open PRs (4 Dependabot + 1 human) by fixing the systemic CI blocker, then merge them in a safe order with real verification.

**Architecture:** All 5 PRs fail for one shared reason — the `validate-commit-messages` workflow validates every commit in `base..head`, and every branch contains a `Merge branch 'main' into ...` commit (created by Dependabot sync and the strict up-to-date ruleset policy), whose subject can never match the Conventional-Commit regex. Fix the validator once (Task 1), then merge the dependency PRs in dependency-safe order (Tasks 2–3), land the human PR (Task 4), and sweep (Task 5).

**Tech Stack:** GitHub Actions, Dependabot (npm + gradle ecosystems), Nx/Angular 22, Gradle (JDK 17), `gh` CLI.

**Spec:** No design doc — this plan is driven by direct investigation on 2026-10-20:
- PRs: #8 (mockwebserver 4.12.0→5.5.0, gradle), #9 (angular group, 12 updates), #10 (jest group, 2 updates), #11 (@schematics/angular 22.1.9→22.2.3), #13 (human, branch-protection harness fix).
- CI logs: failing check on every PR is `validate-commit-messages`; failing subject is always `Merge branch 'main' into <branch>` (e.g. run 39426496337, commit `fc60ec4`; PR #13's `c0e4016`). All other checks pass or are in progress.
- Ruleset (`tools/branch-protection.ts`): requires `validate-manifests`, `validate-commit-messages`, `check-formatting`, `platform-build`; `strict_required_status_checks_policy: true` (branches must be up to date with main); `required_approving_review_count: 0`; no bypass actors (even admins go through PRs).
- Note: the user described "5 PRs by dependabot" — PR #13 is by @malikhan5049 (human). It is included here as Task 4 because it is blocked by the same systemic failure.

## Global Constraints

- Every commit and PR title must match `^(feat|fix|docs|style|chore|refactor|test|ci)(\([a-z0-9-]+\))?: .+` (enforced by `.github/workflows/validate-commit-messages.yml` + `tools/is-conventional-commit.ts`).
- `main` requires all 4 checks green AND the branch up to date with `main` before merge; no approvals needed; no bypass actors.
- Never force-push a Dependabot branch manually — use a `@dependabot rebase` comment (Dependabot maintains its branches).
- All npm PRs touch `package.json` + `package-lock.json`; only one may merge at a time, with a rebase of the rest in between.
- PR #9 (angular group → 22.2.x) and PR #11 (@schematics/angular → 22.2.3) are version-locked to each other; they must both land, in that order.
- `platform-build` only runs `./gradlew build` — it does NOT run JS tests. Frontend verification for npm PRs must be run locally (Task 2).
- Merge method for all PRs: regular merge via `gh pr merge --merge` (merge commits created by GitHub on main are never re-validated).

## Review Focus

- **Merge commits in PR history** — expect them to be skipped by validation, not fail it. Pinned in Task 1 Step 2 (local re-run of the validator against a dependabot ref before/after the fix).
- **Lockfile drift across the npm trio** — expect `npm ci` to resolve cleanly after each merge+rebase. Pinned by `npm ci` in every Task 2 verification step.
- **MockWebServer 5 on a test classpath next to okhttp 4.x runtime expectations** — expect `:platform:identity:test` to pass unchanged (legacy `okhttp3.mockwebserver` package survives in the 5.x classic artifact). Pinned by Task 3 Step 2.
- **Angular 22.1→22.2 minor bump breaking templates/AOT that Jest unit tests don't compile** — expect angular-eslint (lint target) plus unit tests to catch it. Pinned by Task 2's `nx run-many -t lint test`.
- **PR #13 removing a workflow that the merge sequence depends on** — expect branch protection on `main` to still be active after #13 merges. Pinned by Task 4 Step 3.

---

### Task 1: Fix the validator to skip merge commits (unblocks all 5 PRs)

**Files:**
- Modify: `.github/workflows/validate-commit-messages.yml` (the `git rev-list` line inside the `npx tsx -e` script)
- Modify: `.github/dependabot.yml` (add `rebase-strategy` to both update entries)

**Interfaces:**
- Consumes: existing `isConventionalCommit(message: string): boolean` from `tools/is-conventional-commit.ts` — unchanged.
- Produces: `validate-commit-messages` check that passes any PR whose non-merge commits are conventional, regardless of merge commits in its history. Tasks 2–4 rely on this.

- [ ] **Step 1: Reproduce the failure locally (failing state documented)**

Run the validator's own logic against a dependabot ref:

```bash
git fetch origin main dependabot/npm_and_yarn/angular-58d66eb628
npx tsx -e "
import { isConventionalCommit } from './tools/is-conventional-commit.ts';
import { execSync } from 'child_process';
const shas = execSync('git rev-list --reverse origin/main..origin/dependabot/npm_and_yarn/angular-58d66eb628', { encoding: 'utf8' }).split('\n').filter(Boolean);
let failed = false;
for (const sha of shas) {
  const message = execSync('git log -1 --format=%B ' + sha, { encoding: 'utf8' }).trimEnd();
  if (!isConventionalCommit(message)) { console.error('Non-conventional commit ' + sha + ': ' + message.split('\n')[0]); failed = true; }
}
process.exit(failed ? 1 : 0);
"
```

Expected: FAIL, flagging `Merge branch 'main' into dependabot/...`.

- [ ] **Step 2: Add `--no-merges` to the workflow's rev-list**

In `.github/workflows/validate-commit-messages.yml`, change:

```
git rev-list --reverse ${base}..${head}
```
to:
```
git rev-list --no-merges --reverse ${base}..${head}
```

(One flag: merge commits are excluded from validation; ordinary commits on both sides of a merge are still validated.)

- [ ] **Step 3: Prevent Dependabot from creating future merge commits**

In `.github/dependabot.yml`, add to each of the two `updates:` entries (npm and gradle):

```yaml
    rebase-strategy: "rebase"
```

- [ ] **Step 4: Re-run the Step 1 command**

Expected: PASS (exit 0, merge commit skipped). The only Dependabot-authored commit (`chore(deps): bump the angular group...`) is conventional.

- [ ] **Step 5: Commit and open the fix PR**

```bash
git checkout -b fix/validator-skip-merge-commits origin/main
# ... make the two edits ...
git add .github/workflows/validate-commit-messages.yml .github/dependabot.yml
git commit -m "fix(ci): skip merge commits in commit-message validation"
git push -u origin fix/validator-skip-merge-commits
gh pr create --title "fix(ci): skip merge commits in commit-message validation" --fill
```

Expected: all 4 required checks green on the PR (fresh branch off main, its own commit is conventional). Merge: `gh pr merge --merge --delete-branch`.

---

### Task 2: Verify and merge the npm trio (#9 angular group → #11 schematics → #10 jest group)

**Files:**
- No repo files edited. Merges PRs #9, #11, #10 in order, with Dependabot rebasing between merges.

**Interfaces:**
- Consumes: Task 1's fixed `validate-commit-messages` check on `main`.
- Produces: `main` with Angular 22.2.x, @schematics/angular 22.2.3, jest group current; Dependabot PR queue empty for npm.

- [ ] **Step 1: Verify PR #9 locally (angular group)**

```bash
git fetch origin pull/9/head:pr-9 && git checkout pr-9 && npm ci
npx nx run-many -t lint test
```

Expected: `npm ci` resolves; lint + test pass for `shared-ui-lib` and the project-scaffold generator.

- [ ] **Step 2: Merge PR #9**

```bash
gh pr checks 9   # all green (post-Task-1 rebase)
gh pr merge 9 --merge
```

If #9 still shows the old red run, first comment `@dependabot rebase` and wait for green checks.

- [ ] **Step 3: Rebase and verify PR #11 (@schematics/angular)**

```bash
gh pr comment 11 --body "@dependabot rebase"
# wait for Dependabot to rebase (diff should shrink to only @schematics/angular) and checks to go green
git fetch origin pull/11/head:pr-11 && git checkout pr-11 && npm ci && npx nx run-many -t lint test
```

Expected: green; then `gh pr merge 11 --merge`.

- [ ] **Step 4: Rebase and verify PR #10 (jest group)**

```bash
gh pr comment 10 --body "@dependabot rebase"
# wait for green
git fetch origin pull/10/head:pr-10 && git checkout pr-10 && npm ci && npx nx run-many -t lint test
```

Expected: green; then `gh pr merge 10 --merge`.

- [ ] **Step 5: Confirm main is green after the trio**

```bash
git checkout main && git pull && gh run list --branch main --limit 3
```

Expected: latest `Platform CI` and `Check formatting` runs on main succeeded.

---

### Task 3: Decide PR #8 — MockWebServer 4.12.0 → 5.5.0 (major, gradle)

**Files:**
- Modified by the PR itself: `platform/identity/build.gradle.kts:12` (testImplementation `com.squareup.okhttp3:mockwebserver:5.5.0`)
- Potentially (only if migration is needed): `platform/identity/src/test/java/com/supportfolio/platform/identity/IdentityFlowIntegrationTest.java`, `platform/identity/src/test/java/com/supportfolio/platform/identity/provider/GitHubIdentityProviderTest.java` (both use legacy `okhttp3.mockwebserver.*` imports)
- Potentially (rejection path): `.github/dependabot.yml`

**Interfaces:**
- Consumes: Task 1's fixed validator.
- Produces: decision recorded — either MockWebServer 5.5.0 merged with tests passing, or PR #8 closed with a pinned ignore in dependabot.yml.

- [ ] **Step 1: Rebase PR #8 so checks re-run with the fixed validator**

```bash
gh pr comment 8 --body "@dependabot rebase"
```

Expected: rebase succeeds; `platform-build` re-runs. Note: the legacy `okhttp3.mockwebserver` package still exists in the 5.x classic artifact, so compilation is expected to pass unchanged.

- [ ] **Step 2: Run the identity tests locally on the PR branch**

```bash
git fetch origin pull/8/head:pr-8 && git checkout pr-8
./gradlew :platform:identity:test
```

Expected: PASS. If PASS → merge: `gh pr merge 8 --merge` and skip Steps 3–4.

- [ ] **Step 3 (only if tests fail): Migrate the two test files to the new behavior**

Keep changes minimal and behavioral — adapt imports/usage to MockWebServer 5 semantics, do not weaken assertions. Commit on the PR branch via a new commit: `test(identity): adapt tests to MockWebServer 5` and let CI re-run.
Decision gate: if the migration exceeds ~30 lines or would change what the tests verify, take Step 4 instead.

- [ ] **Step 4 (rejection path): Close the PR and pin the major**

```bash
gh pr close 8 --comment "Major bump deferred; see plan 2026-10-20-dependency-pr-triage"
```

Then on a new branch off main, add to the gradle `updates:` entry in `.github/dependabot.yml`:

```yaml
    ignore:
      - dependency-name: "com.squareup.okhttp3:mockwebserver"
        versions: ["5.x"]
```

Commit: `chore(deps): ignore mockwebserver 5.x major bump`, open PR, verify green, merge.

---

### Task 4: Rebase and merge PR #13 (human — branch-protection harness fix)

**Files:**
- PR #13's own files (no edits by this plan): `.github/workflows/apply-branch-protection.yml`, `platform/harness/ACTIVATION.md`, `tools/branch-protection.spec.ts`, `tools/branch-protection.ts`, `tools/validate-workflows.spec.ts`

**Interfaces:**
- Consumes: Task 1's fixed validator (merge commits no longer fail).
- Produces: `main` with the harness fix; branch protection still active afterwards.

- [ ] **Step 1: Confirm the failure was only the merge commit**

PR #13's authored commit `9082a19 fix: make branch protection CLI-applied, remove undispensable workflow` is already conventional; the sole offender was merge commit `c0e4016`. After Task 1, comment on the PR or use the "Update branch" button to refresh checks.

- [ ] **Step 2: Review the diff once with the removal in mind**

Verify the removed workflow is `apply-branch-protection.yml` (redundant once protection is CLI-applied) and that none of the 4 required-check workflows are touched.

```bash
gh pr diff 13 --name-only
```

Expected: only the five files listed above; `platform-ci.yml`, `check-formatting.yml`, `validate-commit-messages.yml`, `validate-manifests.yml` untouched.

- [ ] **Step 3: Merge, then verify branch protection is still active**

```bash
gh pr checks 13 && gh pr merge 13 --merge
gh api repos/{owner}/{repo}/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'
```

Expected: merge succeeds; the `main-branch-protection` ruleset is listed with enforcement `active`.

---

### Task 5: Post-merge sweep

**Files:** none (verification only).

- [ ] **Step 1: Confirm zero open PRs and a green main**

```bash
gh pr list --state open
git checkout main && git pull
gh run list --branch main --limit 5
```

Expected: no open PRs; all recent main runs succeeded.

- [ ] **Step 2: Confirm Dependabot has nothing stale pending**

```bash
gh pr list --author app/dependabot --state all --limit 8
```

Expected: no Dependabot PR remains open or shows a rebase-in-progress label; the four dependency PRs show as merged (or #8 as closed). If any PR is stuck in "rebase in progress", wait for the next Dependabot run or comment `@dependabot rebase` once more.

- [ ] **Step 3: Record the outcome**

Append one row per merged PR to the Dispatch Ledger below (task, phase, shape, model, why, outcome, retries).

## Dispatch Ledger

| Task | Phase | Shape | Model | Why | Outcome (tests/build) | Retries/escalation |
|---|---|---|---|---|---|---|
| 1. Fix validator to skip merge commits | 5 Build | Low (1-line CI config + 2-line dependabot.yml) | glm-5.3-flash (session) | Operational unblock for all 5 PRs | Local validator RED→GREEN; PR #14 CI 4/4 pass; merged b15c45b | 0 |
| 1b. Revert invalid rebase-strategy | 5 Build | Low (2-line revert) | glm-5.3-flash (session) | Dependabot schema rejects "rebase" | PR #15 CI 4/4 pass; merged 5f5e91a | 0 (found during Task 2, fixed in one pass) |
| 2. Merge npm trio #9/#11/#10 | 5 Build | Medium (ordered merges, conflict cycles) | glm-5.3-flash (session) | Version-locked angular/schematics; shared lockfile | Per-PR: npm ci + nx lint/test 3/3 pass; CI 4/4 green; merged ed6725b, 9444762, 872a20e | @dependabot recreate ×3 (human-edited branches + lockfile conflicts) |
| 3. MockWebServer 5 bump #8 | 5 Build | Low (test-dep bump, verified) | glm-5.3-flash (session) | Major bump needs runtime proof | ./gradlew :platform:identity:test BUILD SUCCESSFUL; CI 4/4 green; merged eae83b2 | 0 |
| 4. Harness fix #13 | 6 Review | Low (5 files, guarded) | glm-5.3-flash (session) | Human PR blocked by same validator bug | Tool specs 12/12 local; diff audit clean; ruleset active post-merge; merged 413a577 | 0 |
| 5. Sweep + ledger | 7 Finalize | Low (verification only) | glm-5.3-flash (session) | Confirm end state | 0 open PRs; main runs green (see ledger note) | 0 |
| *(controller appends one row per task at execution time)* | | | | | | |
