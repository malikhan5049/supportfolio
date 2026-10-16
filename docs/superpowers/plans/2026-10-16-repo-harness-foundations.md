# Repo & Harness Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo's shared tooling — Gradle convention plugin, shared Spring Boot starter, shared Angular UI library (card + dynamic remote loader), the project-manifest schema, a new-project scaffold generator, the two reusable CI workflows, the harness's governance layer (documented guardrails/policies, standardized Spec/Design/Plan/PR templates, branch protection, Dependabot/secret-scanning config), and its coding-standards layer (formatter/linter configs, commit-message convention, a coding standards doc) — so every later plan (Identity, shell, TinyURL, pipeline, admin-triage) builds on working, tested, governed, and uniformly-styled foundations instead of inventing its own.

**Architecture:** One Nx workspace (added to the existing repo via `nx init`) hosts all Angular/TypeScript code and the Node-based manifest/scaffold tooling; one Gradle multi-project build (Kotlin DSL, with an included `build-logic` build for the shared convention plugin) hosts all Java/Spring code. Neither runs a real service yet — this plan produces libraries, schemas, generators, and CI workflow definitions, each proven by its own test.

**Tech Stack:** Nx (TypeScript/Angular tooling), Jest (frontend + Node script tests), Gradle Kotlin DSL + an included `build-logic` build, JUnit 5 + Spring Boot's `ApplicationContextRunner` (autoconfiguration testing), `ajv` (JSON Schema validation), `js-yaml` (workflow YAML validation).

**Spec:** [docs/superpowers/specs/2026-10-16-portfolio-platform-design.md](../specs/2026-10-16-portfolio-platform-design.md)

## Global Constraints

- Repo stays public on GitHub (required for free Actions environment protection rules).
- Fixed monorepo layout: shared code under `/platform/...`, per-project code under `/projects/...` (spec: Repository topology).
- No paid/recurring services — every tool choice here must have a genuine free tier (spec: Constraints).
- Module Federation remotes are loaded dynamically at runtime via a remote registry; never wired at the shell's build time (spec: Shell/Gateway, "my call").
- Cross-project microfrontend sharing is opt-in per project manifest; shared runtime deps (Angular, RxJS, zone.js) must be configured as singletons consistently across every remote/host from day one (spec: Microfrontend sharing foundation).
- `project.manifest.yaml` is the single place a project declares its exposed modules, pipeline stages, environment targets, and card metadata (spec: Harness).
- Use the current latest stable/LTS release of every tool at setup time (Node, Nx, Java, Gradle), verified against that tool's own release page — do not reuse a version number from an older document without checking it's still current (spec: Versions).
- Merge-to-`main` and promote-to-prod are the two gates nothing may bypass, including the admin account itself (harness governance decision, this plan).
- Every Spec, Design, Plan, and PR artifact the harness produces is rendered from one shared template family, not ad hoc per project (harness governance decision, this plan).
- Formatting is enforced by tooling, not convention — a PR with unformatted code fails CI rather than relying on review to catch it (harness coding-standards decision, this plan).
- Commit messages follow Conventional Commits — required for the semver policy on exposed modules (GOVERNANCE.md Policies) to ever be automatable (harness coding-standards decision, this plan).

## Review Focus

- A `project.manifest.yaml` missing its required `card` entry under `exposedModules` must fail schema validation with a clear error, never pass silently — pinned to Task 6.
- Running the scaffold generator with a project name that already exists under `/projects` must fail loudly before writing any file, never silently overwrite — pinned to Task 7.
- The remote-registry service asked to resolve a module name a project doesn't expose must reject with a clear, typed error, not surface a raw fetch/network failure — pinned to Task 5.
- The card component rendered with a missing/empty `title` input must show a fallback placeholder, not blank space or a thrown error — pinned to Task 4.
- The two reusable CI workflow YAML files must be syntactically valid before anything relies on them — caught at commit time by a test, not discovered later as a broken Actions run — pinned to Tasks 8 and 9.
- A standardized artifact template (Spec/Design/Plan/PR) missing one of its required sections must fail a check, not silently ship an inconsistent artifact to the admin — pinned to Task 12.
- A Java file that violates the shared formatter must fail the build locally and in CI, not just get flagged in review — pinned to Task 18.
- A commit message that doesn't follow Conventional Commits must fail a required status check on the PR, including commits authored by the agent — pinned to Task 19.

---

## Task 1: Initialize monorepo tooling (Nx + Gradle root)

**Files:**
- Modify: repo root (add Nx via `nx init`)
- Create: `settings.gradle.kts`
- Create: `build.gradle.kts` (root, empty — plugin management only)
- Create: `gradle/libs.versions.toml`
- Create: `build-logic/settings.gradle.kts`
- Create: `build-logic/build.gradle.kts`

**Interfaces:**
- Produces: a working `nx` CLI (`npx nx --version` runs) and a working Gradle wrapper (`./gradlew projects` runs), both later tasks assume exist.

- [ ] **Step 1: Add Nx to the repo**

Run: `npx nx@latest init --interactive=false` from the repo root.
Expected: `nx.json` and a root `package.json` are created; `npx nx --version` prints a version.

- [ ] **Step 2: Install the latest stable Gradle locally**

Follow https://gradle.org/install/ for the current stable release (not a fixed version here — see Global Constraints).

- [ ] **Step 3: Scaffold the root Gradle build**

Run: `gradle init --type basic --dsl kotlin --project-name supportfolio` from the repo root (overwrite/merge prompts: keep Nx's `package.json`, let Gradle add `settings.gradle.kts`, `build.gradle.kts`, and the Gradle wrapper files).
Expected: `./gradlew -v` prints the installed Gradle version.

- [ ] **Step 4: Create the version catalog**

Create `gradle/libs.versions.toml` with a `[versions]` table (empty for now, populated by later tasks) and reference it from `settings.gradle.kts`'s `dependencyResolutionManagement { versionCatalogs { create("libs") { from(files("gradle/libs.versions.toml")) } } }` block.

- [ ] **Step 5: Create the `build-logic` included build**

Create `build-logic/settings.gradle.kts` (`rootProject.name = "build-logic"`) and `build-logic/build.gradle.kts` applying the `kotlin-dsl` plugin:

```kotlin
plugins {
    `kotlin-dsl`
}
repositories {
    gradlePluginPortal()
    mavenCentral()
}
```

Add `includeBuild("build-logic")` to the root `settings.gradle.kts`.

- [ ] **Step 6: Verify the root build resolves**

Run: `./gradlew projects`
Expected: lists the root project and the included `build-logic` build with no errors.

- [ ] **Step 7: Commit**

```bash
git add nx.json package.json settings.gradle.kts build.gradle.kts gradle build-logic gradlew gradlew.bat gradle/wrapper
git commit -m "chore: initialize Nx workspace and Gradle multi-project root"
```

---

## Task 2: Gradle shared convention plugin

**Files:**
- Create: `build-logic/src/main/kotlin/supportfolio.spring-service-conventions.gradle.kts`
- Test: `build-logic/src/test/kotlin/SpringServiceConventionsPluginTest.kt`
- Test fixture: `build-logic/src/test/resources/fixture-project/settings.gradle.kts`
- Test fixture: `build-logic/src/test/resources/fixture-project/build.gradle.kts`
- Test fixture: `build-logic/src/test/resources/fixture-project/src/main/java/com/supportfolio/fixture/Fixture.java`

**Interfaces:**
- Produces: a plugin ID `supportfolio.spring-service-conventions`, applicable by any future Spring Boot module (Identity, TinyURL, etc.) via `plugins { id("supportfolio.spring-service-conventions") }`, which applies `java`, `org.springframework.boot`, `io.spring.dependency-management`, sets the Java toolchain to the latest installed LTS, and adds `spring-boot-starter-actuator` + `spring-boot-starter-test` as dependencies.

- [ ] **Step 1: Write the failing fixture-based test**

```kotlin
class SpringServiceConventionsPluginTest {
    @Test
    fun `fixture project applying the plugin builds successfully`() {
        val fixtureDir = File("src/test/resources/fixture-project")
        val result = GradleRunner.create()
            .withProjectDir(fixtureDir)
            .withArguments("build")
            .withPluginClasspath()
            .build()
        assertEquals(TaskOutcome.SUCCESS, result.task(":build")?.outcome)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :build-logic:test --tests SpringServiceConventionsPluginTest`
Expected: FAIL — plugin `supportfolio.spring-service-conventions` not found.

- [ ] **Step 3: Write the fixture project**

`fixture-project/settings.gradle.kts`: `rootProject.name = "fixture-project"`.
`fixture-project/build.gradle.kts`: `plugins { id("supportfolio.spring-service-conventions") }`.
`Fixture.java`: a minimal class with a no-arg public constructor (just needs to compile).

- [ ] **Step 4: Implement `supportfolio.spring-service-conventions` in `build-logic/src/main/kotlin/supportfolio.spring-service-conventions.gradle.kts`**

Applies `java`, `org.springframework.boot`, `io.spring.dependency-management`; sets `java.toolchain.languageVersion` from a value read out of `gradle/libs.versions.toml`; adds `implementation("org.springframework.boot:spring-boot-starter-actuator")` and `testImplementation("org.springframework.boot:spring-boot-starter-test")`.

- [ ] **Step 5: Run test to verify it passes**

Run: `./gradlew :build-logic:test --tests SpringServiceConventionsPluginTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add build-logic
git commit -m "feat: add spring-service-conventions Gradle plugin"
```

---

## Task 3: `shared-spring-starter` module

**Files:**
- Create: `platform/shared-spring-starter/build.gradle.kts`
- Create: `platform/shared-spring-starter/src/main/java/com/supportfolio/platform/sharedstarter/SharedStarterAutoConfiguration.java`
- Create: `platform/shared-spring-starter/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- Test: `platform/shared-spring-starter/src/test/java/com/supportfolio/platform/sharedstarter/SharedStarterAutoConfigurationTest.java`
- Modify: `settings.gradle.kts` (add `include("platform:shared-spring-starter")`)

**Interfaces:**
- Consumes: `supportfolio.spring-service-conventions` plugin (Task 2).
- Produces: `SharedStarterAutoConfiguration`, auto-registered via the standard Spring Boot 3+ `AutoConfiguration.imports` file, exposing a `HealthEndpointCustomizer` bean and a `CommonLoggingCustomizer` bean (both just marker beans for now — later plans extend them) any downstream service picks up by depending on `platform:shared-spring-starter`.

- [ ] **Step 1: Write the failing autoconfiguration test**

```java
class SharedStarterAutoConfigurationTest {
    private final ApplicationContextRunner contextRunner =
        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SharedStarterAutoConfiguration.class));

    @Test
    void registersHealthAndLoggingCustomizers() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(HealthEndpointCustomizer.class);
            assertThat(context).hasSingleBean(CommonLoggingCustomizer.class);
        });
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :platform:shared-spring-starter:test`
Expected: FAIL — `SharedStarterAutoConfiguration` does not exist.

- [ ] **Step 3: Implement `SharedStarterAutoConfiguration` with `@Bean HealthEndpointCustomizer healthEndpointCustomizer()` and `@Bean CommonLoggingCustomizer commonLoggingCustomizer()`**

Register the class in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :platform:shared-spring-starter:test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/shared-spring-starter settings.gradle.kts
git commit -m "feat: add shared-spring-starter autoconfiguration module"
```

---

## Task 4: `shared-ui-lib` — Card component

**Files:**
- Modify: repo (add `@nx/angular` plugin via `nx add`)
- Create: `platform/shared-ui-lib/src/lib/card/card.component.ts`
- Create: `platform/shared-ui-lib/src/lib/card/card.component.html`
- Test: `platform/shared-ui-lib/src/lib/card/card.component.spec.ts`

**Interfaces:**
- Produces: standalone `CardComponent` with inputs `title: string`, `description: string`, `features: string[]`, `openUrl: string`, and output `open: EventEmitter<void>` — later consumed by the shell (Plan 3) and by TinyURL's microfrontend (Plan 4).

- [ ] **Step 1: Add the Angular plugin and generate the library**

Run: `npx nx add @nx/angular`, then `npx nx g @nx/angular:library shared-ui-lib --directory=platform/shared-ui-lib --standalone`.

- [ ] **Step 2: Write the failing component test**

```typescript
describe('CardComponent', () => {
  it('renders a fallback when title is empty', async () => {
    const { fixture } = await render(CardComponent, { inputs: { title: '', description: 'd', features: [], openUrl: '#' } });
    expect(fixture.nativeElement.textContent).toContain('Untitled project');
  });

  it('emits open when the Open action is clicked', async () => {
    const onOpen = jest.fn();
    const { fixture } = await render(CardComponent, {
      inputs: { title: 'TinyURL', description: 'd', features: ['shorten'], openUrl: '#' },
      on: { open: onOpen },
    });
    fixture.nativeElement.querySelector('[data-testid="open-action"]').click();
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx nx test shared-ui-lib`
Expected: FAIL — `CardComponent` does not exist.

- [ ] **Step 4: Implement `CardComponent`**

Standalone component; template shows `title || 'Untitled project'`, `description`, a `features` list, and a button `data-testid="open-action"` wired to `(click)="open.emit()"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test shared-ui-lib`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add platform/shared-ui-lib package.json nx.json
git commit -m "feat: add shared-ui-lib CardComponent"
```

---

## Task 5: `shared-ui-lib` — dynamic remote-registry loader

**Files:**
- Create: `platform/shared-ui-lib/src/lib/remote-registry/remote-registry.types.ts`
- Create: `platform/shared-ui-lib/src/lib/remote-registry/remote-registry.service.ts`
- Test: `platform/shared-ui-lib/src/lib/remote-registry/remote-registry.service.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `RemoteRegistryService.resolveModule(projectId: string, moduleName: string): Promise<RemoteModuleRef>`, which later tasks (shell, Plan 3) and later projects (Plan 4+) use as the one way to look up and dynamically load any exposed microfrontend module. Also produces `RemoteModuleNotFoundError`.

- [ ] **Step 1: Define the types in `remote-registry.types.ts`**

```typescript
export interface RemoteModuleEntry {
  projectId: string;
  moduleName: string;
  version: string;
  remoteEntry: string;
}
export interface RemoteModuleRef {
  entry: RemoteModuleEntry;
  load: () => Promise<unknown>;
}
export class RemoteModuleNotFoundError extends Error {
  constructor(projectId: string, moduleName: string) {
    super(`No exposed module "${moduleName}" registered for project "${projectId}"`);
  }
}
```

- [ ] **Step 2: Write the failing service tests**

```typescript
describe('RemoteRegistryService', () => {
  it('resolves a registered module', async () => {
    const service = new RemoteRegistryService(fakeRegistryFetcher([
      { projectId: 'tinyurl', moduleName: 'card', version: '1.0.0', remoteEntry: 'https://example/tinyurl/remoteEntry.js' },
    ]), fakeLoader());
    const ref = await service.resolveModule('tinyurl', 'card');
    expect(ref.entry.remoteEntry).toBe('https://example/tinyurl/remoteEntry.js');
  });

  it('rejects with RemoteModuleNotFoundError when the module is not registered', async () => {
    const service = new RemoteRegistryService(fakeRegistryFetcher([]), fakeLoader());
    await expect(service.resolveModule('tinyurl', 'card')).rejects.toBeInstanceOf(RemoteModuleNotFoundError);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx nx test shared-ui-lib`
Expected: FAIL — `RemoteRegistryService` does not exist.

- [ ] **Step 4: Implement `RemoteRegistryService(registryFetcher, moduleLoader)` with `resolveModule(projectId, moduleName): Promise<RemoteModuleRef>`**

Fetches the registry entries via the injected `registryFetcher`, finds the matching `{projectId, moduleName}` pair, throws `RemoteModuleNotFoundError` if absent, otherwise returns a `RemoteModuleRef` whose `load()` delegates to the injected `moduleLoader(entry)` (the real loader implementation, backed by `@module-federation/enhanced`'s dynamic `loadRemote`, is wired by the shell in Plan 3 — this task only defines and tests the resolution contract).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test shared-ui-lib`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add platform/shared-ui-lib
git commit -m "feat: add RemoteRegistryService for dynamic module federation lookups"
```

---

## Task 6: Project manifest schema + validator

**Files:**
- Create: `platform/harness/manifest-schema/project.manifest.schema.json`
- Create: `tools/validate-manifest.ts`
- Test: `tools/validate-manifest.spec.ts`
- Create: `tools/fixtures/valid-manifest.yaml`
- Create: `tools/fixtures/invalid-manifest.yaml`

**Interfaces:**
- Produces: `validateManifest(manifestYaml: string): ManifestValidationResult` (`{ valid: boolean; errors: string[] }`), used by Task 10's workflow and by every future project's CI.

- [ ] **Step 1: Write the schema**

`project.manifest.schema.json` (JSON Schema draft 2020-12), requiring: `id` (string), `displayName` (string), `shortDescription` (string), `features` (array of strings), `exposedModules` (non-empty array of `{name, version, remoteEntry}`, at least one entry with `name == "card"`), `pipeline.stages` (array of strings), `environments` (array of strings).

- [ ] **Step 2: Write the fixtures**

`valid-manifest.yaml`: a complete manifest for a hypothetical `tinyurl` project satisfying the schema, including a `card` entry under `exposedModules`.
`invalid-manifest.yaml`: same as valid, but with the `card` entry removed from `exposedModules`.

- [ ] **Step 3: Write the failing validator tests**

```typescript
describe('validateManifest', () => {
  it('accepts a manifest exposing a card module', () => {
    const result = validateManifest(readFixture('valid-manifest.yaml'));
    expect(result.valid).toBe(true);
  });

  it('rejects a manifest missing the card exposed module', () => {
    const result = validateManifest(readFixture('invalid-manifest.yaml'));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/card/i);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest tools/validate-manifest.spec.ts`
Expected: FAIL — `validateManifest` does not exist.

- [ ] **Step 5: Implement `validateManifest(manifestYaml: string): ManifestValidationResult` in `tools/validate-manifest.ts`**

Parses YAML with `js-yaml`, compiles `project.manifest.schema.json` with `ajv`, returns `{ valid, errors }` where `errors` are Ajv's human-readable messages.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tools/validate-manifest.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add platform/harness/manifest-schema tools
git commit -m "feat: add project manifest schema and validator"
```

---

## Task 7: New-project scaffold generator

**Files:**
- Create: `tools/plugins/project-scaffold/src/generators/new-project/generator.ts`
- Create: `tools/plugins/project-scaffold/src/generators/new-project/schema.json`
- Create: `tools/plugins/project-scaffold/src/generators/new-project/files/project.manifest.yaml__template__`
- Test: `tools/plugins/project-scaffold/src/generators/new-project/generator.spec.ts`

**Interfaces:**
- Consumes: `validateManifest` (Task 6) to self-check the manifest it generates.
- Produces: `newProjectGenerator(tree: Tree, options: { name: string; displayName: string; shortDescription: string }): Promise<void>`, the entry point the harness's "Add new app" automation (Plan 6) calls.

- [ ] **Step 1: Write the failing generator tests**

```typescript
describe('newProjectGenerator', () => {
  it('creates a manifest, service stub, and microfrontend stub under projects/<name>', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await newProjectGenerator(tree, { name: 'tinyurl', displayName: 'TinyURL', shortDescription: 'Shorten a URL' });
    expect(tree.exists('projects/tinyurl/project.manifest.yaml')).toBe(true);
    expect(tree.exists('projects/tinyurl/service/build.gradle.kts')).toBe(true);
    expect(tree.exists('projects/tinyurl/microfrontend/project.json')).toBe(true);
  });

  it('fails without writing any file when the project already exists', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('projects/tinyurl/project.manifest.yaml', 'id: tinyurl');
    await expect(newProjectGenerator(tree, { name: 'tinyurl', displayName: 'TinyURL', shortDescription: 'x' }))
      .rejects.toThrow(/already exists/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test project-scaffold`
Expected: FAIL — `newProjectGenerator` does not exist.

- [ ] **Step 3: Implement `newProjectGenerator(tree, options)`**

Checks `tree.exists(`projects/${options.name}`)` first and throws `Error('Project "' + options.name + '" already exists')` if so; otherwise uses Nx devkit's `generateFiles` to render `files/project.manifest.yaml__template__` (filled with `options`, `exposedModules: [{ name: 'card', version: '1.0.0' }]`, `pipeline.stages: ['lint','test','build']`, `environments: ['dev','test','prod']`) plus minimal `service/build.gradle.kts` (applies `supportfolio.spring-service-conventions`) and `microfrontend/project.json` (Nx remote app stub) into `projects/<name>/`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test project-scaffold`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tools/plugins/project-scaffold
git commit -m "feat: add new-project scaffold generator"
```

---

## Task 8: Reusable backend CI workflow

**Files:**
- Create: `platform/harness/workflows/backend-ci.yml`
- Test: `tools/validate-workflows.spec.ts` (shared with Task 9)

**Interfaces:**
- Produces: a `workflow_call` reusable workflow any project's own `.github/workflows/ci.yml` invokes for its backend `service/` module, taking input `project-path` (string).

- [ ] **Step 1: Write the failing YAML-validity test**

```typescript
describe('backend-ci.yml', () => {
  it('is valid YAML with a workflow_call trigger', () => {
    const doc = yaml.load(fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'));
    expect(doc.on.workflow_call.inputs['project-path']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write `backend-ci.yml`**

`on.workflow_call.inputs.project-path` (string, required); one job `build` running on `ubuntu-latest`, steps: checkout, set up the latest-stable JDK via `actions/setup-java@v4` (`distribution: temurin`, `java-version` left to the project's manifest or defaulted to the installed toolchain), `./gradlew -p ${{ inputs.project-path }} build`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/harness/workflows/backend-ci.yml tools/validate-workflows.spec.ts
git commit -m "feat: add reusable backend-ci workflow"
```

---

## Task 9: Reusable frontend CI workflow

**Files:**
- Create: `platform/harness/workflows/frontend-ci.yml`
- Modify: `tools/validate-workflows.spec.ts` (add the matching case)

**Interfaces:**
- Produces: a `workflow_call` reusable workflow any project invokes for its `microfrontend/` app, taking input `project-name` (string, the Nx project name).

- [ ] **Step 1: Extend the failing YAML-validity test**

```typescript
it('frontend-ci.yml is valid YAML with a workflow_call trigger', () => {
  const doc = yaml.load(fs.readFileSync('platform/harness/workflows/frontend-ci.yml', 'utf8'));
  expect(doc.on.workflow_call.inputs['project-name']).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write `frontend-ci.yml`**

`on.workflow_call.inputs.project-name` (string, required); one job `build` running on `ubuntu-latest`, steps: checkout, set up the latest-stable Node via `actions/setup-node@v4`, `npm ci`, `npx nx lint ${{ inputs.project-name }}`, `npx nx test ${{ inputs.project-name }}`, `npx nx build ${{ inputs.project-name }}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/harness/workflows/frontend-ci.yml tools/validate-workflows.spec.ts
git commit -m "feat: add reusable frontend-ci workflow"
```

---

## Task 10: Repo-wide manifest validation workflow

**Files:**
- Create: `.github/workflows/validate-manifests.yml`
- Create: `tools/validate-all-manifests.ts`
- Test: `tools/validate-all-manifests.spec.ts`

**Interfaces:**
- Consumes: `validateManifest` (Task 6).
- Produces: `validateAllManifests(projectsDir: string): ManifestValidationResult[]`, run in CI on every push/PR so a broken manifest fails fast regardless of which project it belongs to.

- [ ] **Step 1: Write the failing test**

```typescript
describe('validateAllManifests', () => {
  it('reports a failure for each invalid manifest found under projects/', () => {
    const results = validateAllManifests('tools/fixtures/projects-with-one-invalid');
    expect(results.some(r => !r.valid)).toBe(true);
  });

  it('returns no failures when no manifests exist', () => {
    const results = validateAllManifests('tools/fixtures/empty-projects-dir');
    expect(results).toEqual([]);
  });
});
```

(Add `tools/fixtures/empty-projects-dir/.gitkeep` and `tools/fixtures/projects-with-one-invalid/badproject/project.manifest.yaml` — reuse `invalid-manifest.yaml`'s content from Task 6.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-all-manifests.spec.ts`
Expected: FAIL — `validateAllManifests` does not exist.

- [ ] **Step 3: Implement `validateAllManifests(projectsDir: string): ManifestValidationResult[]` in `tools/validate-all-manifests.ts`**

Globs `**/project.manifest.yaml` under `projectsDir`, runs each through `validateManifest` (Task 6), returns the list of results; throws nothing itself (the CI step below decides pass/fail from the results).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/validate-all-manifests.spec.ts`
Expected: PASS

- [ ] **Step 5: Write `.github/workflows/validate-manifests.yml`**

Triggers on `push` and `pull_request`; one job running `npm ci` then `npx ts-node tools/validate-all-manifests.ts projects --fail-on-invalid` (the script's CLI entry exits non-zero if any result is invalid).

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/validate-manifests.yml tools/validate-all-manifests.ts tools/validate-all-manifests.spec.ts tools/fixtures
git commit -m "feat: add repo-wide manifest validation workflow"
```

---

## Task 11: Harness governance doc

**Files:**
- Create: `platform/harness/GOVERNANCE.md`
- Test: `tools/validate-governance-doc.spec.ts`

**Interfaces:**
- Produces: the one committed, human-readable source of truth for every guardrail and policy the harness enforces — referenced by Task 13–15's config and by every future plan instead of re-explaining these rules.

- [ ] **Step 1: Write the failing test**

```typescript
describe('GOVERNANCE.md', () => {
  it('contains the required top-level sections', () => {
    const text = fs.readFileSync('platform/harness/GOVERNANCE.md', 'utf8');
    for (const heading of ['## Human Gates', '## Guardrails', '## Policies']) {
      expect(text).toContain(heading);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-governance-doc.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write `platform/harness/GOVERNANCE.md`**

Three required sections:
- `## Human Gates` — the pipeline-stage table (Intake → Spec [mandatory gate] → Design [mandatory for project-sized work] → Plan [visible, approval optional] → Implement → PR [mandatory gate, never bypassable] → CI → Deploy to test → Promote to prod [mandatory gate, never bypassable] → Telemetry).
- `## Guardrails` — one line each: no-bypass on merge/prod gates, branch protection + required status checks, least-privilege self-hosted runner, one agentic change in flight per project (concurrency), secret scanning + push protection, dependency/CVE scanning gate, build provenance toward SLSA Build L2, rollback-by-default via immutable images, spend cap (manifest-declared resources only), full audit trail (Issue → Plan → PR → workflow run).
- `## Policies` — one line each: no direct pushes to `main`, every change traces to one Issue, lint is a merge gate, exposed modules follow semver, auth/input/secret-touching PRs carry an OWASP checklist item, admin is hardcoded to the repo owner with an explicit user allowlist, no PII in logs/telemetry, docs updated in the same PR that changes what they document.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/validate-governance-doc.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/harness/GOVERNANCE.md tools/validate-governance-doc.spec.ts
git commit -m "docs: add harness governance doc (human gates, guardrails, policies)"
```

---

## Task 12: Standardized artifact templates (Spec, Design, Plan, PR checklist)

**Files:**
- Create: `platform/harness/templates/spec.template.md`
- Create: `platform/harness/templates/design.template.md`
- Create: `platform/harness/templates/plan.template.md`
- Create: `platform/harness/templates/pr-checklist.template.md`
- Create: `tools/validate-templates.ts`
- Test: `tools/validate-templates.spec.ts`

**Interfaces:**
- Produces: `REQUIRED_SECTIONS: Record<TemplateName, string[]>` and `validateTemplate(templateName: TemplateName, contents: string): ManifestValidationResult` (same result shape as Task 6's `ManifestValidationResult`), reused later by the admin-triage automation (Plan 6) to check every generated Spec/Design/Plan/PR artifact before showing it to the admin.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('validateTemplate', () => {
  it('passes spec.template.md, which contains every required spec section', () => {
    const result = validateTemplate('spec', fs.readFileSync('platform/harness/templates/spec.template.md', 'utf8'));
    expect(result.valid).toBe(true);
  });

  it('fails a spec missing an Acceptance Criteria section', () => {
    const result = validateTemplate('spec', '## Intent\n## Goals\n## Non-Goals\n## Anti-Goals\n## Constraints');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Acceptance Criteria/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tools/validate-templates.spec.ts`
Expected: FAIL — `validateTemplate` and the template files do not exist.

- [ ] **Step 3: Write the four template files and implement `validateTemplate`**

`spec.template.md` sections: `## Intent`, `## Goals`, `## Non-Goals`, `## Anti-Goals`, `## Acceptance Criteria`, `## Constraints`.
`design.template.md` sections: `## Intent and Why`, `## Goals`, `## Non-Goals`, `## Anti-Goals`, `## Constraints`, `## Decided Architecture`, `## What's Left to the Builder` (mirrors this repo's own spec format).
`plan.template.md` sections: `## Global Constraints`, `## Review Focus`, `## Tasks`, `## Self-Review Notes` (mirrors this repo's own plan format).
`pr-checklist.template.md` sections: `## What Changed`, `## Traces To` (spec/plan link), `## Tests Added`, `## Security Checklist`, `## Rollback Plan`.
`validate-templates.ts` exports `REQUIRED_SECTIONS` (one entry per template name, listing its required `##` headings) and `validateTemplate(templateName, contents)`, which checks each required heading is present in `contents` and returns `{ valid, errors }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tools/validate-templates.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/harness/templates tools/validate-templates.ts tools/validate-templates.spec.ts
git commit -m "feat: add standardized Spec/Design/Plan/PR templates and validator"
```

---

## Task 13: Branch protection ruleset + CODEOWNERS

**Files:**
- Create: `tools/branch-protection.ts`
- Test: `tools/branch-protection.spec.ts`
- Create: `platform/harness/config/owner.json`
- Create: `CODEOWNERS` (repo root `.github/CODEOWNERS`)
- Create: `.github/workflows/apply-branch-protection.yml`
- Modify: `tools/validate-workflows.spec.ts` (add the matching YAML-validity case)

**Interfaces:**
- Produces: `buildMainBranchRuleset(requiredStatusChecks: string[]): RepositoryRuleset`, a pure function returning the exact GitHub ruleset payload — required PR, required status checks, required review, no administrator bypass — applied for real by the `apply-branch-protection.yml` workflow (`workflow_dispatch`, calls `gh api` with this payload) rather than a one-off manual click.

- [ ] **Step 1: Write the failing test**

```typescript
describe('buildMainBranchRuleset', () => {
  it('requires a PR, the given status checks, a review, and disallows bypass', () => {
    const ruleset = buildMainBranchRuleset(['lint', 'test', 'build', 'validate-manifests']);
    expect(ruleset.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'pull_request' }),
      expect.objectContaining({ type: 'required_status_checks' }),
    ]));
    expect(ruleset.bypass_actors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/branch-protection.spec.ts`
Expected: FAIL — `buildMainBranchRuleset` does not exist.

- [ ] **Step 3: Implement `buildMainBranchRuleset(requiredStatusChecks: string[]): RepositoryRuleset` in `tools/branch-protection.ts`**

Returns a GitHub repository ruleset object targeting `refs/heads/main` with `enforcement: 'active'`, `bypass_actors: []`, and `rules` including a `pull_request` rule (require at least 1 approving review) and a `required_status_checks` rule built from the `requiredStatusChecks` argument.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/branch-protection.spec.ts`
Expected: PASS

- [ ] **Step 5: Write `platform/harness/config/owner.json` (`{ "githubUsername": "<repo-owner>" }`), generate `.github/CODEOWNERS` from it (`* @<githubUsername>`), and write `.github/workflows/apply-branch-protection.yml`**

Workflow triggers on `workflow_dispatch`, one job calling `gh api repos/:owner/:repo/rulesets -X POST` with `buildMainBranchRuleset(['lint','test','build','validate-manifests'])` as the payload — extend `tools/validate-workflows.spec.ts` with a YAML-validity case for this file, matching Tasks 8/9's pattern.

- [ ] **Step 6: Commit**

```bash
git add tools/branch-protection.ts tools/branch-protection.spec.ts platform/harness/config/owner.json .github/CODEOWNERS .github/workflows/apply-branch-protection.yml tools/validate-workflows.spec.ts
git commit -m "feat: add branch protection ruleset builder, CODEOWNERS, and apply workflow"
```

---

## Task 14: Dependabot + secret scanning config

**Files:**
- Create: `.github/dependabot.yml`
- Modify: `tools/validate-workflows.spec.ts` (add a YAML-validity case for `dependabot.yml`)

**Interfaces:**
- Produces: scheduled dependency-update PRs for both package ecosystems in this repo (`npm` for the Nx/TypeScript side, `gradle` for the Java side), feeding the merge gate already enforced by Task 13's ruleset.

- [ ] **Step 1: Extend the failing YAML-validity test**

```typescript
it('dependabot.yml is valid YAML with npm and gradle update configs', () => {
  const doc = yaml.load(fs.readFileSync('.github/dependabot.yml', 'utf8'));
  const ecosystems = doc.updates.map(u => u['package-ecosystem']);
  expect(ecosystems).toEqual(expect.arrayContaining(['npm', 'gradle']));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write `.github/dependabot.yml`**

`version: 2`, `updates` with one entry for `package-ecosystem: npm` (`directory: "/"`, weekly schedule) and one for `package-ecosystem: gradle` (`directory: "/"`, weekly schedule).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: PASS

- [ ] **Step 5: Enable secret scanning + push protection (repository setting, not a file)**

Document in `platform/harness/GOVERNANCE.md` (Task 11, already committed — append a line under `## Guardrails`) that this is turned on under the repo's Settings → Code security, since it's a GitHub setting with no file representation; note it as a one-time manual setup step.

- [ ] **Step 6: Commit**

```bash
git add .github/dependabot.yml tools/validate-workflows.spec.ts platform/harness/GOVERNANCE.md
git commit -m "feat: add Dependabot config; document secret scanning setup"
```

---

## Task 15: PR template wiring

**Files:**
- Create: `.github/pull_request_template.md`
- Test: `tools/validate-pr-template.spec.ts`

**Interfaces:**
- Consumes: `pr-checklist.template.md`'s required sections (Task 12).
- Produces: the PR template GitHub pre-fills on every new PR — the same shape `validateTemplate('pr-checklist', ...)` checks.

- [ ] **Step 1: Write the failing test**

```typescript
describe('pull_request_template.md', () => {
  it('matches the pr-checklist template sections', () => {
    const result = validateTemplate('pr-checklist', fs.readFileSync('.github/pull_request_template.md', 'utf8'));
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-pr-template.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write `.github/pull_request_template.md`**

Copy `pr-checklist.template.md`'s section structure (Task 12) verbatim into the PR template.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/validate-pr-template.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .github/pull_request_template.md tools/validate-pr-template.spec.ts
git commit -m "feat: wire PR template to the shared pr-checklist template"
```

---

## Task 16: Concurrency policy on reusable workflows

**Files:**
- Modify: `platform/harness/workflows/backend-ci.yml` (Task 8)
- Modify: `platform/harness/workflows/frontend-ci.yml` (Task 9)
- Modify: `tools/validate-workflows.spec.ts`

**Interfaces:**
- Produces: both reusable workflows refusing to run two triggered changes for the same project concurrently, satisfying the "one agentic change in flight per project" guardrail.

- [ ] **Step 1: Extend the failing tests**

```typescript
it('backend-ci.yml serializes runs per project-path', () => {
  const doc = yaml.load(fs.readFileSync('platform/harness/workflows/backend-ci.yml', 'utf8'));
  expect(doc.concurrency.group).toContain('${{ inputs.project-path }}');
});

it('frontend-ci.yml serializes runs per project-name', () => {
  const doc = yaml.load(fs.readFileSync('platform/harness/workflows/frontend-ci.yml', 'utf8'));
  expect(doc.concurrency.group).toContain('${{ inputs.project-name }}');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: FAIL — neither workflow has a `concurrency` block yet.

- [ ] **Step 3: Add a `concurrency` block to both workflows**

`backend-ci.yml`: `concurrency: { group: "backend-ci-${{ inputs.project-path }}", cancel-in-progress: false }`.
`frontend-ci.yml`: `concurrency: { group: "frontend-ci-${{ inputs.project-name }}", cancel-in-progress: false }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tools/validate-workflows.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/harness/workflows/backend-ci.yml platform/harness/workflows/frontend-ci.yml tools/validate-workflows.spec.ts
git commit -m "feat: serialize reusable workflow runs per project via concurrency groups"
```

---

## Task 17: Cross-editor + frontend formatting/lint baseline

**Files:**
- Create: `.editorconfig`
- Create: `.prettierrc.json`
- Create: `eslint.config.mjs` (root, shared flat config extended by every Nx project's own config)
- Test: `tools/validate-lint-baseline.spec.ts`

**Interfaces:**
- Produces: the formatting/lint rules every Angular/TypeScript file in the repo is checked against; `npx nx lint <project>` (already called by `frontend-ci.yml`, Task 9) picks these up with no further wiring.

- [ ] **Step 1: Write the failing test**

```typescript
describe('lint baseline', () => {
  it('root eslint config resolves without error', () => {
    expect(() => execSync('npx eslint --print-config eslint.config.mjs')).not.toThrow();
  });

  it('prettier formats a deliberately misformatted fixture to match the committed expectation', () => {
    const formatted = execSync('npx prettier --config .prettierrc.json tools/fixtures/unformatted.ts').toString();
    expect(formatted).toBe(fs.readFileSync('tools/fixtures/formatted-expected.ts', 'utf8'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tools/validate-lint-baseline.spec.ts`
Expected: FAIL — config files and fixtures do not exist.

- [ ] **Step 3: Write `.editorconfig`, `.prettierrc.json`, `eslint.config.mjs`, and the two fixtures**

`.editorconfig`: UTF-8, LF line endings, 2-space indent, trim trailing whitespace, insert final newline — applies to all files.
`.prettierrc.json`: single quotes, semicolons, 100-character print width, 2-space tabs (the concrete values implementers must match; adjust in this one file only, never per project).
`eslint.config.mjs`: extends `@nx/eslint-plugin`'s recommended + Angular's recommended rule sets (Nx generates the per-project pieces; this file is the shared root every project's own config extends).
`unformatted.ts` / `formatted-expected.ts`: a small TS snippet with inconsistent quotes/semicolons and its Prettier-formatted equivalent.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tools/validate-lint-baseline.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .editorconfig .prettierrc.json eslint.config.mjs tools/validate-lint-baseline.spec.ts tools/fixtures
git commit -m "feat: add shared editorconfig, Prettier, and ESLint baseline"
```

---

## Task 18: Java formatting via Spotless in the convention plugin

**Files:**
- Modify: `build-logic/src/main/kotlin/supportfolio.spring-service-conventions.gradle.kts` (Task 2)
- Modify: `build-logic/src/test/kotlin/SpringServiceConventionsPluginTest.kt` (Task 2)
- Modify: `build-logic/src/test/resources/fixture-project/src/main/java/com/supportfolio/fixture/Fixture.java` (Task 2) — add a second, deliberately misformatted fixture class

**Interfaces:**
- Consumes: the `supportfolio.spring-service-conventions` plugin (Task 2).
- Produces: every module applying the plugin gets `spotlessCheck` wired into its `check`/`build` lifecycle, so `backend-ci.yml`'s existing `./gradlew build` step (Task 8) enforces formatting with no new CI step needed.

- [ ] **Step 1: Extend the failing fixture-based test**

```kotlin
@Test
fun `fixture project with misformatted Java fails spotlessCheck`() {
    val result = GradleRunner.create()
        .withProjectDir(File("src/test/resources/fixture-project"))
        .withArguments("spotlessCheck")
        .withPluginClasspath()
        .buildAndFail()
    assertEquals(TaskOutcome.FAILED, result.task(":spotlessCheck")?.outcome)
}
```

(Add `Misformatted.java` to the fixture project with inconsistent indentation/import order for this test to catch; the existing `build` test from Task 2 continues to pass against `Fixture.java`, which stays correctly formatted.)

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `./gradlew :build-logic:test --tests SpringServiceConventionsPluginTest`
Expected: FAIL — `spotlessCheck` task doesn't exist yet, or passes when it shouldn't.

- [ ] **Step 3: Apply the `com.diffplug.spotless` plugin with Google Java Format inside `supportfolio.spring-service-conventions`, and wire `spotlessCheck` into `check`**

`spotless { java { googleJavaFormat(); target("src/*/java/**/*.java") } }`; Gradle's `check` task already depends on `spotlessCheck` once the Spotless plugin is applied — no extra wiring needed beyond applying it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :build-logic:test --tests SpringServiceConventionsPluginTest`
Expected: PASS (both the existing `build` test and the new `spotlessCheck` failure test)

- [ ] **Step 5: Commit**

```bash
git add build-logic
git commit -m "feat: enforce Java formatting via Spotless in spring-service-conventions"
```

---

## Task 19: Conventional Commits enforcement

**Files:**
- Create: `tools/is-conventional-commit.ts`
- Test: `tools/is-conventional-commit.spec.ts`
- Create: `.github/workflows/validate-commit-messages.yml`
- Modify: `tools/validate-workflows.spec.ts`

**Interfaces:**
- Produces: `isConventionalCommit(message: string): boolean`, used by the new workflow (`workflow_call`-free, runs directly on `pull_request`) to fail the PR's required status check if any commit in it doesn't match `type(scope?): subject` with `type` in `feat|fix|docs|chore|refactor|test|ci`.

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tools/is-conventional-commit.spec.ts`
Expected: FAIL — `isConventionalCommit` does not exist.

- [ ] **Step 3: Implement `isConventionalCommit(message: string): boolean` in `tools/is-conventional-commit.ts`**

Regex-checks the message's first line against `^(feat|fix|docs|chore|refactor|test|ci)(\([a-z0-9-]+\))?: .+`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tools/is-conventional-commit.spec.ts`
Expected: PASS

- [ ] **Step 5: Write `.github/workflows/validate-commit-messages.yml`**

Triggers on `pull_request`; one job checking out full history (`fetch-depth: 0`), listing commits in the PR range, running each through `isConventionalCommit` via a small `ts-node` one-liner, failing the job if any returns `false` — extend `tools/validate-workflows.spec.ts` with this file's YAML-validity case, matching Tasks 8/9/13's pattern.

- [ ] **Step 6: Commit**

```bash
git add tools/is-conventional-commit.ts tools/is-conventional-commit.spec.ts .github/workflows/validate-commit-messages.yml tools/validate-workflows.spec.ts
git commit -m "feat: enforce Conventional Commits as a required PR status check"
```

---

## Task 20: Coding standards doc

**Files:**
- Create: `platform/harness/CODING_STANDARDS.md`
- Test: `tools/validate-coding-standards-doc.spec.ts`

**Interfaces:**
- Produces: the one committed reference for how code is written in this repo — linked from `GOVERNANCE.md` (Task 11) and from the Plan template (Task 12) so every future plan can cite it instead of restating conventions.

- [ ] **Step 1: Write the failing test**

```typescript
describe('CODING_STANDARDS.md', () => {
  it('contains the required sections', () => {
    const text = fs.readFileSync('platform/harness/CODING_STANDARDS.md', 'utf8');
    for (const heading of ['## Backend (Java/Spring)', '## Frontend (Angular)', '## API Design', '## Logging', '## Testing', '## Commits']) {
      expect(text).toContain(heading);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tools/validate-coding-standards-doc.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write `platform/harness/CODING_STANDARDS.md`**

Six required sections:
- `## Backend (Java/Spring)` — package-by-feature (not package-by-layer), Google Java Format via Spotless (Task 18) is the only source of truth for style, one public class per file, constructor injection only (no field injection).
- `## Frontend (Angular)` — follow the official Angular style guide, standalone components only (no NgModules), one component per file, Prettier (Task 17) is the only source of truth for formatting.
- `## API Design` — REST resource naming (plural nouns, no verbs in paths), every service publishes an OpenAPI spec, breaking API changes require a version bump.
- `## Logging` — structured JSON logs via `shared-spring-starter`'s `CommonLoggingCustomizer` (Task 3), no PII in log fields (ties to GOVERNANCE.md).
- `## Testing` — one test class per production class, Arrange-Act-Assert, descriptive test method names (`methodName_condition_expectedResult` or equivalent sentence form), no skipped/disabled tests committed.
- `## Commits` — Conventional Commits (Task 19), one logical change per commit.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tools/validate-coding-standards-doc.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add platform/harness/CODING_STANDARDS.md tools/validate-coding-standards-doc.spec.ts
git commit -m "docs: add coding standards doc for backend, frontend, API, logging, testing, commits"
```

---

## Self-Review Notes

- **Spec coverage:** monorepo layout (Task 1), shared Spring starter (Tasks 2–3), shared UI lib + dynamic MF loading foundation (Tasks 4–5), manifest-driven opt-in configuration (Tasks 6–7, 10), reusable CI (Tasks 8–9), harness governance — documented guardrails/policies, standardized artifact templates, branch protection, Dependabot, PR template, concurrency (Tasks 11–16), and coding standards — formatter/linter baselines, commit convention enforcement, the standards doc (Tasks 17–20) are all covered. Identity, shell, TinyURL, infra/pipeline, and admin-triage are explicitly out of scope — covered by Plans 2–6.
- **Review Focus:** all nine lines above map to a concrete test in Tasks 4, 5, 6, 7, 8/9, 12, 18, and 19.
- **Type consistency:** `RemoteModuleEntry`/`RemoteModuleRef` (Task 5) is the shape every later plan's remote-loading code must reuse; `ManifestValidationResult` (Task 6) is reused unchanged by Tasks 7, 10, and 12's `validateTemplate`.
