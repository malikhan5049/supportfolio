import { isConventionalCommit } from './is-conventional-commit';

describe('isConventionalCommit', () => {
  it('accepts "feat: add CardComponent"', () => {
    expect(isConventionalCommit('feat: add CardComponent')).toBe(true);
  });
  it('accepts "fix(shell): correct remote registry lookup"', () => {
    expect(isConventionalCommit('fix(shell): correct remote registry lookup')).toBe(true);
  });
  it('accepts "style: apply Spotless formatting to shared-spring-starter"', () => {
    expect(isConventionalCommit('style: apply Spotless formatting to shared-spring-starter')).toBe(
      true,
    );
  });
  it('accepts "build: package shell and identity images"', () => {
    expect(isConventionalCommit('build: package shell and identity images')).toBe(true);
  });
  it('accepts "perf: speed up link lookup"', () => {
    expect(isConventionalCommit('perf: speed up link lookup')).toBe(true);
  });
  it('accepts "revert: docs: add retrospective for showcase-deployment demo stack"', () => {
    expect(
      isConventionalCommit('revert: docs: add retrospective for showcase-deployment demo stack'),
    ).toBe(true);
  });
  it('rejects "updated stuff"', () => {
    expect(isConventionalCommit('updated stuff')).toBe(false);
  });
  it("rejects git's default 'Revert \"docs: add retrospective\"' message", () => {
    expect(isConventionalCommit('Revert "docs: add retrospective"')).toBe(false);
  });
});
