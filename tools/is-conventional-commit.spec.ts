import { isConventionalCommit } from './is-conventional-commit';

describe('isConventionalCommit', () => {
  it('accepts "feat: add CardComponent"', () => {
    expect(isConventionalCommit('feat: add CardComponent')).toBe(true);
  });
  it('accepts "fix(shell): correct remote registry lookup"', () => {
    expect(isConventionalCommit('fix(shell): correct remote registry lookup')).toBe(true);
  });
  it('rejects "updated stuff"', () => {
    expect(isConventionalCommit('updated stuff')).toBe(false);
  });
});
