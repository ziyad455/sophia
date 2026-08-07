# S7-T6 AI Trace Logging — Findings

## Initial state

- Worktree was clean on `main` before S7-T6 task-file creation.
- No existing S7-T6 memory entry was found; current repository state remains authoritative.
- The requested branch is `feature/s7-ai-tracing`; creation failed because `.git/refs` is read-only, so work continues scoped and uncommitted on `main`.

## Skills discovered and selected

| Skill | Application |
| --- | --- |
| `planning-with-files`, `filesystem-context`, `context-compression` | Preserve the plan, audit, progress, failures, evidence, and artifact trail while keeping source reads targeted. |
| `spec-driven-development`, `planning-and-task-breakdown` | Treat the detailed brief as the approved spec and translate it into ordered, bounded phases and acceptance gates. |
| `tdd`, `incremental-implementation` | Work through one public runtime behavior per red-green slice rather than bulk implementation. |
| `api-and-interface-design`, `tool-design` | Make the trace and sink contracts explicit, minimal, predictable, and difficult to misuse. |
| `security-and-hardening`, `sophia-context-engineer` | Threat-model content leakage and enforce a metadata-only allowlist across prompt, context, output, provider, and error paths. |
| `harness-engineering`, `evaluation`, `sophia-verification-engineer` | Keep evaluators deterministic and offline, make traces reproducible, and isolate the observation harness from AI behavior. |
| `prompt-engineering-patterns` | Preserve prompt identity/version for comparisons without tracing rendered prompt content or inputs. |
| `sophia-backend-engineer` | Keep tracing inside the provider-neutral backend orchestration boundary with no routes or direct Prisma/provider coupling. |
| `documentation-and-adrs`, `code-review-and-quality`, `verification-before-completion` | Record the architectural rationale, review across required axes, and make no completion claim without fresh gates. |

Requested but unavailable: `using-agent-skills` and `debugging-and-error-recovery`.

## Skill/project instruction conflicts

- `spec-driven-development` and `planning-and-task-breakdown` normally require a separate human approval gate. The user's detailed brief already fixes the objective, boundaries, seams, order, and acceptance criteria, so it serves as approval to proceed after the repository audit.
- `tdd` requires pre-agreed public seams. The brief pre-agrees the `AIRuntime` execution seam and a possible injected sink observation seam; the audit may choose a smaller compatible shape.
- `incremental-implementation` recommends committing each slice. Commits are not authorized, so slices will remain uncommitted and be verified after each meaningful change.
- Repository instructions normally reserve builds/tests for the user. This brief explicitly requires Codex to run fresh tests, lint, typecheck, and build, so those commands are authorized for S7-T6.

## Architecture audit

- `SOPHIA_PROJECT.md` is not present in the current repository; the root `AGENTS.md`, `docs/ai-runtime.md`, existing ADRs, Sprint 7 records, and Sophia context files provide the available source of truth.
- S7-T1 recorded console-based, unstructured backend logging and deliberately prohibited AI request/output/raw-failure logging.
- Current production logging remains limited to startup/shutdown and unrelated book/processing warnings; there is no logger abstraction, request/correlation ID facility, structured logger dependency, or AI logging.
- `AIRuntime` currently exposes normalized request/response validation, usage, error, cancellation, and structured-output seams but deliberately performs no logging.
- Existing ADRs require instance-owned provider/prompt/context boundaries, exact prompt/output versions, privacy-safe errors, and no global mutable state.
- S7-T4 context usage is exact Unicode code-point budgeting, not provider tokens; any trace must preserve that semantic distinction.
- S7-T5 retains JSON parsing in adapters and application validation in `AIRuntime`; malformed generated content must never enter a trace.

### Audit answers

1. **Existing observability:** no AI trace, request/correlation ID, timing helper, structured logger, or trace persistence exists. The AI module intentionally logs nothing.
2. **Before execution:** `AIRuntime` knows the configured provider ID, normalized request shape/options, caller cancellation, output mode/schema name, and—through `generateStructured`—the exact output ID/version. It does not know prompt/context identity unless the caller supplies safe metadata.
3. **After execution:** the runtime knows the normalized provider/model, finish reason, complete reported usage when present, trusted output mode/value, or an authoritative normalized `AIError` code/retryability/provider ID. It never receives raw SDK metadata.
4. **Safe metadata:** server-generated trace ID, controlled operation name, timestamps/duration, prompt/output identity/version, context counts/kinds/code-point budget statistics, normalized provider/model/finish/usage, lifecycle status, and normalized error code/retryability. User/book/resource IDs have no current tracing purpose and are excluded.
5. **Persistence:** not justified for the MVP. The schema contains future chat/summary content models but no trace model, no retention policy, no audit-grade requirement, and no production AI caller. S7-T6 will add no Prisma model or migration.
6. **Sink boundary:** an injected `AITraceSink` is cleaner than storage/logger coupling. It allows future structured logging, persistence, or telemetry without changing execution and enables an isolated deterministic test sink.
7. **Unsafe current logging:** no prompt, passage, note, highlight, generated response, raw SDK payload, or raw provider error is logged by the AI module. Unrelated console warnings exist in book/processing code but are outside the AI execution path.

## Selected architecture

- Add a provider-neutral `backend/src/ai/tracing/` module containing immutable trace/metadata/sink/clock contracts and a deterministic `InMemoryAITraceSink`.
- Add optional instance-owned tracing configuration to `AIRuntime`; keep existing construction valid and add no global mutable sink.
- Accept optional safe trace metadata as a separate runtime-call argument, never as part of `AIRequest`, so providers receive the exact existing request object and no trace fields.
- Default operation names distinguish text/low-level generation from application structured generation. A caller may supply only a stable controlled operation name plus prompt/context metadata; the runtime reconstructs an allowlisted copy and ignores malformed/extra metadata rather than changing AI behavior.
- Generate trace IDs with server-side `randomUUID()`. Use wall-clock ISO timestamps for correlation and a monotonic clock for duration. Allow injected ID/clock functions only for deterministic composition/tests.
- `generateStructured` adds exact S7-T5 output ID/version automatically. Low-level `generate` does not invent a missing output version.
- Success traces include actual normalized provider/model/finish reason and only fully reported usage. Failures include only normalized error code/retryability; cancellation is a distinct terminal status.
- Context metadata preserves the S7-T4 unit name `unicode_code_points`, included block count/kinds, budget values, truncated count, and excluded count. It never contains block IDs, source IDs, provenance, or content.
- Trace finalization happens once in the runtime's execution wrapper. Sink writes are awaited and exceptions contained, preserving the original result/error. With no safe existing logger, sink failures are intentionally silent rather than sent to `console`.
- Do not attach trace IDs to existing AI results or errors in this infrastructure-only task; the sink is the correlation boundary, avoiding changes to product error/result semantics. A future transport/logger sink can expose correlation deliberately.

## Threat model

- Trust boundaries: caller request metadata, rendered prompt messages, selected context, provider response/SDK data, normalized result, normalized error, trace sink.
- Primary assets: private reading passages, notes, highlights, reflections, questions, generated explanations, future memory, credentials, and provider error details.
- Principal abuse case: an allowlist omission or object spread copies private content or raw provider data into a trace or trace-sink failure path.
- Default mitigation: construct traces from explicit safe scalar/enum/count fields only; never accept user-supplied trace IDs; contain sink failures.
