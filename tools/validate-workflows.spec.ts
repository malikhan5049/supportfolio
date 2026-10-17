import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe('backend-ci.yml', () => {
  it('is valid YAML with a workflow_call trigger', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'));
    expect(doc.on.workflow_call.inputs['project-path']).toBeDefined();
  });

  it('serializes runs per project-path', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'));
    expect(doc.concurrency.group).toContain('${{ inputs.project-path }}');
  });
});

describe('frontend-ci.yml', () => {
  it('is valid YAML with a workflow_call trigger', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/frontend-ci.yml', 'utf8'));
    expect(doc.on.workflow_call.inputs['project-name']).toBeDefined();
  });

  it('serializes runs per project-name', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/frontend-ci.yml', 'utf8'));
    expect(doc.concurrency.group).toContain('${{ inputs.project-name }}');
  });
});

describe('apply-branch-protection.yml', () => {
  it('is valid YAML with a workflow_dispatch trigger and an apply job', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/apply-branch-protection.yml', 'utf8'));
    expect(doc.on.workflow_dispatch).toBeDefined();
    expect(doc.jobs.apply).toBeDefined();
  });
});

describe('dependabot.yml', () => {
  it('is valid YAML with npm and gradle update configs', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/dependabot.yml', 'utf8'));
    const ecosystems = doc.updates.map(u => u['package-ecosystem']);
    expect(ecosystems).toEqual(expect.arrayContaining(['npm', 'gradle']));
  });
});
