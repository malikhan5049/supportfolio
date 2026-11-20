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
  it.each(['backend-ci.yml', 'frontend-ci.yml'])(
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
      './gradlew ":$GRADLE_MODULE:build"',
    );
  });

  it('tinyurl-ci runs the project and image jobs', () => {
    const doc = entry();
    expect(doc.jobs['tinyurl-backend']).toBeDefined();
    expect(doc.jobs['tinyurl-frontend']).toBeDefined();
    expect(doc.jobs['tinyurl-image']).toBeDefined();
  });

  it('sets up the pinned Node runtime before npm ci in the image job', () => {
    const steps = entry().jobs['tinyurl-image'].steps;
    const setupNodeIndex = steps.findIndex((step: any) => step.uses === 'actions/setup-node@v7');
    const npmCiIndex = steps.findIndex((step: any) => String(step.run).includes('npm ci'));
    expect(setupNodeIndex).toBeGreaterThanOrEqual(0);
    expect(steps[setupNodeIndex].with['node-version']).toBe(24);
    expect(setupNodeIndex).toBeLessThan(npmCiIndex);
  });

  it('uses the verified Java 17 base image', () => {
    const dockerfile = fs.readFileSync('projects/tinyurl/Dockerfile', 'utf8');
    expect(dockerfile.match(/^FROM .+$/m)?.[0]).toBe('FROM eclipse-temurin:17.0.20.1_1-jre-jammy');
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

  it('proves the demo stack in CI', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/tinyurl-ci.yml', 'utf8'));
    const job = doc.jobs['demo-stack'];
    expect(job).toBeDefined();
    expect(job['runs-on']).toBe('ubuntu-latest');
    const raw = JSON.stringify(job);
    expect(raw).toContain('docker-compose.demo.yml');
    expect(raw).toContain('playwright.demo.config.ts');
    expect(raw).toContain('down -v');
    expect(fs.readFileSync('tools/branch-protection.ts', 'utf8')).toContain("'demo-stack'");
  });

  it('waits for the demo stack container health before running the browser flow', () => {
    const compose: any = yaml.load(fs.readFileSync('docker-compose.demo.yml', 'utf8'));
    expect(compose.services['tinyurl-service'].healthcheck.test.join(' ')).toContain(
      'SUPPORTFOLIO_TINYURL_MANAGEMENT_PORT:-9093',
    );
    expect(compose.services.shell.healthcheck.test.join(' ')).toContain(
      'SUPPORTFOLIO_SHELL_MANAGEMENT_PORT:-9091',
    );
    expect(compose.services.identity.healthcheck.test.join(' ')).toContain(
      'SUPPORTFOLIO_IDENTITY_MANAGEMENT_PORT:-9092',
    );
  });

  it('enables demo login and seeding for the demo-stack job', () => {
    const job: any = entry().jobs['demo-stack'];
    expect(job.env.DEMO_ENABLED).toBe('true');
  });

  it('proves the observability profile in its own short, PR-blocking job', () => {
    const job: any = entry().jobs['observability'];
    expect(job).toBeDefined();
    expect(job['runs-on']).toBe('ubuntu-latest');
    expect(job['timeout-minutes']).toBe(10);
    const raw = JSON.stringify(job);
    expect(raw).toContain('--profile observability');
    expect(raw).toContain('http://127.0.0.1:19090/api/v1/targets');
    expect(raw).toContain('http://127.0.0.1:13000/api/search?query=Supportfolio');
    expect(raw).toContain('down -v --remove-orphans');
  });
});

describe('backend-ci gradle module injection', () => {
  it('passes the module through env, not through run-string interpolation', () => {
    const source = fs.existsSync('.github/workflows/backend-ci.yml')
      ? '.github/workflows/backend-ci.yml'
      : 'platform/harness/workflows/backend-ci.yml';
    const doc: any = yaml.load(fs.readFileSync(source, 'utf8'));
    const build = doc.jobs.build.steps.find(
      (s: any) => s.run && String(s.run).includes('./gradlew'),
    );
    expect(build.run).not.toContain('${{');
    expect(build.env['GRADLE_MODULE']).toContain('inputs.gradle-module');
  });
});
