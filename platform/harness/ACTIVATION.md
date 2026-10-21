# Activation runbook

One-time steps for the repo owner to activate this harness.

1. Fill `platform/harness/config/owner.json` with your GitHub username and regenerate `.github/CODEOWNERS` (`* @<username>`) to match.
2. Default branch was renamed `master` â†’ `main` on 2026-10-18. The ruleset target `refs/heads/main` is already correct.
3. Branch protection is applied **locally from the CLI**, not via a workflow â€” GITHUB_TOKEN cannot manage repository rulesets (GitHub grants no admin scope to it), so the old apply-branch-protection workflow was removed. It was applied once on 2026-10-19 (ruleset id 25437715, active). To re-apply after changing `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts`: generate the payload (`npx tsx -e` calling `buildMainBranchRuleset(REQUIRED_STATUS_CHECKS)`, entries WITHOUT `integration_id`), then `gh api repos/<owner>/<repo>/rulesets/<id> -X PUT --input ruleset.json` against the ruleset id from `gh api repos/<owner>/<repo>/rulesets` â€” POST creates a duplicate.
4. Enable secret scanning and push protection: **GitHub Settings â†’ Code security**. This is a repository setting with no file representation; see `GOVERNANCE.md`.
5. After the first real PR, verify the required check names in the ruleset match the actual check-run names GitHub reports. If they differ, adjust `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts` and re-apply via the CLI (step 3).
6. Dependabot activates automatically from `.github/dependabot.yml`; no action is needed.
7. After the first run of `.github/workflows/platform-ci.yml`, confirm GitHub reports the check-run name as `Platform CI / platform-build`; if it differs, adjust `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts` (step 5 rule) and re-apply via the CLI (step 3).
8. The ruleset also requires `frontend-build` and `shell-e2e` from `platform-ci.yml`. After their first run, verify the reported check names â€” `Platform CI / frontend-build` and `Platform CI / shell-e2e` â€” against GitHub's actual check-run names; if they differ, adjust `REQUIRED_STATUS_CHECKS` in `tools/branch-protection.ts` (step 5 rule) and re-apply via the CLI (step 3).
9. Harness workflows are mirrored: after editing a file under platform/harness/workflows/, run `npx tsx tools/sync-harness-workflows.ts` and commit both copies (the mirror under .github/workflows/ is generated output; validate-workflows.spec.ts fails on drift).
10. k3s check name: GitHub may report the k3s job as `tinyurl-k3s-manifests` (the job's `name:`) confirm against the first PR run's actual check-run names (step 5).

## TinyURL activation (Plan 4)

Deploy-ready means **reviewed, not executed** — nothing here touches a real cluster.

9. TinyURL's required checks are listed in `tools/branch-protection.ts`: `tinyurl-backend`, `tinyurl-frontend`, `tinyurl-image`, `tinyurl-k3s-manifests`, `tinyurl-arm-smoke`, `tinyurl-prod-login`. They become required when step 3's PUT re-applies the ruleset (ruleset id confirmed by the first PR run; confirm the check-run names per step 5).
10. The GHCR package (`tinyurl`) is free on this public repo; after the first `tinyurl-image` run, confirm the package visibility is public so the ARM smoke job works without extra credentials.
11. The ARM proof job runs on the free `ubuntu-24.04-arm` label (public repos, GA 2025-08-07). No paid runner is introduced.
12. Environment protection for `test`/`prod` is manual: the `deploy-test`/`deploy-prod` jobs in `.github/workflows/tinyurl-ci.yml` only execute when the repository variable `CD_ENABLED` equals `'true'`; leave it unset until the cluster/shell-packaging plan. When activating, set the environment reviewers (owner) on the `test`/`prod` GitHub environments by hand.
13. CI always runs the disposable k3s job (`tinyurl-k3s-manifests`) on the amd64 runner with a locally built image and dummy DB values; the shipped image is arm64 and proven separately by `tinyurl-arm-smoke`.
