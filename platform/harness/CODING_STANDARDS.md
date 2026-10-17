# Coding Standards

This document is the one committed reference for how code is written across the monorepo. Every plan, spec, and implementation must follow the conventions below instead of restating or inventing its own.

## Backend (Java/Spring)

- Organize code **package-by-feature**, not package-by-layer. Keep the domain, API, and persistence code for a single feature together under one package.
- **Google Java Format** is the only source of truth for Java style; it is enforced automatically via Spotless (see Task 18). Do not add project-specific formatting rules.
- Keep **one public class per file**. Inner classes are fine when they are tightly coupled to the enclosing type.
- Use **constructor injection only**. Do not use field injection (`@Autowired` on fields) or setter injection.

## Frontend (Angular)

- Follow the official Angular style guide unless it conflicts with an explicit rule below.
- Use **standalone components only**. Do not create or import `NgModules`.
- Keep **one component per file**. Templates and styles may be inline only for trivial, tightly-scoped components.
- **Prettier** is the only source of truth for formatting (see Task 17). Do not add additional frontend formatting rules.

## API Design

- Name REST resources with **plural nouns** and keep **verbs out of the URL path**. Use HTTP methods to express actions.
- **Every service must publish an OpenAPI spec** from the running application.
- A **breaking API change requires a version bump** before it reaches `main`.

## Logging

- Emit **structured JSON logs** via `shared-spring-starter`'s `CommonLoggingCustomizer` (see Task 3).
- **No PII in log fields**. This ties directly to the "No PII in logs or telemetry" policy in `GOVERNANCE.md`.

## Testing

- Maintain **one test class per production class** for unit tests.
- Structure tests with **Arrange-Act-Assert**.
- Use descriptive test method names such as `methodName_condition_expectedResult` or an equivalent sentence form.
- Do not commit skipped or disabled tests.

## Commits

- Follow **Conventional Commits** (see Task 19).
- Keep **one logical change per commit**. Squash fixups that belong to the same logical change before merging.
