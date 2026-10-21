export const REQUIRED_STATUS_CHECKS = [
  'validate-manifests',
  'validate-commit-messages',
  'check-formatting',
  'platform-build',
  'frontend-build',
  'shell-e2e',
  'tinyurl-backend',
  'tinyurl-frontend',
  'tinyurl-image',
  'tinyurl-k3s-manifests',
  'tinyurl-arm-smoke',
];

export interface RepositoryRuleset {
  name: string;
  target: 'branch';
  enforcement: 'active' | 'disabled';
  bypass_actors: unknown[];
  conditions: {
    ref_name: {
      include: string[];
      exclude: string[];
    };
  };
  rules: Array<{
    type: string;
    parameters?: Record<string, unknown>;
  }>;
}

export function buildMainBranchRuleset(requiredStatusChecks: string[]): RepositoryRuleset {
  return {
    name: 'main-branch-protection',
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: {
      ref_name: {
        include: ['refs/heads/main'],
        exclude: [],
      },
    },
    rules: [
      {
        type: 'pull_request',
        parameters: {
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_approving_review_count: 0,
          required_review_thread_resolution: false,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: requiredStatusChecks.map((context) => ({ context })),
          strict_required_status_checks_policy: true,
        },
      },
    ],
  };
}
