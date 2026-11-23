# Rulings

The deviation ledger, newest first. One dated heading per ruling: `## YYYY-MM-DD · Ruling · <task>`.

## 2026-11-23 · Ruling · retro ships with the plan

- `Ruling:` Human directive — plan retrospectives are written as the plan's **last task** and ship in the plan's **own PR**; no separate branch/PR just for retro work. Overrides the AGENTS.md sequencing that wrote the retro once after plan completion in a standalone PR (PR #55 was the last standalone retro PR).

## 2026-11-18 · Ruling · showcase deployment

- `Ruling:` Amended two specs marked "read-only records" in place (Oracle/k3s → Cloudflare Quick Tunnel) at the human's explicit request; changes are dated and link the new design.
- `Ruling:` Edited `platform/shell/config/remote-registry.json` (listed under "Do not touch") to root-relative URLs, required for hostname independence; the file remains hot-read and uncached.

## 2026-11-13 · Ruling · push rejected main commits

- `Ruling:` Orchestrator handled the git branch/push/PR mutations directly instead of dispatching subagents — state-changing git operations against repo-rule-protected `main` are too risky to delegate blind; info-gathering stayed within the 2-call direct allowance. Result: branch `chore/dependabot-security-only` pushed, PR #43 opened, local `main` reset to `origin/main`.

## 2026-11-08 · Ruling · dependabot PR repair

- `Ruling:` the 2026-11-08 AGENTS.md update routes mechanical work to dispatched subagents; this harness exposes no subagent tool, so steps ran inline on the controller.
