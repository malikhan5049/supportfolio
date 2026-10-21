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

describe('harness workflow mirrors', () => {
  it.each(['backend-ci.yml', 'frontend-ci.yml', 'deploy.yml'])(
    'mirrors %s at the top level for GitHub to register it',
    (name) => {
      expect(fs.readFileSync(`.github/workflows/${name}`, 'utf8')).toBe(
        fs.readFileSync(`platform/harness/workflows/${name}`, 'utf8'),
      );
    },
  );

  it('the sync script only copies byte-for-byte and fails when a canonical file is missing', () => {
    const source = fs.readFileSync('tools/sync-harness-workflows.ts', 'utf8');
    expect(source).toContain('.github/workflows');
    expect(source).toContain('platform/harness/workflows');
  });
});

describe('deploy.yml', () => {
  it('is a reusable workflow with an environment input and a protected job', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/deploy.yml', 'utf8'));
    expect(doc.on.workflow_call.inputs.environment).toBeDefined();
    expect(doc.jobs.deploy.environment).toContain('inputs.environment');
    expect(doc.jobs.deploy.steps.map((s: any) => s.run).join('\n')).toContain('kubectl apply');
  });

  it('carries the tinyurl namespace/manifest defaults and the kubeconfig secret', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/deploy.yml', 'utf8'));
    expect(doc.on.workflow_call.inputs.namespace.default).toBe('tinyurl');
    expect(doc.on.workflow_call.inputs['manifests-path'].default).toBe('projects/tinyurl/deploy');
    expect(doc.on.workflow_call.secrets.KUBECONFIG).toBeDefined();
  });
});

describe('tinyurl-ci.yml', () => {
  function entry(): any {
    return yaml.load(fs.readFileSync('.github/workflows/tinyurl-ci.yml', 'utf8'));
  }

  it('backend-ci builds a composite subproject by gradle module', () => {
    const doc: any = yaml.load(
      fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'),
    );
    expect(doc.on.workflow_call.inputs['gradle-module']).toBeDefined();
    expect(doc.jobs.build.steps.map((s: any) => s.run).join('\n')).toContain(
      './gradlew :${{ inputs.gradle-module }}:build',
    );
  });

  it('tinyurl-ci runs the project and image jobs', () => {
    const doc = entry();
    expect(doc.jobs['tinyurl-backend']).toBeDefined();
    expect(doc.jobs['tinyurl-frontend']).toBeDefined();
    expect(doc.jobs['tinyurl-image']).toBeDefined();
  });

  it('the image is arm64, attested, and tagged with the commit sha', () => {
    const raw = JSON.stringify(entry().jobs['tinyurl-image']);
    expect(raw).toContain('linux/arm64');
    expect(raw).toContain('provenance');
    expect(raw).toContain('github.sha');
  });

  it('branch protection requires the tinyurl checks', () => {
    const source = fs.readFileSync('tools/branch-protection.ts', 'utf8');
    for (const check of ['tinyurl-backend', 'tinyurl-frontend', 'tinyurl-image'])
      expect(source).toContain(`'${check}'`);
  });

  it('the branch-protection spec asserts the current full list, not the Plan 1 four', () => {
    const spec = fs.readFileSync('tools/branch-protection.spec.ts', 'utf8');
    expect(spec).toContain("'tinyurl-image'");
    expect(spec).toContain("'shell-e2e'");
  });

  it('formatting covers projects/', () => {
    expect(fs.readFileSync('.github/workflows/check-formatting.yml', 'utf8')).toContain(
      'projects/**',
    );
  });

  it('no path filter keeps the required checks on every PR', () => {
    const text = fs.readFileSync('.github/workflows/tinyurl-ci.yml', 'utf8');
    expect(text).not.toMatch(/paths:/);
  });

  it('executes the manifests on a disposable k3s, not just lints them', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/tinyurl-ci.yml', 'utf8'));
    const raw = JSON.stringify(doc.jobs['tinyurl-k3s-manifests']);
    expect(raw).toContain('k3s');
    expect(raw).toContain('kubectl apply');
    expect(raw).toContain('rollout status');
    expect(raw).toContain('pg_isready');
    expect(raw).toContain('get pvc');
    expect(fs.readFileSync('tools/branch-protection.ts', 'utf8')).toContain(
      "'tinyurl-k3s-manifests'",
    );
  });
});
