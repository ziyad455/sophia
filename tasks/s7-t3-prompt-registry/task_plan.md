# S7-T3 Versioned Prompt Registry Plan

Status: Complete

Branch: `feature/s7-prompt-registry`

## Objective

Create a provider-neutral, instance-owned, deterministic foundation for
registering and exactly rendering versioned prompt definitions into Sophia's
existing normalized `AIMessage` contract.

S7-T3 is infrastructure only. It adds no production philosophy prompt, feature
service, route, UI, provider call, context builder, persistence, or global
registry.

## Selected Skills and Workflow

- `prompt-engineering-patterns`: use code-defined, explicitly versioned prompt
  contracts, structural separation, deterministic fixtures, and validation;
  do not use its optimization helper or add a template engine.
- `skill-scanner`: inspect selected repository skills before trusting their
  automation.
- `spec-driven-development`: preserve the attached acceptance criteria and
  non-goals as the implementation contract.
- `planning-and-task-breakdown`: split work into the ordered, independently
  verifiable TDD slices below.
- `planning-with-files`: maintain this task directory manually. Its automation
  is not trusted because the scanner found executable lifecycle hooks and home
  directory access.
- `filesystem-context` and `context-compression`: keep audit, decisions,
  red-green evidence, and verification durable in these task files.
- `tdd` and `incremental-implementation`: add one behavior test first, observe
  the expected failure, implement the smallest correction, then rerun.
- `api-and-interface-design` and `tool-design`: keep the registry surface
  minimal, exact, provider-neutral, and recoverable through stable errors.
- `security-and-hardening`: treat identifiers, versions, input, validators, and
  rendered messages as trust boundaries; do not log or echo private content.
- `evaluation` and `harness-engineering`: add a locked, deterministic,
  no-network baseline with explicit outcomes instead of a second framework.
- `documentation-and-adrs`: document the new public boundary and the meaningful
  exact-version/code-defined decision in the existing ADR file.
- `code-review-and-quality`: review tests first, then correctness, simplicity,
  architecture, security, performance, and scope.
- `verification-before-completion`: run every required gate fresh and record
  its exit status before making a completion claim.
- `sophia-backend-engineer`, `sophia-context-engineer`,
  `sophia-product-planner`, and `sophia-verification-engineer`: preserve
  Sophia's manual composition, provider replacement, structured context
  boundary, philosophy-reading scope, and deterministic checks.

`using-agent-skills` and `debugging-and-error-recovery` are not installed.
Their selection/recovery roles are covered by the available skills and these
durable records.

## Security Review of Skills

- The repository scanner reported no findings for
  `prompt-engineering-patterns`, `harness-engineering`, `tool-design`,
  `evaluation`, `api-and-interface-design`, `spec-driven-development`,
  `planning-and-task-breakdown`, `tdd`, `incremental-implementation`,
  `code-review-and-quality`, `documentation-and-adrs`, or
  `verification-before-completion`.
- `planning-with-files` reported seven critical findings: five executable
  lifecycle-hook categories and two home-directory/config access patterns.
  None of its hooks or scripts will be executed.
- `context-compression` reported a high-severity pytest auto-discovery risk.
  Its bundled scripts/tests will not be executed; only its structured handoff
  method is applied.
- Other scanner URL notices were documentation/example URLs, not executable
  behavior. No selected skill helper is needed for this task.

## Architecture Decisions

1. Add the owning module at `backend/src/ai/prompts/`.
2. Use an explicit `new PromptRegistry()` with a private nested map keyed by
   exact prompt ID and exact version.
3. Use the same lowercase stable-ID grammar as the provider registry:
   `^[a-z0-9][a-z0-9._-]{0,63}$`.
4. Use canonical positive integer version strings up to the audited
   `promptVersion` storage limit: `^[1-9][0-9]{0,79}$`. There is no alias,
   semantic-version parser, or automatic latest resolution.
5. Define prompt input schemas by reusing the validator member and
   `StructuredOutputValidationResult<T>` established by S7-T1. Add no
   validation dependency.
6. Capture validator and renderer functions at registration so later mutation
   of the definition object cannot replace registered behavior.
7. Keep resolution internal. The public result contains only prompt ID,
   prompt version, and reconstructed normalized messages; definitions,
   schemas, raw input, providers, models, and options remain private.
8. Validate message arrays after rendering and reject malformed entries,
   unsupported roles, empty content, class/SDK instances, and unexpected
   fields instead of rewriting or dropping them.
9. Freeze the returned object, message array, and reconstructed message
   objects. Each render builds a fresh result.
10. Use a separate `PromptError` taxonomy. Prompt failures are not `AIError`,
    provider errors, or HTTP errors.
11. Do not wire the registry into application composition until a real
    production prompt exists.

## TDD Implementation Order

For every behavior: add the test, run the focused test, confirm the expected
failure, implement the smallest behavior, rerun, and refactor only while green.

1. Register and exactly render one definition.
2. Reject duplicate ID/version registration.
3. Allow distinct explicit versions for one ID.
4. Reject invalid or missing exact definitions safely.
5. Validate unknown input before invoking the renderer.
6. Prove equivalent messages for identical deterministic input.
7. Reject empty and malformed rendered message collections.
8. Prove return and registered-definition mutation safety.
9. Prove error messages and enumerable metadata omit sensitive input/content.
10. Prove registry instance isolation.
11. Prove vendor neutrality with a source-boundary check.
12. Run S7-T1 and S7-T2 regressions.
13. Add the eleven-case deterministic prompt evaluation baseline.
14. Update exports, package commands, AI documentation, and the existing ADR
    file.
15. Perform the five-axis review, fix confirmed task defects, and run fresh
    completion gates.

## Planned Files

```text
backend/src/ai/prompts/
├── contracts.ts
├── errors.ts
├── prompt-registry.ts
├── prompt-registry.test.ts
├── prompt-registry.eval.test.ts
└── index.ts
```

Expected modified files:

- `backend/src/ai/index.ts`
- `backend/package.json`
- `docs/ai-runtime.md`
- `docs/context/architecture-decisions.md`
- task records in this directory

No package, lockfile, environment, database, frontend, route, controller, or
provider-adapter change is planned.

## Verification Gates

The exact commands will be confirmed against the final package scripts and
recorded in `verification.md`:

```sh
npm run test:prompts --prefix backend
npm run test:prompt-evals --prefix backend
npm run test:ai --prefix backend
npm run test:gemini --prefix backend
npm run test:ai-evals --prefix backend
npm test --prefix backend
npm run typecheck --prefix backend
frontend/node_modules/.bin/oxlint backend/src
npm run build --prefix backend
rg -n '@google/genai|providers/gemini|Gemini' backend/src/ai/prompts
rg -n 'console\.|logger\.|process\.env|GEMINI_|model|provider' backend/src/ai/prompts
git diff --check
```
