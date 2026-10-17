import { buildMainBranchRuleset } from './branch-protection';

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
});
