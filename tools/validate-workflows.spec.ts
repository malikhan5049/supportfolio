import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe('backend-ci.yml', () => {
  it('is valid YAML with a workflow_call trigger', () => {
    const doc: any = yaml.load(
      fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'),
    );
    expect(doc.on.workflow_call.inputs['project-path']).toBeDefined();
  });

  it('serializes runs per project-path', () => {
    const doc: any = yaml.load(
      fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'),
    );
    expect(doc.concurrency.group).toContain('${{ inputs.project-path }}');
  });
});

describe('frontend-ci.yml', () => {
  it('is valid YAML with a workflow_call trigger', () => {
    const doc: any = yaml.load(
      fs.readFileSync('platform/harness/workflows/frontend-ci.yml', 'utf8'),
    );
    expect(doc.on.workflow_call.inputs['project-name']).toBeDefined();
  });

  it('serializes runs per project-name', () => {
    const doc: any = yaml.load(
      fs.readFileSync('platform/harness/workflows/frontend-ci.yml', 'utf8'),
    );
    expect(doc.concurrency.group).toContain('${{ inputs.project-name }}');
  });
});

describe('dependabot.yml', () => {
  it('is valid YAML with npm and gradle update configs', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/dependabot.yml', 'utf8'));
    const ecosystems = doc.updates.map((u) => u['package-ecosystem']);
    expect(ecosystems).toEqual(expect.arrayContaining(['npm', 'gradle']));
  });
});

describe('validate-commit-messages.yml', () => {
  it('is valid YAML with a pull_request trigger and a validation job', () => {
    const doc: any = yaml.load(
      fs.readFileSync('.github/workflows/validate-commit-messages.yml', 'utf8'),
    );
    expect(doc.on.pull_request).toBeDefined();
    expect(doc.jobs['validate-commit-messages']).toBeDefined();
    expect(doc.jobs['validate-commit-messages'].steps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('platform-ci.yml', () => {
  it('is valid YAML that builds platform modules', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/platform-ci.yml', 'utf8'));
    expect(doc.jobs['platform-build']).toBeDefined();
    expect(doc.jobs['platform-build'].steps.map((s) => s.run)).toEqual(
      expect.arrayContaining([expect.stringContaining('./gradlew build')]),
    );
  });

  it('runs the frontend build and the shell e2e', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/platform-ci.yml', 'utf8'));
    expect(doc.jobs['frontend-build']).toBeDefined();
    expect(doc.jobs['shell-e2e']).toBeDefined();
    expect(doc.jobs['shell-e2e'].steps.map((s: any) => s.run)).toEqual(
      expect.arrayContaining([expect.stringContaining('playwright install')]),
    );
  });

  it('branch protection requires the new checks', () => {
    const source = fs.readFileSync('tools/branch-protection.ts', 'utf8');
    expect(source).toContain("'frontend-build'");
    expect(source).toContain("'shell-e2e'");
  });
});
