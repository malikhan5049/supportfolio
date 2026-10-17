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
