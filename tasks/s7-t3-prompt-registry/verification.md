# S7-T3 Verification

Status: Verified on 2026-07-29

## Baseline

- `npm run typecheck --prefix backend` — exit 0.
- `npm run test:ai --prefix backend` — exit 0; 21 passed, 0 failed.
- `npm run test:gemini --prefix backend` — exit 0; 26 passed, 0 failed.
- `npm run test:ai-evals --prefix backend` — exit 0; 11 passed, 0 failed.
- The S7-T2 provider tests emitted the existing expected Node ExperimentalWarning
  for the deterministic MockTimers API.

## Focused Prompt Registry Tests

- `npm run test:prompts --prefix backend` — exit 0.
- Result: 13 passed, 0 failed, 0 skipped.
- Covers exact registration/rendering, duplicates, explicit versions,
  missing/invalid identity, unknown input, determinism, rendered messages,
  malformed validator results, mutation safety, exception privacy, isolation,
  and malformed definitions.

## All Prompt Module Tests

- `npm run test:prompt-all --prefix backend` — exit 0.
- Result: 13 unit tests and 11 deterministic evaluations passed.

## Deterministic Prompt Evaluation

- `npm run test:prompt-evals --prefix backend` — exit 0.
- Result: all 11 required cases passed; no provider, SDK, credential, or
  network call.
- Cases: exact resolution, duplicates, multiple versions, missing definition,
  invalid input, determinism, invalid messages, mutation safety, isolation,
  safe errors, and provider-neutral result fields.

## All AI Module Tests

- `npm run test:ai-all --prefix backend` — exit 0.
- Result: 82 checks passed across S7-T1 units (21), prompt units/evals (24),
  S7-T2 units (26), and Gemini adapter evals (11).

## Regressions

- `npm run test:ai --prefix backend` — exit 0.
  - S7-T1: 21 passed, 0 failed.
- `npm run test:gemini --prefix backend` — exit 0.
  - S7-T2: 4 configuration, 19 provider, and 3 composition tests passed;
    26 total, 0 failed.
  - Node emitted the existing expected ExperimentalWarning for MockTimers.
- `npm run test:ai-evals --prefix backend` — exit 0.
  - Existing Gemini adapter evaluation: 11 passed, 0 failed.

## Complete Backend Suite

- `npm test --prefix backend` — exit 0.
- Result: 84 passed, 0 failed, 0 skipped across every explicitly registered
  backend test file.

## TypeScript, Lint, and Build

- `npm run typecheck --prefix backend` — exit 0; `tsc --noEmit`.
- `frontend/node_modules/.bin/oxlint backend/src` — exit 0.
  - No S7-T3 warning or error.
  - Two unchanged warnings remain in:
    - `backend/src/processing/pdf-text.ts:45`
    - `backend/src/processing/processing.service.ts:539`
- `npm run build --prefix backend` — exit 0; TypeScript build completed.

## Static Boundary Checks

- Vendor imports in production prompt files:
  `rg -n '@google/genai|@google/generative-ai|providers/gemini|GeminiSDK|GeminiGenerateContent' backend/src/ai/prompts --glob '!*.test.ts' --glob '!*.eval.test.ts'`
  — exit 1, the expected no-match result.
- Provider/runtime coupling:
  `rg -n 'AIProvider|AIRequest|AIRuntime|providerOptions|GEMINI_|process\.env' backend/src/ai/prompts --glob '!*.test.ts' --glob '!*.eval.test.ts'`
  — exit 1, the expected no-match result.
- Sensitive logging and broad `any`:
  `rg -n 'console\.|logger\.|\bany\b' backend/src/ai/prompts --glob '!*.test.ts' --glob '!*.eval.test.ts'`
  — exit 1, the expected no-match result.
- Production registry wiring:
  `rg -n 'new PromptRegistry|PromptRegistry\(' . --glob '!ai/prompts/*.test.ts' --glob '!ai/prompts/*.eval.test.ts'`
  from `backend/src` — exit 1, the expected no-match result.
- Whole backend vendor boundary:
  `rg -n 'from "@google/genai"|require\("@google/genai"\)' backend/src` —
  exit 0 with exactly one existing match in
  `backend/src/ai/providers/gemini/gemini-sdk-client.ts`.
- `git diff -- backend/package-lock.json frontend/package-lock.json package-lock.json`
  — exit 0 with no output; no dependency or lockfile changed.
- `git diff --check` — exit 0.
- `npm audit --prefix backend --omit=dev --offline` — exit 0; local cached
  advisory data reported 0 vulnerabilities. This offline result does not prove
  registry freshness, but S7-T3 changed no dependency or lockfile.

## Files in Scope

- Modified:
  - `backend/package.json`
  - `backend/src/ai/index.ts`
  - `docs/ai-runtime.md`
  - `docs/context/architecture-decisions.md`
- Created:
  - six files under `backend/src/ai/prompts/`
  - four durable records under `tasks/s7-t3-prompt-registry/`
- No frontend, route, controller, environment, Prisma, migration, provider
  adapter, dependency, or lockfile file changed.

## Remaining Limitations

- No production prompt, prompt consumer, application composition, route, UI,
  persistence, or live provider call belongs to S7-T3.
- Determinism can be specified and tested for definitions, but the registry
  cannot mathematically prove an arbitrary registered renderer is free of
  clocks, randomness, or external mutable closure state. Production definition
  review and deterministic tests remain required.
- Structural separation and validation reduce prompt-injection surface; they do
  not eliminate prompt injection.
