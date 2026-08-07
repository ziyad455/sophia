# S7-T6 AI Trace Logging — Verification

Status: verified on 2026-08-07

## TDD evidence

| Behavior | Red command/result | Minimal implementation | Green command/result |
| --- | --- | --- | --- |
| Successful trace | `test:tracing` exit `2`: `TS2305` for missing trace exports and `TS2353` for missing runtime tracing option | Add immutable trace/sink/clock contracts, instance-owned runtime tracing, in-memory sink, and one success finalization path | `test:tracing` exit `0`; 1/1 passed |
| Unique trace IDs | New default-ID test passed on first run because slice 1 already invoked the server UUID factory per execution; no failure was manufactured | No production change | `test:tracing` exit `0`; 2/2 passed, both IDs matched UUIDv4 and differed |
| Prompt metadata/privacy | `test:tracing` exit `2`: second runtime argument unsupported and trace had no prompt field | Add safe prompt metadata contract, second call metadata argument, stable identity allowlisting, and reconstructed trace prompt identity | `test:tracing` exit `0`; 3/3 passed |
| Context metadata/privacy | `test:tracing` exit `2`: missing context trace helper/type/field | Add an S7-T4 package-to-metadata helper plus strict runtime allowlisting for kinds, code-point budget, block/truncation/exclusion counts | `test:tracing` exit `0`; 4/4 passed |
| Structured-output metadata/privacy | `test:tracing` exit `2`: `generateStructured` rejected a metadata argument and `AITrace` lacked `structuredOutput` | Route structured generation through one traced execution and attach the prepared definition's exact ID/version | `test:tracing` exit `0`; 5/5 passed |
| Provider/model metadata | New focused case passed on first run because the success trace already reconstructed normalized provider/model/finish fields; no failure was manufactured | No production change | `test:tracing` exit `0`; 6/6 passed |
| Reported/missing usage | New focused pair passed on first run because success tracing already conditionally copied validated usage; no failure was manufactured | No production change | `test:tracing` exit `0`; 7/7 passed |
| Normalized failure | `test:tracing` exit `2`: `AITrace` had no `errorCode` or `retryable` contract and failures were not finalized | Add safe error fields and a failure finalization path that rethrows the authoritative original error | `test:tracing` exit `0`; 8/8 passed |
| Invalid structured output | New focused case passed on first run because the failure wrapper covered S7-T5 validation and already carried output identity; no failure was manufactured | No production change | `test:tracing` exit `0`; 9/9 passed |
| Cancellation | New focused case passed on first run because normalized `cancelled` errors map to the distinct terminal status; no failure was manufactured | No production change | `test:tracing` exit `0`; 10/10 passed |
| Synthetic-secret privacy | New prompt/passage/note/highlight/response/raw-error matrix passed on first run against the allowlisted trace reconstruction; no failure was manufactured | No production change | `test:tracing` exit `0`; 11/11 passed |
| Sink failure isolation | `test:tracing` exit `2`: the in-memory sink could not be configured to fail and exposed no attempt count | Add deterministic failure configuration, then move sink recording outside execution error capture and contain sink exceptions | `test:tracing` exit `0`; 12/12 passed |
| Instance isolation | Initial test compile failed because Node's asserting `deepEqual(..., [])` narrowed a later getter read to `never`; this was a test assertion issue, not a product failure | Use a length assertion for the initially empty second sink; no production change | `test:tracing` exit `0`; 13/13 passed |
| Instrumentation failure isolation | `test:tracing` ran 14 cases with exit `1`; the new case failed because an injected trace-ID exception replaced the AI result | Contain trace setup and completion failures in addition to sink failures | `test:tracing` exit `0`; 14/14 passed |

## Baseline

- `npm run test:ai-all --prefix backend` — exit `0`; 131 existing AI unit/evaluation cases passed before tracing production code.

## Final verification commands

| Gate | Exact command | Exit | Result |
| --- | --- | --- | --- |
| Focused tracing | `npm run test:tracing-all --prefix backend` | `0` | 14 unit + 8 evaluation cases passed |
| Core AI/S7-T1 | `npm run test:ai --prefix backend` | `0` | 46 cases passed across registry, runtime, structured output, fake provider, and tracing |
| Gemini/S7-T2 | `npm run test:gemini --prefix backend` | `0` | 26 configuration, adapter, and composition cases passed; no network |
| Prompts/S7-T3 | `npm run test:prompt-all --prefix backend` | `0` | 13 unit + 11 evaluation cases passed |
| Context/S7-T4 | `npm run test:context-all --prefix backend` | `0` | 15 unit + 13 evaluation cases passed |
| Structured output/S7-T5 | `npm run test:structured-output-all --prefix backend` | `0` | 14 unit + 10 evaluation cases passed |
| Deterministic AI evaluations | `npm run test:ai-evals --prefix backend` | `0` | 11 Gemini + 10 structured-output + 8 tracing evaluations passed |
| Aggregate AI | `npm run test:ai-all --prefix backend` | `0` | 153 S7-T1 through S7-T6 unit/evaluation cases passed |
| Full backend | `npm test --prefix backend` | `0` | 124 named tests passed plus the existing preference assertion script |
| TypeScript | `npm run typecheck --prefix backend` | `0` | No diagnostics |
| Lint | `frontend/node_modules/.bin/oxlint backend/src` | `0` | No diagnostics |
| Build | `npm run build --prefix backend` | `0` | TypeScript build completed |
| Private-field static search | `rg -n '\b(messages|content|text|rawResponse|rawError|cause|stack|apiKey|authorization|filePath|storagePath|userBookId|bookId|noteId|highlightId)\b' backend/src/ai/tracing --glob '!*.test.ts'` | `1` expected | No matches in production trace modules |
| Provider boundary | `rg -n '(@google/genai|providers/gemini|Gemini|GoogleGenAI)' backend/src/ai/tracing --glob '!*.test.ts'` | `1` expected | No provider/SDK references in shared tracing |
| Coupling/logging boundary | `rg -n '(console\.|Prisma|prisma|OpenTelemetry|opentelemetry)' backend/src/ai/tracing backend/src/ai/ai-runtime.ts` | `1` expected | No console, persistence, or telemetry coupling |
| JSON ownership | `rg -n 'JSON\.parse' backend/src/ai` | `0` | Sole match remains `providers/gemini/gemini-provider.ts:494` |
| Whitespace/scope | `git diff --check && git diff --name-only && git status --short --untracked-files=all` | `0` | No whitespace errors; only S7-T6 runtime/tracing/docs/task artifacts changed |

## Completion decision

S7-T6 is verified and ready for S7-T7.
