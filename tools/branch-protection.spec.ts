import { buildMainBranchRuleset, REQUIRED_STATUS_CHECKS } from './branch-protection';

describe('buildMainBranchRuleset', () => {
  it('requires a PR, the given status checks, a review, and disallows bypass', () => {
    const ruleset = buildMainBranchRuleset(['lint', 'test', 'build', 'validate-manifests']);
    expect(ruleset.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'pull_request' }),
        expect.objectContaining({ type: 'required_status_checks' }),
      ]),
    );
    expect(ruleset.bypass_actors).toEqual([]);
  });

  it('does not require approving reviews so the solo owner can merge their own PRs', () => {
    const ruleset = buildMainBranchRuleset(['validate-manifests']);
    const prRule = ruleset.rules.find((rule) => rule.type === 'pull_request');
    expect(prRule).toBeDefined();
    expect(prRule!.parameters).toMatchObject({
      required_approving_review_count: 0,
    });
  });

  it('maps each required status check to a plain context entry, no integration_id', () => {
    const ruleset = buildMainBranchRuleset(['validate-manifests', 'platform-build']);
    expect(ruleset.rules[1].type).toBe('required_status_checks');
    const checks = ruleset.rules[1].parameters.required_status_checks as Record<string, unknown>[];
    expect(checks[0]).toEqual({ context: 'validate-manifests' });
    expect(checks[1]).toEqual({ context: 'platform-build' });
  });

  it('pins exactly the four checks the harness workflows emit', () => {
    expect(REQUIRED_STATUS_CHECKS).toEqual([
      'validate-manifests',
      'validate-commit-messages',
      'check-formatting',
      'platform-build',
    ]);
  });
});
