import { buildMainBranchRuleset } from './branch-protection';

describe('buildMainBranchRuleset', () => {
  it('requires a PR, the given status checks, a review, and disallows bypass', () => {
    const ruleset = buildMainBranchRuleset(['lint', 'test', 'build', 'validate-manifests']);
    expect(ruleset.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'pull_request' }),
      expect.objectContaining({ type: 'required_status_checks' }),
    ]));
    expect(ruleset.bypass_actors).toEqual([]);
  });
});
