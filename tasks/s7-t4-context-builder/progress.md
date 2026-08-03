# S7-T4 Progress

## 2026-08-03

### Request and context

- Read the complete attached S7-T4 specification and repository `AGENTS.md`.
- Confirmed the repository build prohibition overrides the requested fresh
  backend build. The build will be recommended but not run.
- Initial targeted search found no `SOPHIA_PROJECT.md` or `DESIGN.md`.
- Initial worktree status was clean.
- Read the complete current `docs/ai-runtime.md`, product brief, AI behavior,
  context engineering, RAG, memory, verification, and architecture-decision
  documents.
- Read all S7-T2 and S7-T3 durable task records. Confirmed no S7-T1 task files
  are present in the current checkout.

### Architecture audit

- Read the complete production AI module and every colocated S7-T1/S7-T2/S7-T3
  unit/evaluation test.
- Read the Prisma book/page/chapter/chunk/highlight/note models, complete book
  processing module, reader data contracts and relevant authorized loading,
  complete note/highlight DTO/type/mapper/service contracts, HTTP errors,
  backend composition/configuration, package scripts, and TypeScript configs.
- Searched production source and the repository for existing context assembly,
  budgeting, truncation, provenance, citations, and request metadata.
- Confirmed there is no existing context module or reusable provenance/budget
  boundary. The only estimator is the ingestion chunker's approximate word
  heuristic, which is feature-specific and not exact tokens.
- Confirmed existing test scripts build as a prerequisite, creating a direct
  conflict with repository policy. No test or build has been run.

### Architecture decision

- Completed the audit before production code and recorded the selected kinds,
  pure boundary, UUID provenance, caller authorization responsibility, stable
  ordering, duplicate policy, exact Unicode-code-point budget, required-block
  behavior, optional prefix truncation, structured frozen result, privacy-safe
  errors, and explicit non-goals in `task_plan.md` and `findings.md`.
- Chose not to reuse ingestion's approximate token estimator and not to return
  a combined prompt string.

### TDD evidence

1. One valid required block:
   - Test first: added the public `ContextBuilder.build(unknown)` happy-path
     expectation for copied provenance, required state, exact code-point usage,
     budget totals, and no exclusions.
   - Compile-time red: `npm run typecheck --prefix backend` exited 2 with
     `TS2307` because `./context-builder` did not exist.
   - Smallest implementation: added Sophia-owned context contracts and a pure
     builder that copies one valid request into the controlled package and
     counts Unicode code points.
   - Compile-time green: the same typecheck command exited 0.
   - Runtime focused red/green remains unavailable under the no-build policy;
     no passing behavior claim is made from typecheck alone.
2. Invalid request/block rejection:
   - Test first: added malformed request, budget, allowed-kind, ID, content,
     priority, truncation, unexpected-field, UUID, source-field, and page-range
     cases with private error fixtures.
   - Compile-time red: typecheck exited 2 with `TS2307` for missing `./errors`
     and dependent unknown-error narrowing failures.
   - Smallest implementation: added the context error taxonomy, strict plain
     data-record/field validation, bounded request/block validation, controlled
     source UUID/page validation, kind-specific metadata rules, and unexpected
     reflection-failure normalization.
   - Compile-time green: typecheck exited 0.
3. Stable ordering and duplicates:
   - Test first: added required-first, numeric priority, kind tie-breaker,
     code-unit ID tie-breaker, reversed-input equivalence, and duplicate-ID
     rejection/privacy expectations.
   - Runtime red could not be executed under repository policy.
   - Smallest implementation: reject duplicate IDs and sort a fresh block array
     by required status, descending priority, fixed kind rank, and block ID.
   - Compile-time green: typecheck exited 0; runtime behavior is not claimed.
4. Budgeting, required context, and truncation:
   - Test first: added optional overflow/exclusion, exact Unicode-code-point
     accounting, missing/disallowed/oversized required context, required
     non-truncation, eligible prefix truncation, and too-small-marker cases.
   - Smallest implementation: added deterministic required-context checks,
     exact budget accounting, content-free exclusions, and an opt-in
     code-point-safe prefix truncation marker for optional page/chapter blocks.
   - Compile-time green after each slice: typecheck exited 0; runtime behavior
     is not claimed.
5. Ownership, privacy, and isolation:
   - Test first: added copied provenance, deep output freezing, fresh repeated
     builds, caller-input non-mutation, reflection-failure privacy,
     instance-isolation, and instruction-like-content-as-data cases.
   - Smallest implementation: deep-freeze only fresh package copies, including
     nested source/usage/budget/exclusion values.
   - Compile-time green: typecheck exited 0.
6. Public boundary and deterministic evaluations:
   - Test first: added 13 no-network evaluation cases through `ai/index` for
     assembly, ordering, determinism, duplicates, validation, budgeting,
     required/optional behavior, truncation, provenance, privacy, provider
     neutrality, and hostile content.
   - Compile-time red: typecheck exited 2 because `ContextBuilder` and
     `ContextError` were not exported by `ai/index`; dependent callback types
     also remained unresolved.
   - Smallest implementation: added the context barrel and re-exported its
     public contract through the existing AI barrel.
   - Compile-time green: typecheck exited 0.

### Package scripts

- Added focused context unit, context evaluation, and combined context scripts
  in the existing build-then-run convention.
- Added the unit test to the complete backend suite and the combined context
  suite to `test:ai-all`.
- Did not execute these scripts because each invokes the repository-prohibited
  build command.

### Documentation and architecture record

- Updated `docs/ai-runtime.md` with the authorized-service-to-provider flow,
  builder/caller responsibilities, controlled contract and kinds, stable
  ordering, exact code-point budget, required/optional behavior, truncation,
  provenance, privacy/prompt-injection boundary, test/evaluation commands, and
  current limitations.
- Added an accepted ADR for deterministic provider-neutral assembly from
  pre-authorized blocks, including the decision not to reuse ingestion's token
  heuristic or concatenate prompt text.

### Multi-axis review

- Correctness/determinism review found that sparse candidate arrays skipped
  `Array.map()` validation and could fall into a generic failure. Added a
  regression expectation and changed normalization to a `for...of` pass so a
  hole is validated as an invalid block.
- Isolation/API review found that exported context kind/policy arrays were
  compile-time readonly but force-mutable at runtime, which could alter global
  sort/validation behavior. Added regression expectations and froze all
  exported context code collections.
- Typecheck after both fixes exited 0.
- Initial full-backend Oxlint exited 0 with one task-local sparse-fixture style
  warning and two pre-existing processing warnings. Rewrote only the fixture;
  a fresh lint result is still required.
- Provider-boundary, sensitive-logging/path/prompt-field, and out-of-scope
  feature searches returned no matches in context production files.
- `git diff --check` exited 0.

### Fresh policy-permitted verification

- Final typecheck exited 0 with no diagnostics.
- Final full-backend Oxlint exited 0. S7-T4 is warning-free; two warnings remain
  in untouched processing files and are recorded in `verification.md`.
- Provider/module-boundary, sensitive-logging/private-metadata, and
  out-of-scope-feature searches each returned no matches (Ripgrep exit 1).
- Final `git diff --check` exited 0, and status showed only S7-T4 scope.
- Runtime context tests, AI regressions, full backend tests, deterministic
  evaluation execution, and build remain unrun because the authoritative
  scripts invoke the prohibited build. Exact user-run commands are recorded.

### Explicitly authorized runtime and build verification

- The user directly authorized the complete named command list, overriding the
  earlier build restriction for these gates.
- `test:contexts`: exit 0, 15/15 passed.
- `test:context-evals`: exit 0, 13/13 passed.
- `test:context-all`: exit 0, 28/28 passed.
- `test:ai`: exit 0, 21/21 passed.
- `test:gemini`: exit 0, 26/26 passed; Node emitted the existing experimental
  MockTimers warning.
- `test:ai-evals`: exit 0, 11/11 passed.
- `test:prompt-all`: exit 0, 24/24 passed.
- `test:ai-all`: conclusive rerun exit 0, 110/110 constituent cases passed.
- Complete `npm test --prefix backend`: exit 0, all invoked suites passed (99
  executable test cases).
- Explicit backend build: exit 0 with no TypeScript diagnostics.
- No external provider or network call occurred.
- S7-T4 is verified and ready for S7-T5.

### Skills

- Discovered the installed repository skills and began reading every selected
  `SKILL.md` before implementation.
- Selected and recorded the workflows in `task_plan.md`.
- Confirmed `using-agent-skills` and `debugging-and-error-recovery` are absent.
- Read the `skill-scanner` workflow and its security references before using
  its bundled scanner.
- Ran the inspected scanner directly with the existing Python environment; no
  package installation or network access was needed. All selected skills were
  scanned.
- Scanner result: only `planning-with-files` lifecycle/script surfaces and the
  context-compression pytest auto-discovery surface require isolation. No
  selected helper automation will run.
- Applied `planning-with-files`, `filesystem-context`, and
  `context-compression` by creating these durable, structured task records.
- No production code or production test has been written.

### Errors

- `sed` could not read missing `SOPHIA_PROJECT.md`; the audit will explicitly
  confirm the available replacement context instead of assuming a path.
- The first selected-skill scan produced `command not found: jq` while trying
  to summarize JSON. The scanner itself is read-only and no project file was
  changed; the next attempt will use Python's existing JSON/runtime support.
- `node --experimental-strip-types backend/src/ai/provider-registry.test.ts`
  exited 1 with `ERR_MODULE_NOT_FOUND` because the source imports `./errors`
  without a `.ts` extension. Node's direct TypeScript resolver did not apply
  the project's compile-time NodeNext resolution.
- Adding `--experimental-specifier-resolution=node` exited 1 with the same
  resolver error. A targeted executable search found no installed `tsx` or
  `ts-node`. Runtime tests cannot run without invoking the prohibited build or
  adding a dependency, so neither workaround will be used.
