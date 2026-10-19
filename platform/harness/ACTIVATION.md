# Activation runbook

One-time steps for the repo owner to activate this harness.

1. Fill `platform/harness/config/owner.json` with your GitHub username and regenerate `.github/CODEOWNERS` (`* @<username>`) to match.
2. Default branch was renamed `master` → `main` on 2026-10-18. The ruleset target `refs/heads/main` is already correct.
3. Dispatch `.github/workflows/apply-branch-protection.yml` exactly **once**. Re-dispatching duplicates the ruleset because the POST is not idempotent. If GitHub returns `422` on `integration_id: null`, remove that key from `tools/branch-protection.ts` and re-dispatch.
4. Enable secret scanning and push protection: **GitHub Settings → Code security**. This is a repository setting with no file representation; see `GOVERNANCE.md`.
5. After the first real PR, verify the required check names in the ruleset match the actual check-run names GitHub reports. Adjust the list in `apply-branch-protection.yml` if they differ.
6. Dependabot activates automatically from `.github/dependabot.yml`; no action is needed.
7. After the first run of `.github/workflows/platform-ci.yml`, refresh the ruleset **manually** via GitHub Settings → Rules → Rulesets — do not re-dispatch `apply-branch-protection.yml` (the POST is not idempotent and would duplicate the ruleset). Confirm GitHub reports the check-run name as `Platform CI / platform-build`; if it differs, adjust the array in `apply-branch-protection.yml` (step 5 rule).
