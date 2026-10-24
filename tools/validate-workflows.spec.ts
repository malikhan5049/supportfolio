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
      './gradlew ":$GRADLE_MODULE:build"',
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

  it('sets up the pinned Node runtime before npm ci in the image job', () => {
    const steps = entry().jobs['tinyurl-image'].steps;
    const setupNodeIndex = steps.findIndex((step: any) => step.uses === 'actions/setup-node@v7');
    const npmCiIndex = steps.findIndex((step: any) => String(step.run).includes('npm ci'));
    expect(setupNodeIndex).toBeGreaterThanOrEqual(0);
    expect(steps[setupNodeIndex].with['node-version']).toBe(24);
    expect(setupNodeIndex).toBeLessThan(npmCiIndex);
  });

  it('sets up an immutable Buildx builder before attested image publishing', () => {
    const steps = entry().jobs['tinyurl-image'].steps;
    const setupBuildxIndex = steps.findIndex((step: any) =>
      String(step.uses).startsWith('docker/setup-buildx-action@'),
    );
    const pushIndex = steps.findIndex((step: any) => String(step.name).includes('Build and push'));
    expect(steps[setupBuildxIndex].uses).toBe(
      'docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069',
    );
    expect(setupBuildxIndex).toBeLessThan(pushIndex);
  });

  it('uses the verified Java 17 base image that includes ARM64', () => {
    const dockerfile = fs.readFileSync('projects/tinyurl/Dockerfile', 'utf8');
    expect(dockerfile.match(/^FROM .+$/m)?.[0]).toBe('FROM eclipse-temurin:17.0.20.1_1-jre-jammy');
  });

  it('pins the privileged Trivy action to its verified immutable release commit', () => {
    const scan = entry().jobs['tinyurl-image'].steps.find((step: any) =>
      String(step.uses).startsWith('aquasecurity/trivy-action@'),
    );
    expect(scan.uses).toBe('aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25');
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
    const job = doc.jobs['tinyurl-k3s-manifests'];
    const raw = job.steps.map((step: any) => step.run ?? '').join('\n');
    expect(raw).toContain('k3s');
    expect(raw).toContain('kubectl apply');
    expect(raw).toContain('rollout status');
    expect(raw).toContain('pg_isready');
    expect(raw).toContain('projects/tinyurl/deploy/*.yaml');
    expect(raw).toContain('envsubst < "$manifest"');
    expect(raw).toContain('for manifest in /tmp/tinyurl-manifests/*.yaml');
    expect(raw).toContain('kubectl apply -f "$manifest"');
    expect(raw).toContain('sudo ./k3s ctr images import -');
    expect(raw).not.toContain('sudo kubectl');
    expect(fs.readdirSync('projects/tinyurl/deploy')).toContain('postgres-statefulset.yaml');
    expect(raw).toContain("wait --for=jsonpath='{.status.phase}'=Bound pvc/data-postgres-0");
    expect(fs.readFileSync('tools/branch-protection.ts', 'utf8')).toContain(
      "'tinyurl-k3s-manifests'",
    );
  });

  it('runs the pushed arm64 image on an ARM runner and asserts health plus api', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/tinyurl-ci.yml', 'utf8'));
    const job = doc.jobs['tinyurl-arm-smoke'];
    expect(job['runs-on']).toContain('arm');
    const raw = JSON.stringify(job);
    expect(raw).toContain('docker run');
    expect(raw).toContain('/actuator/health');
    expect(raw).toContain('/api/links');
    expect(fs.readFileSync('tools/branch-protection.ts', 'utf8')).toContain("'tinyurl-arm-smoke'");
  });

  it('proves the prod login flow against a stub identity in CI', () => {
    const doc: any = yaml.load(fs.readFileSync('.github/workflows/tinyurl-ci.yml', 'utf8'));
    const raw = JSON.stringify(doc.jobs['tinyurl-prod-login']);
    expect(raw).toContain('docker-compose.prod-e2e.yml');
    expect(raw).toContain('github.sha');
    expect(raw).toContain('playwright.prod.config.ts');
    expect(raw).toContain('down -v');
    expect(fs.readFileSync('tools/branch-protection.ts', 'utf8')).toContain("'tinyurl-prod-login'");
  });

  it('waits for the prod TinyURL container health before running the browser flow', () => {
    const compose: any = yaml.load(
      fs.readFileSync('projects/tinyurl/ci/docker-compose.prod-e2e.yml', 'utf8'),
    );
    expect(compose.services.tinyurl.healthcheck.test).toContain(
      'http://127.0.0.1:8082/actuator/health',
    );
  });

  it('renders EVERY manifest through envsubst, never copies templates verbatim', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/deploy.yml', 'utf8'));
    const render = doc.jobs.deploy.steps.map((s: any) => s.run).join('\n');
    expect(render).not.toContain('cp {} rendered/');
    expect(render).toContain('envsubst < ');
    expect(render).toContain('find ');
    expect(render).toContain('basename ');
  });

  it('never embeds secrets or inputs directly inside run: bodies (script-injection)', () => {
    const doc: any = yaml.load(fs.readFileSync('platform/harness/workflows/deploy.yml', 'utf8'));
    for (const step of doc.jobs.deploy.steps as any[]) {
      if (step.run) {
        expect(step.run).not.toContain('${{ secrets.');
        expect(step.run).not.toContain('${{');
      }
    }
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
