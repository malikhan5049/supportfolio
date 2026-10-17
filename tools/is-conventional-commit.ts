const CONVENTIONAL_COMMIT_RE = /^(feat|fix|docs|chore|refactor|test|ci)(\([a-z0-9-]+\))?: .+/;

export function isConventionalCommit(message: string): boolean {
  const firstLine = message.split(/\r?\n/)[0] ?? '';
  return CONVENTIONAL_COMMIT_RE.test(firstLine);
}
