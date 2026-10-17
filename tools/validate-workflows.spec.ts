import * as fs from 'fs';
import * as yaml from 'js-yaml';

describe('backend-ci.yml', () => {
  it('is valid YAML with a workflow_call trigger', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'));
    expect(doc.on.workflow_call.inputs['project-path']).toBeDefined();
  });
});

describe('frontend-ci.yml', () => {
  it('is valid YAML with a workflow_call trigger', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/frontend-ci.yml', 'utf8'));
    expect(doc.on.workflow_call.inputs['project-name']).toBeDefined();
  });
});

describe('apply-branch-protection.yml', () => {
  it('is valid YAML with a workflow_dispatch trigger and an apply job', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/apply-branch-protection.yml', 'utf8'));
    expect(doc.on.workflow_dispatch).toBeDefined();
    expect(doc.jobs.apply).toBeDefined();
  });
});
