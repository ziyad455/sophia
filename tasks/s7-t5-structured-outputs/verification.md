# S7-T5 Structured Output Contracts — Verification

Status: complete — all authorized executable and static verification passed on 2026-08-07

## Policy boundary

Repository `AGENTS.md` normally reserves builds and tests for the user. On 2026-08-07, the user explicitly authorized Codex to run every command listed below, overriding that restriction for this verification pass.

## TDD evidence

Tests were authored before the corresponding production changes, but the red executions were not permitted at that stage. “Expected red” below remains a specification rather than observed evidence; the green results were freshly observed after the user authorized execution.

| Behavior | Test written first | Expected red | Smallest implementation | Passing result |
| --- | --- | --- | --- | --- |
| Valid trusted typed data | `structured-output-contract.test.ts` typed-data case | Missing definition types and `generateStructured` | Add exact definition/request/result types and runtime facade | Passed |
| Malformed JSON | Existing Gemini unit/eval expectations changed first | Existing adapter reports `invalid_response` | Classify malformed structured JSON as `invalid_output` | Passed |
| Empty/malformed output mode | Gemini integration and fake-queue cases | Empty or text output uses prior category | Classify requested structured output failure as `invalid_output` | Passed |
| Primitive/wrong shape/missing/null | Contract table cases | No feature-facing definition path | Delegate parsed unknown to existing authoritative validator | Passed |
| Invalid enum/nested/extra properties | Strict synthetic validator cases | Invalid values must reject | No generic coercion; definition validator owns strict shape | Passed |
| Output bounds | Bounded string/array/finite-number cases | Oversized values must reject | Definition validator owns explicit limits | Passed |
| Provider schema metadata | Recorded fake request assertion | No definition-to-provider mapping | Map optional existing JSON Schema metadata into low-level schema | Passed |
| Typed feature result | Compile-time `result.data` assignments | No direct typed data result | Return `StructuredOutputResult<T>` with `data` | Passed |
| Error privacy | Private issue/output fixtures | Issue string appears in enumerable details | Remove issue strings; retain fixed identity-only details | Passed |
| Malformed validator result | Undefined/string/proxy result cases | Raw `TypeError`/reflection exception can escape | Validate result shape inside guarded helper | Passed |
| Exact version isolation | Direct v1/v2 constants | No explicit output version | Validate/capture exact version and return it with data | Passed |
| Provider neutrality/failures | Replacement-provider and error-category evals | No application definition result boundary | Keep provider metadata normalized and preserve provider error codes | Passed |

## Executed commands and evidence

Run from `/home/ziyad/projects/sophia` on 2026-08-07.

### Focused structured-output units and evaluations

```sh
npm run test:structured-output-all --prefix backend
```

Exit `0`: 14 focused unit/contract tests and 10 structured-output evals passed; 0 failed.

### S7-T1 through S7-T4 regressions

```sh
npm run test:ai --prefix backend
npm run test:gemini --prefix backend
npm run test:prompt-all --prefix backend
npm run test:context-all --prefix backend
```

- `test:ai`: exit `0`, 32 passed, 0 failed.
- `test:gemini`: exit `0`, 26 passed, 0 failed.
- `test:prompt-all`: exit `0`, 24 passed, 0 failed.
- `test:context-all`: exit `0`, 28 passed, 0 failed.

### Deterministic evaluations and complete AI module

```sh
npm run test:structured-output-evals --prefix backend
npm run test:ai-evals --prefix backend
npm run test:ai-all --prefix backend
```

- `test:structured-output-evals`: exit `0`, 10 passed, 0 failed.
- `test:ai-evals`: exit `0`, 21 passed, 0 failed.
- `test:ai-all`: exit `0`, 131 passed, 0 failed.

### Complete backend, TypeScript, lint, and build

```sh
npm test --prefix backend
npm run typecheck --prefix backend
frontend/node_modules/.bin/oxlint backend/src
npm run build --prefix backend
```

- Full backend tests: exit `0`, 110 passed, 0 failed.
- TypeScript typecheck: exit `0`.
- Oxlint: exit `0`; two pre-existing warnings remain in `backend/src/processing/pdf-text.ts:45` and `backend/src/processing/processing.service.ts:539`, outside this task's AI scope.
- Standalone backend build: exit `0`.

### Provider/privacy/scope and diff boundaries

```sh
rg -n '@google/genai|providers/gemini|Gemini' backend/src/ai/contracts.ts backend/src/ai/errors.ts backend/src/ai/structured-output.ts backend/src/ai/ai-runtime.ts
rg -n 'JSON\.parse' backend/src/ai
rg -n '\bany\b|rawResponse|details:.*issues|console\.|logger' backend/src/ai/structured-output.ts backend/src/ai/ai-runtime.ts backend/src/ai/contracts.ts
git diff --check
git status --short --untracked-files=all
```

Observed results:

- Shared contracts/runtime vendor search: exit `1` with no matches, as expected.
- AI `JSON.parse` search: one match at `backend/src/ai/providers/gemini/gemini-provider.ts:494`, as expected.
- Shared-boundary privacy/type/logging search: exit `1` with no matches, as expected.
- `git diff --check`: exit `0` with no output.
- `git status`: only the scoped S7-T5 implementation, tests, docs, and task records listed in `progress.md` are changed.

Expected static boundary results:

- no vendor/Gemini match in shared structured-output/runtime contracts
- exactly the existing Gemini adapter owns AI structured `JSON.parse`
- no `any`, raw response, public validator issue detail, or logging in the shared boundary
- no whitespace errors
- status contains only the scoped S7-T5 files described in `progress.md`

## Completion gate

S7-T5 is complete against the defined implementation, deterministic evaluation, regression, type, lint, build, privacy, provider-neutrality, and diff gates. No verification failure requires further code changes.
