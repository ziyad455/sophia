# S8-T1 Chat Sessions and Messages Foundation — Task Plan

## Goal

Build the smallest secure backend conversation foundation for private chat sessions and persisted messages owned through an authenticated user's `UserBook`, without any AI generation or reader UI.

## Current phase

Implementation and source verification complete; user-run compiled verification pending

## Next step

Wait for the user to run the compiled chat/backend/AI/build commands and report their results.

## Boundaries

- The supplied S8-T1 brief is the approved specification and acceptance gate.
- `UserBook` is the private ownership boundary; a shared `Book` never grants chat access.
- Controllers stay thin; services own authorization, persistence, ordering, and transaction behavior.
- Browser input can create only user messages and cannot control identity, role, ordering, provider, model, prompt, or AI settings.
- No Gemini, production `AIRuntime`, production prompt/context policy, RAG, memory, streaming, UI, or new dependency.
- The supplied brief explicitly authorizes focused and regression tests. Repository policy prohibits running builds; the exact build command will be handed to the user.
- No commit, push, or PR was requested.

## Public seams

- Authenticated Express routes mounted by the current backend composition root.
- Chat session and message DTOs returned through the existing API response conventions.
- Chat service operations backed by Prisma and existing ownership/error conventions.

## Phases

### Phase 1 — Context, skills, and backend audit (`complete`)

- Read the required project, Sprint 7, schema, auth, ownership, route, validation, migration, testing, and composition-root context.
- Inventory existing chat schema/code and record the smallest implementation.

### Phase 2 — Contract and persistence decisions (`complete`)

- Lock route, DTO, validation, ordering, ownership, cascade, index, and internal assistant-boundary decisions in findings.
- Add only the migration/schema changes the audit proves necessary.

### Phase 3 — Incremental TDD implementation (`complete`)

- Implement owned session creation/list/get, user-message creation, deterministic ordering, and deletion only if existing API conventions support it.
- Run each focused red-green slice through agreed public service/route seams and record evidence.

### Phase 4 — Documentation and review (`complete`)

- Update the appropriate API/database/runtime/roadmap documentation without claiming AI chat generation exists.
- Review correctness, simplicity, architecture, security/privacy, API contracts, query behavior, and scope.

### Phase 5 — Fresh verification (`in_progress`)

- Run authorized focused chat, ownership/security, backend, AI regression, Prisma validation, TypeScript, lint, and static scope/privacy checks.
- Do not run a build; record the build command for the user and make the completion decision from actual evidence.

## Decisions

| Decision | Rationale |
| --- | --- |
| Treat the supplied brief as the approved specification | It defines the goal, public behaviors, exclusions, TDD order, and acceptance criteria. |
| Use one sequential implementation stream | No delegation was requested, and schema/API/test slices share one contract. |
| Preserve existing chat models until the audit proves changes are required | The initial scan found both models already exist; duplication would violate scope. |
| Keep normal persistence/security checks out of AI evaluations | S8-T1 has no model behavior; deterministic backend tests are the correct boundary. |
| Order messages by `createdAt ASC, id ASC` | The existing timestamp plus server UUID provides a stable total order and avoids speculative sequence allocation; clients control neither value. |
| Create no migration | Existing relations, cascade, and indexes support the required query paths; S8-T1 needs application boundaries, not schema expansion. |
| Preserve legacy future-facing chat columns and enum values | Removing pre-existing schema would be destructive and unrelated; S8-T1 DTOs and writes expose only the approved subset. |
| Defer the assistant write method | There is no production caller in S8-T1; S8-T2 can add an internal-only method against the same service boundary. |
| Add hard session deletion | Existing feature routes use DELETE/204, and the current foreign key cascades messages atomically. |

## Errors encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `using-agent-skills` is not installed | Required skill discovery | Apply the available named project skills directly and record the gap. |
| `debugging-and-error-recovery` is not installed | Required skill discovery | Use the durable error log and three-strike workflow from `planning-with-files`. |
| Headroom proxy at `127.0.0.1:8787` is unreachable | Compress large skill output | Continue with bounded reads and durable summaries, per the repository fallback instruction. |
| `SOPHIA_PROJECT.md` is absent | Required context lookup | Use `AGENTS.md`, current docs, task records, schema, and code as repository sources of truth. |
| Direct Node TypeScript test run could not resolve extensionless imports | Run authorized tests without the prohibited build | Added a temporary `/tmp` ESM resolver; the same source test then passed without emitting build artifacts. |
| First full source regression run could not resolve directory imports | Run all backend/AI tests through the temporary resolver | Extended the temporary resolver to map existing directory imports to `index.ts`; the next full run passed all 27 files. |
