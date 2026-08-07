# S7-T5 Structured Output Contracts — Task Plan

## Goal

Establish only the missing provider-neutral, runtime-validated application contract for structured AI output, reusing the S7-T1/S7-T2 generation path and preserving the Sprint 7 infrastructure-only boundary.

## Controlling boundaries

- Audit before production changes; the repository is the source of truth.
- Public behavioral seam: `AIRuntime.generateStructured` with a typed output definition supplied by feature code.
- Model/provider output remains untrusted until Sophia runtime validation succeeds.
- No routes, UI, production philosophy outputs, RAG, persistence, streaming, retries, repair, fallback, or new dependencies.
- Project `AGENTS.md` normally reserves builds and tests for the user; the user explicitly authorized every listed verification command on 2026-08-07.
- Do not modify locked evaluation/test infrastructure merely to obtain a passing result.

## Phases

### Phase 1 — Context and architecture audit (complete)

- Read required project/context/config/prior-task files and the complete backend AI module.
- Map existing structured request/result/schema/parsing/provider/error/fake/evaluation behavior.
- Answer the ten audit questions in `findings.md` and identify the actual missing responsibility.

### Phase 2 — Contract and test specification (complete)

- Decide whether directly imported versioned definitions suffice or a registry is justified.
- Define the smallest public contract and privacy/error behavior.
- Add behavior-first unit/evaluation cases at the agreed seam before production implementation.

### Phase 3 — Incremental implementation (complete)

- Add the smallest provider-neutral output-definition layer.
- Reuse the current JSON Schema metadata and runtime schema abstractions.
- Integrate mandatory validation into the existing runtime path without duplicated parsing.

### Phase 4 — Documentation and review (complete)

- Update AI architecture documentation and the existing ADR convention.
- Review the diff for correctness, simplicity, architecture, security, privacy, provider neutrality, and scope.
- Record verification commands and the unverified completion decision.

### Phase 5 — Authorized verification (complete)

- Ran every exact command in `verification.md` after the user explicitly gave the green light.
- Recorded conclusive exit statuses, case counts, static boundary results, and the two unrelated lint warnings.
- No confirmed failure required a production correction; all required gates passed.

## Verification gate

Complete. Fresh execution evidence is recorded in `verification.md`; every required command produced its expected result.

## Errors encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `.git/refs/heads/feature/s7-structured-outputs.lock`: read-only filesystem | Create the suggested branch | Continue on the clean `main` worktree without commit/push; report that the changes must be moved to the suggested branch by the user. |

## Next step

Move the uncommitted changes from `main` to the suggested feature branch when Git metadata is writable, then review and commit them if desired.
