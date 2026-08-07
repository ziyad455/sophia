# S7-T6 AI Trace Logging — Task Plan

## Goal

Add the smallest provider-neutral, privacy-safe AI execution trace boundary around `AIRuntime`, with deterministic offline verification and no persistence, telemetry dependency, or feature behavior.

## Current phase

Phase 5 — Fresh verification (`complete`)

## Next step

All planned implementation, review, documentation, and verification work is complete. No commit, push, or PR was authorized.

## Controlling boundaries

- The repository is the source of truth; audit before choosing the trace contract.
- Tracing observes execution and never controls providers, prompts, context, retries, results, or errors.
- Metadata is the default; private prompt, book, note, highlight, reflection, response, SDK, credential, and raw error content must not enter traces.
- Prefer dependency injection and best-effort sink isolation; do not add persistence or dependencies without evidence.
- No routes, UI, RAG, embeddings, memory, streaming, fallback, retries, scoring, or monitoring SaaS.
- The user explicitly requested the fresh test, lint, typecheck, and build gates in the task brief, overriding the repository's normal user-run verification boundary for this task.
- No commit, push, PR, migration, or package installation without explicit authorization.
- Existing evaluation/test infrastructure is a locked verification surface; change only task-owned tests and script wiring justified by the feature.

## Public seams to verify

- `AIRuntime.generate` and `AIRuntime.generateStructured` as the execution seams.
- An injected trace sink as the observation seam, subject to the architecture audit.
- A deterministic in-memory sink for behavior inspection without I/O or global state.

## Phases

### Phase 1 — Context and architecture audit (`complete`)

- Read required project, architecture, prior-task, AI module, logger, database, evaluation, and configuration files.
- Audit existing trace/request IDs, timing, safe prompt/context/output/provider/usage/error metadata, privacy risks, and persistence need.
- Record answers and affected seams in `findings.md` before production code.

### Phase 2 — Contract specification (`complete`)

- Define the minimal trace lifecycle, immutable contract, ID/clock strategy, sink policy, and runtime integration.
- Map only metadata justified by current types.
- Finalize behavior cases and verification commands.

### Phase 3 — TDD vertical slices (`complete`)

- For each required behavior, write one failing seam-level test, run it red, implement the smallest change, and rerun green.
- Add success, uniqueness, metadata, usage absence, failures, invalid output, cancellation, privacy, sink isolation, and instance isolation incrementally.
- Keep tests deterministic and offline.

### Phase 4 — Documentation and multi-axis review (`complete`)

- Update `docs/ai-runtime.md` and the existing ADR convention for the meaningful architecture decision.
- Review correctness, simplicity, architecture, security/privacy, performance, harness/evaluation integrity, provider neutrality, and scope.
- Fix confirmed defects only.

### Phase 5 — Fresh verification (`complete`)

- Run focused tracing, S7-T1 through S7-T5 regressions, evaluations, full backend, typecheck, lint, build, privacy searches, provider-boundary searches, and diff checks.
- Record exact commands, exits, and counts in `verification.md`.
- Make the completion decision only from fresh evidence.

## Decisions

| Decision | Rationale |
| --- | --- |
| Treat the supplied brief as the approved specification | It provides explicit seams, ordering, boundaries, acceptance criteria, and verification requirements; audit findings may narrow but not broaden it. |
| Use direct, sequential TDD rather than sub-agents | The contract and runtime integration form one dependency chain, and no instruction explicitly requests delegation. |
| Inject an optional instance-owned `AITraceSink` into `AIRuntime` | The runtime owns execution outcomes; a sink keeps observation replaceable and avoids Prisma/logger/provider coupling. |
| Keep trace metadata separate from `AIRequest` | Prompt/context identity is operational metadata and must never be forwarded to an `AIProvider` or mixed with model input. |
| Use server-generated UUIDs and monotonic duration | UUIDs encode no identity; wall timestamps support correlation while monotonic elapsed time avoids clock-adjustment errors. Deterministic ID/clock injection is limited to composition/tests. |
| Use best-effort awaited recording with contained sink failures | Each completed trace is offered exactly once; a sink failure never replaces the AI result/error, and no logger exists for a safe secondary report. |
| Do not persist traces in S7-T6 | No production AI consumer, retention policy, audit-grade requirement, or trace query exists; persistence adds privacy and migration cost without an MVP need. |

## Errors encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `using-agent-skills` not installed | Skill discovery | Apply the available domain/workflow skills directly and record their use. |
| `debugging-and-error-recovery` not installed | Skill discovery | Use the planning skill's logged-error and three-strike workflow if failures occur. |
| `.git/refs/heads/feature/s7-ai-tracing.lock`: read-only filesystem | Create the suggested branch | Continue with scoped, uncommitted changes on `main`; do not commit or push. |
| `apply_patch` rejected a malformed multi-file hunk | Add prompt trace metadata | Split the edit into valid contract/export and runtime patches; no partial file change occurred. |
