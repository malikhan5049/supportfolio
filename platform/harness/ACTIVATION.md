# Activation runbook

One-time steps for the repo owner to activate this harness.

1. Fill `platform/harness/config/owner.json` with your GitHub username and regenerate `.github/CODEOWNERS` (`* @<username>`) to match.
2. Default branch was renamed `master` → `main` on 2026-10-18. The ruleset target `refs/heads/main` is already correct.
3. Branch protection is applied **locally from the CLI**, not via a workflow — GITHUB_TOKEN cannot manage repository rulesets (GitHub grants no admin scope to it), so the old apply-branch-protection workflow was removed. It was applied once on 2026-10-19 (ruleset id 25437715, active). To re-apply after changing `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts`: generate the payload (`npx tsx -e` calling `buildMainBranchRuleset(REQUIRED_STATUS_CHECKS)`, entries WITHOUT `integration_id`), then `gh api repos/<owner>/<repo>/rulesets/<id> -X PUT --input ruleset.json` against the ruleset id from `gh api repos/<owner>/<repo>/rulesets` — POST creates a duplicate.
4. Enable secret scanning and push protection: **GitHub Settings → Code security**. This is a repository setting with no file representation; see `GOVERNANCE.md`.
5. After the first real PR, verify the required check names in the ruleset match the actual check-run names GitHub reports. If they differ, adjust `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts` and re-apply via the CLI (step 3).
6. Dependabot activates automatically from `.github/dependabot.yml`; no action is needed.
7. After the first run of `.github/workflows/platform-ci.yml`, confirm GitHub reports the check-run name as `Platform CI / platform-build`; if it differs, adjust `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts` (step 5 rule) and re-apply via the CLI (step 3).
8. The ruleset also requires `frontend-build` and `shell-e2e` from `platform-ci.yml`. After their first run, verify the reported check names — `Platform CI / frontend-build` and `Platform CI / shell-e2e` — against GitHub's actual check-run names; if they differ, adjust `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts` (step 5 rule) and re-apply via the CLI (step 3).
7. Harness workflows are mirrored: after editing a file under platform/harness/workflows/, run `npx tsx tools/sync-harness-workflows.ts` and commit both copies (the mirror under .github/workflows/ is generated output; validate-workflows.spec.ts fails on drift).
