# Harness Governance

This document is the committed, human-readable source of truth for every guardrail and policy the harness enforces.

## Human Gates

The harness implements the following pipeline with mandatory human gates.

| Stage | Gate | Purpose |
|-------|------|---------|
| Intake | — | Capture request as an Issue. |
| Spec | Mandatory gate | Define scope, acceptance criteria, and owner. |
| Design | Mandatory for project-sized work | Review architecture and risk before implementation. |
| Plan | Visible, approval optional | Publish the implementation plan; approval may be required by project policy. |
| Implement | — | Execute the plan under harness guardrails. |
| PR | Mandatory gate, never bypassable | Peer review; merge to `main` is the gate nothing may bypass. |
| CI | — | Automated build, test, and security checks. |
| Deploy to test | — | Deploy to a test environment for validation. |
| Promote to prod | Mandatory gate, never bypassable | Manual approval before production promotion; nothing may bypass, including the admin account. |
| Telemetry | — | Observe behavior and feed findings back to Intake. |

## Guardrails

- Merge-to-`main` and promote-to-prod are the two gates nothing may bypass, including the admin account itself.
- Branch protection is enabled for `main` with required status checks before merge.
- Least-privilege self-hosted runner: runners receive only the permissions and secrets required for their workflow.
- One agentic change in flight per project: concurrency controls prevent overlapping autonomous changes.
- Secret scanning and push protection are enabled to block committed secrets.
- Secret scanning and push protection are configured as a one-time manual step under the repository's Settings → Code security; this is a GitHub repository setting with no file representation.
- Dependency and CVE scanning gate: a failed scan blocks promotion.
- Build provenance is generated toward SLSA Build L2 for every release artifact.
- Rollback-by-default via immutable images: deployed images are immutable and the harness defaults to rolling back on failure.
- Spend cap: only manifest-declared resources may be provisioned.
- Full audit trail: every change links Issue → Plan → PR → workflow run.

## Policies

- No direct pushes to `main`: all changes must arrive through a pull request.
- Every change traces to exactly one Issue.
- Lint is a merge gate: code must pass linting before merge.
- Exposed modules follow semantic versioning.
- Auth, input, or secret-touching PRs must include an OWASP checklist item.
- Admin is hardcoded to the repo owner with an explicit user allowlist.
- No PII in logs or telemetry.
- Docs are updated in the same PR that changes what they document.
