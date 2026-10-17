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
          required_approving_review_count: 1,
          required_review_thread_resolution: false,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: requiredStatusChecks.map((context) => ({
            context,
            integration_id: null,
          })),
          strict_required_status_checks_policy: true,
        },
      },
    ],
  };
}
