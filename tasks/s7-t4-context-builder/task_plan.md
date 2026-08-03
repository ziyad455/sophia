# S7-T4 Deterministic Context Builder Plan

Status: Complete and verified

Suggested branch: `feature/s7-context-builder`

## Objective

Create a provider-neutral, deterministic `ContextBuilder` that receives
already-authorized candidate blocks, validates and prioritizes them, applies a
controlled budget, and returns an ordered, provenance-preserving context
package without calling a provider, `AIRuntime`, `PromptRegistry`, HTTP, or the
database.

S7-T4 is infrastructure only. It adds no user-facing AI feature, prompt
definition, retrieval, RAG, embedding, memory, route, controller, or UI.

## Selected Skills and Workflow

- `skill-scanner`: inspect selected skill instructions for executable hooks,
  hidden behavior, and permission risks before applying their workflows.
- `spec-driven-development`: treat the attached S7-T4 specification as the
  approved contract and keep its acceptance criteria and non-goals explicit.
- `planning-and-task-breakdown`: order the audit, contract, deterministic
  behavior, evaluation, documentation, review, and verification by dependency.
- `planning-with-files`: maintain this task directory manually as durable
  state; do not execute its lifecycle hooks or home-directory automation.
- `filesystem-context` and `context-compression`: preserve audit evidence,
  decisions, exact file paths, failures, and next actions in these records.
- `tdd` and `incremental-implementation`: work one public `build()` behavior at
  a time through observed red and focused green checks.
- `api-and-interface-design`: define a small Sophia-owned input/output boundary
  with explicit variants, validation, and consistent error semantics.
- `tool-design`: keep configuration controlled, return fields actionable, and
  error codes recoverable without exposing private text.
- `security-and-hardening`: treat candidate content and metadata as private,
  hostile input; bound work, allowlist output, and keep authorization with the
  caller.
- `evaluation` and `harness-engineering`: extend the existing deterministic,
  no-network AI evaluation surface and keep the acceptance gate separate from
  production implementation.
- `prompt-engineering-patterns`: preserve structural separation between future
  trusted prompt instructions and untrusted context data; add no prompts here.
- `documentation-and-adrs`: document the public boundary and record the
  provider-neutral deterministic assembly decision in the existing convention
  only if the audit confirms it is meaningful.
- `code-review-and-quality`: review tests first, then correctness, simplicity,
  architecture, security/privacy, performance, and scope.
- `verification-before-completion`: use fresh command evidence before any
  completion claim.
- `sophia-backend-engineer`, `sophia-context-engineer`, and
  `sophia-verification-engineer`: preserve Sophia's backend separation,
  selected-text-first reading context, provider replacement, and deterministic
  verification approach.

`using-agent-skills` and `debugging-and-error-recovery` were requested but are
not installed. Their selection and recovery responsibilities are covered by
the available workflows above.

## Instruction Conflicts and Safety Controls

- Repository instructions initially prohibited builds. The user later gave
  explicit direct authorization for the complete named runtime/build command
  list, so those exact commands were executed and recorded.
- The request explicitly authorizes the named test and verification commands,
  so focused and regression tests may be run after implementation.
- `planning-with-files` includes executable lifecycle hooks and home-directory
  lookup behavior. Only its manual Markdown workflow is selected.
- Skill helper scripts will not be executed until their source and behavior are
  inspected. Project instructions override skill defaults.
- The TDD public seam is `ContextBuilder.build(request)`, already specified by
  the user. Tests will observe only that public boundary and exported errors.
- The attached specification is concrete and is treated as the human-approved
  spec/plan gate; repository audit findings may narrow names and commands but
  may not expand scope.

## Phases

### Phase 1: Context, skills, and repository audit — complete

- Read Sophia product/AI context, relevant skills, prior S7 records, complete AI
  module, processing/domain structures, package/TypeScript/test configuration,
  validation, errors, evaluation, exports, logging, and composition.
- Search existing context-building, budgeting, truncation, provenance, and
  citation behavior; classify it before reuse.
- Record exact findings, assumptions, risks, and authoritative commands.

### Phase 2: Contract and architecture decision — complete

- Define the smallest public seam, controlled kinds, provenance, priority,
  duplicate policy, budget unit, truncation rules, required/optional behavior,
  result shape, and safe error taxonomy from audited conventions.
- Update this plan before production implementation.

Decisions:

- Public seam: synchronous `new ContextBuilder().build(unknown)` returning a
  fresh frozen `ContextPackage`.
- Controlled source kinds: `selected_passage`, `current_page`,
  `surrounding_page`, `current_chapter`, `book_metadata`, `highlight`, and
  `note`. Retrieved chunks, background knowledge, conversation, and memory are
  deferred.
- Every source carries authorized `bookId` and `userBookId` UUIDs plus a strict
  kind-appropriate allowlist of existing page/chapter/highlight/note IDs and
  page ranges. No path, storage field, raw database entity, or arbitrary
  metadata crosses the boundary.
- Required status is request policy through `requiredBlockIds`; no kind is
  inherently required. Required blocks sort first, must exist and be allowed,
  are included whole, and fail the build if their combined content exceeds the
  budget.
- Optional ordering is descending caller-controlled integer priority, then the
  documented Sophia kind order, then code-unit block-ID order. Input array and
  object iteration order do not decide output.
- Duplicate block IDs are rejected. Supported but disallowed kinds are
  machine-readably excluded unless the block is required, in which case the
  request fails.
- Budget unit is exact Unicode code points in block content. It is not a model
  token estimate. Limit and per-block content are bounded at 100,000 code
  points; candidate count is bounded at 100.
- Optional `current_page`, `surrounding_page`, and `current_chapter` blocks may
  explicitly request `preserve_start` truncation. It preserves a code-point
  prefix, appends a visible marker inside the budget, records original and
  included usage, and at most one truncated block can consume the remainder.
  Selected passages, metadata, highlights, notes, and all required blocks are
  never truncated.
- Results include ordered blocks, per-block usage/truncation state, budget
  limit/consumed/remaining, and content-free exclusions. They do not include
  `combinedText`, prompts, messages, provider fields, or logs.
- Context-domain errors use stable codes and only safe block identity/kind;
  candidate content, source objects, validator details, and unexpected cause
  messages are never copied into public messages.

### Phase 3: TDD vertical slices — complete

1. One valid block.
2. Invalid blocks and metadata.
3. Stable ordering and duplicates.
4. Budget and deterministic optional exclusions.
5. Required/missing/oversized behavior.
6. Explicit Unicode-safe truncation.
7. Mutation safety, provenance, privacy-safe errors, and instance isolation.
8. Provider-boundary regression.

### Phase 4: Deterministic evaluation and public exports — complete

- Extend the existing AI evaluation convention with the specified no-network
  context cases.
- Add only the package scripts/exports the existing architecture requires.

### Phase 5: Documentation and architecture record — complete

- Update `docs/ai-runtime.md` and the existing ADR convention if warranted.

### Phase 6: Review and verification — complete

- Apply the requested multi-axis review and fix confirmed S7-T4 defects only.
- Run fresh focused, AI regression, backend, typecheck, lint, evaluation, and
  boundary checks allowed by repository policy.
- Do not run a build; record the exact recommended build command.

## Planned Scope

Expected owning area, subject to audit:

```text
backend/src/ai/context/
├── contracts.ts
├── errors.ts
├── context-builder.ts
├── context-builder.test.ts
├── context-builder.eval.test.ts
└── index.ts
tasks/s7-t4-context-builder/
docs/ai-runtime.md
docs/context/architecture-decisions.md
```

No dependency, lockfile, environment, Prisma schema, migration, frontend,
route, controller, provider adapter, prompt definition, or application feature
wiring is planned.

## Next Step

S7-T4 is verified and ready for S7-T5. No application wiring or production AI
feature was added.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `SOPHIA_PROJECT.md` was not found at repository root. | Initial required-context read. | Confirm absence during the repository audit and use installed project context files as source of truth. |
| `jq` is not installed, so scanner JSON summarization failed. | First selected-skill static scan. | Reuse the inspected Python scanner in-process and print only severity/actionable summaries; do not install a dependency. |
| Direct Node TypeScript test execution failed with `ERR_MODULE_NOT_FOUND` for extensionless `./errors`. | First no-build test-harness probe. | Try Node's built-in specifier-resolution mode once; if extensionless TypeScript remains unsupported, do not bypass the repository build prohibition. |
| Node's `--experimental-specifier-resolution=node` still returned the same `ERR_MODULE_NOT_FOUND`, and no installed `tsx`/`ts-node` runner exists. | Second no-build test-harness probe. | Preserve test-first source order and compile-time red/green evidence with `typecheck`; leave runtime tests/build as explicit user-run gates. |
