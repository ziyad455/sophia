# S7-T7 Evaluation Seeds — Findings

## Skills discovered and selected

| Skill | Application |
| --- | --- |
| `evaluation` | Treat S7-T7 as deterministic outcome gates, separate infrastructure checks from later subjective quality judgments, and preserve per-case diagnostics. |
| `harness-engineering` | Keep existing evaluators locked, define narrow editable seed surfaces, use durable records, and retain human control over commits/merges. |
| `tool-design` | Add no runner abstraction unless its command, case contract, result shape, and failure recovery are unambiguous and non-duplicative. |
| `security-and-hardening` | Threat-model synthetic content, traces, safe errors, credentials, provider transports, and serialized evaluation output. |
| `spec-driven-development`, `planning-and-task-breakdown` | Use the detailed brief as the approved spec and map it to ordered phases, public seams, acceptance gates, and bounded changes. |
| `planning-with-files`, `filesystem-context`, `context-compression` | Preserve audit, decisions, case inventory, failures, and verification on disk; keep large reads/results retrievable and summarize only after preserving artifacts. |
| `tdd`, `incremental-implementation` | Add behavior through public seams one deterministic slice at a time and avoid speculative runner features. |
| `code-review-and-quality`, `documentation-and-adrs`, `verification-before-completion` | Review across required axes, explain durable evaluation policy, and make no completion claim without fresh complete evidence. |
| `prompt-engineering-patterns` | Protect explicit prompt identity/version and avoid subjective prompt optimization or content snapshots in S7-T7. |
| `sophia-backend-engineer`, `sophia-verification-engineer` | Keep the suite in the provider-neutral TypeScript backend and distinguish deterministic infrastructure evaluation from future philosophical-quality rubrics. |

Requested but unavailable: `using-agent-skills` and `debugging-and-error-recovery`.

## Skill/project instruction conflicts

- Spec/planning skills normally request an extra approval checkpoint; the user's detailed S7-T7 brief already supplies an approved specification and exact public seams.
- TDD requests pre-agreed seams; the brief explicitly names existing Sprint 7 public interfaces and the existing evaluation runner as the seams.
- Incremental implementation recommends commits per slice; commits are not authorized, so evidence will be recorded without committing.
- Project instructions normally reserve test/build execution for the user; the S7-T7 brief explicitly requests every fresh gate, so those commands are authorized.

## Audit

- `SOPHIA_PROJECT.md` is absent. The available sources of truth are `AGENTS.md`, `docs/ai-runtime.md`, existing ADRs/verification strategy, merged S7-T1 through S7-T6 task records, and current code.
- Existing evaluations already live beside their owning AI modules as ordinary Node test files: Gemini, prompt registry, context builder, structured output, and tracing each have deterministic `.eval.test.ts` coverage.
- The complete AI module contains 39 production/test/evaluation files; S7-T7 must reuse rather than relocate these locked regression surfaces.
- The runtime documentation defines one provider-neutral execution boundary, exact prompt/output versions, deterministic pre-authorized context, and metadata-only tracing. S7-T7 must compose those existing contracts; it must not add production prompts, persistence, retrieval, or provider SDK behavior.
- The accepted tracing ADR intentionally makes trace delivery best-effort and content-free. Evaluation output must therefore assert only stable case identity/category/status and never serialize prompts, context, generated values, validator issues, or error causes.
- The task brief explicitly permits ordinary tests as the execution model and requires a dedicated command only when it adds practical value. The current default is to retain Node tests and add one aggregate command, not a new runner abstraction.

### Existing evaluation infrastructure

- Evaluations are compiled TypeScript files using `node:test` and `node:assert/strict`; there is no case class, fixture registry, result database, dashboard, or standalone runner.
- Five colocated files provide 53 deterministic cases: Gemini fake transport (11), prompt registry (11), context builder (13), structured output (10), and trace logging (8).
- `FakeAIProvider` provides isolated IDs/models, ordered response/error queues, request capture, and a stable no-I/O fallback. Gemini tests inject an adapter-owned one-method `GeminiSDKClient`; tracing supplies an in-memory sink plus injectable clocks and trace IDs.
- Existing fixtures are local synthetic values defined inside their owning eval file. There are no external golden files or snapshots.
- Package scripts expose subsystem eval commands, but `test:ai-evals` currently includes only Gemini, structured-output, and tracing. Prompt/context evals require separate commands; there is no one command for all evaluation files.
- Existing case labels are readable but not globally unique (`eval 01`, `prompt eval 01`, and similar). S7-T7 should give them stable, globally distinguishable IDs without changing assertions.

### Existing coverage and gaps

- Existing evals already protect Gemini request/response/usage/error mapping, exact prompt versions, context ordering/budget/required/exclusion/truncation/provenance, structured validation/bounds/privacy, and trace success/failure/cancellation/metadata/privacy.
- Runtime text success, normalized unknown error, cancellation, and missing Gemini composition configuration exist only in unit tests, not the evaluation baseline.
- No evaluation composes `PromptRegistry -> ContextBuilder -> AIRuntime -> FakeAIProvider -> structured validation -> trace sink` as one flow.
- Provider replacement is tested at text-output and structured-output sub-boundaries, but not across the complete prompt/context/output/trace product-facing flow.
- Existing privacy cases prove trace and safe-error allowlisting, but no single case uses the required unique secret matrix and checks trace, safe error, operational metadata, and a deliberately serialized safe evaluation result together.
- Provider-neutral fake responses contain parsed `unknown` values, so malformed JSON belongs exclusively to the fake Gemini transport boundary; wrong shapes, enums, bounds, nesting, and missing fields belong to the runtime/FakeProvider boundary.

### Runner decision and future risk

- A new evaluation framework is not justified. Add one ordinary cross-layer eval file and one `eval:ai` package command that compiles once and executes every eval file. Node's TAP output already reports the stable case ID and exits non-zero on failure.
- Dangerous unprotected future changes include silently changing prompt resolution, context ordering/budget policy, structured validators, provider selection/result shapes, or trace allowlists while unit tests continue to pass in isolation.
- No safe structured logger exists in the AI path. Logger metadata is therefore not separately testable; the trace sink and explicit safe evaluation-result serialization are the applicable operational outputs.

## Implemented evaluation architecture

- Case contract: ordinary `node:test` cases named `S7-<CATEGORY>-NNN [category]: <expected behavior>`. No reusable case object was added because Node already supplies execution, case reporting, and non-zero failure behavior.
- Categories: runtime, Gemini adapter, prompt, context, structured output, trace, cross-layer, provider replacement, and privacy.
- Execution: `eval:ai` compiles once and invokes every `.eval.test.js` file sequentially. `test:ai-evals` remains a compatibility alias.
- Result format: TAP output contains the stable case ID and pass/fail status. The privacy seed's deliberately serialized safe summary contains only case ID, category, status, allowlisted traces, and normalized error metadata.
- Determinism: all providers/transports, clocks, trace IDs, prompt inputs, context blocks, and structured outputs are synthetic and local. No latency assertion or random output is used.
- Cross-layer: the new seed resolves prompt v1, builds fixed authorized context, composes normalized messages, executes `AIRuntime` through `FakeAIProvider`, validates output v1, and correlates exact prompt/context/output/provider metadata in the trace sink.
- Provider replacement: two isolated fake providers run the same prompt, context, and output contract; only normalized provider/model identities differ.
- Privacy: required passage/note/response markers remain visible in controlled request/result objects but are absent from both success/failure traces, the normalized safe error, operational metadata, and serialized evaluation summary.

## Review outcome

- Existing 53 evaluator assertions were not changed; only their case titles received globally unique IDs.
- Static review found no duplicate test IDs, network calls, environment/API-key reads, randomness, snapshots/goldens, logging, subjective scoring, or live-provider construction in evaluation files.
- The focused Oxlint review of the new seed file exited 0 with no findings.
- No production runtime contract, provider implementation, prompt/context policy, user feature, dependency, persistence, or frontend code changed.

## New seed cases

| ID | Category | Purpose | Expected result |
| --- | --- | --- | --- |
| `S7-RUNTIME-001` | runtime | Baseline normalized text generation through `FakeAIProvider`. | Exact normalized response and zero usage are returned. |
| `S7-RUNTIME-002` | runtime | Unknown provider failure privacy and taxonomy. | `provider_failure`, safe fixed message, provider identity, and no private cause serialization. |
| `S7-RUNTIME-003` | runtime | Cancellation before provider invocation. | `cancelled`, non-retryable, and zero fake-provider requests. |
| `S7-RUNTIME-004` | runtime | Missing Gemini configuration. | Composition fails clearly and the injected transport is never called. |
| `S7-HARNESS-001` | cross-layer | Prompt, context, runtime, fake provider, structured output, and tracing as one system. | Trusted result and trace carry consistent prompt/context/output/provider metadata. |
| `S7-HARNESS-002` | provider replacement | Same complete product-facing flow through Fake A and Fake B. | Prompt, context, validated data, output identity, result keys, and trace contract remain equivalent; only provider/model identity differs. |
| `S7-PRIVACY-001` | privacy | Required passage/note/response markers across success and failure paths. | Markers remain only in controlled request/result objects and are absent from traces, safe errors, operational metadata, and serialized evaluation output. |
