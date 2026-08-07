# S7-T7 Evaluation Seeds — Task Plan

## Goal

Establish Sophia's first unified deterministic, offline evaluation seed suite by extending the existing Sprint 7 test infrastructure, including cross-layer, provider-replacement, and privacy regressions without adding model-quality scoring or user-facing AI features.

## Current phase

Complete and verified

## Next step

No implementation or verification work remains. The uncommitted scoped changes are ready for user review and placement on the suggested branch when Git metadata is writable.

## Boundaries

- The supplied S7-T7 brief is the approved specification and acceptance gate.
- Audit and extend existing evaluation infrastructure; do not create a competing framework.
- Evaluations are deterministic pass/fail infrastructure checks using synthetic data and no network, credentials, copyrighted text, model judging, or persistent results.
- Existing unit/evaluation files are regression surfaces; add the smallest readable seed layer without weakening prior checks.
- No user-facing AI feature, RAG, memory, scoring, analytics, dependency, persistence, migration, commit, push, or PR without explicit authorization.
- The brief explicitly authorizes the focused/full tests, lint, typecheck, build, privacy, network, and provider-boundary gates despite the repository's normal user-run verification policy.

## Public seams

- Existing Node test runner and backend package evaluation scripts.
- Provider-neutral `PromptRegistry`, `ContextBuilder`, `AIRuntime`, structured-output definition, `AITraceSink`, and `FakeAIProvider` public interfaces.
- Gemini adapter only through its existing fake SDK transport.

## Phases

### Phase 1 — Context and evaluation audit (`complete`)

- Read required project context, S7-T1 through S7-T6 records, complete AI module, evaluation files, configuration, logging, and relevant skills.
- Inventory existing runners, cases, fixtures, fake boundaries, gaps, and privacy/network risks.

### Phase 2 — Evaluation architecture (`complete`)

- Decide whether ordinary Node tests plus one aggregate command remain sufficient.
- Define stable case IDs/categories, explicit expected outcomes, cross-layer composition, safe failure reporting, and locked regression surfaces.

### Phase 3 — Incremental implementation (`complete`)

- Add one deterministic seed case first, then cross-layer, privacy, provider replacement, and remaining regression seeds through public seams.
- Run focused evaluation evidence after each meaningful slice; add no unnecessary abstraction or CLI feature.

### Phase 4 — Documentation and review (`complete`)

- Document purpose, categories, commands, offline/privacy rules, provider replacement, cross-layer coverage, limitations, and Sprint 8 extension path.
- Review correctness, simplicity, architecture, security/privacy, determinism, diagnostics, performance, provider neutrality, and scope.

### Phase 5 — Fresh verification (`complete`)

- Run the focused evaluation command, all S7-T1 through S7-T6 and aggregate AI/backend gates, TypeScript, lint, build, privacy, no-network, provider-boundary, and scope checks.
- Record exact commands/exits/results before the Sprint decision.

## Decisions

| Decision | Rationale |
| --- | --- |
| Treat the supplied brief as the approved specification | It fixes the goal, public seams, exclusions, case families, TDD order, and acceptance criteria. |
| Use one sequential implementation stream | The cross-layer seed depends on one shared evaluation contract/runner decision; no delegation was requested. |
| Preserve existing evaluations as locked regression surfaces | S7-T7 should compose and aggregate them, not rewrite criteria to make the new suite pass. |

## Errors encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `using-agent-skills` is not installed | Skill discovery | Apply the available named project skills directly and record the gap. |
| `debugging-and-error-recovery` is not installed | Skill discovery | Use the durable error log and three-strike workflow from `planning-with-files`. |
| `.git/refs/heads/feature/s7-evaluation-seeds.lock`: read-only filesystem | Create the suggested branch | Continue with scoped, uncommitted changes on `main`; do not commit or push. |
