# Retro action register

## Open actions

| ID | Action | Owner | Opened | Done when | Carried | Status |
|---|---|---|---|---|---|---|
| RA-001 | Check for bash on the Windows host before choosing a superpowers script, and record the manual fallback in the plan | controller | 2026-11-20 | the plan template names the Windows fallback | 0 | open |
| RA-002 | Build the identity and shell images in the PR-blocking CI job (Plan 6 final-review Critical; the record does not state the fix landed) | controller | 2026-11-20 | the PR job builds both images on every run | 0 | open |

## Active practices

| ID | Practice | Source | Since | Status |
|---|---|---|---|---|
| RP-001 | Recon before design: read the files and probe the runtime a plan will touch before drafting tasks | Plan 6 | 2026-11-20 | active |
| RP-002 | Deep review mandated for high-shape service/auth/CI changes, every Critical/Important finding closed through a RED→GREEN regression and one fix pass | Plan 3 | 2026-10-20 | active |
| RP-003 | Verify against the artifact that runs: `npx nx build` for touched UI, one browser E2E for new runtime behaviour, and the required checks green on the PR | Plan 3 | 2026-10-20 | active |

## Closed and dropped actions

| ID | Outcome | Date | Evidence or reason |
|---|---|---|---|
| RA-003 | closed | 2026-10-20 | `PR #17` — the Playwright E2E for dynamic remote loading merged with it, and `d45ad78` fixed the defect it caught |
| RA-004 | closed | 2026-10-24 | `PR #20` — missing Postgres manifests and hosted-runner assumptions fixed; the final hosted run passed |
| RA-005 | closed | 2026-11-08 | `PR #24` — explicit `okhttp:5.5.1` beside `mockwebserver:5.5.1` in the two BOM-importing modules |
| RA-006 | closed | 2026-11-22 | `AGENTS.md` — "Integration config (gateway yaml, MF) in smallest verifiable increments" |

## Retired practices

| ID | Retired | Reason |
|---|---|---|
| RP-004 | 2026-10-20 | superseded by RP-003 — the production build and browser E2E replaced the Jest-only close |
| RP-005 | 2026-10-24 | superseded by RP-003 — the plan waits for the required checks on its PR |
| RP-006 | 2026-11-20 | superseded by RP-001 — recon reads the files a plan snippet would touch before the snippet is drafted |
