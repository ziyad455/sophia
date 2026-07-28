# S7-T2 Verification

Status: Functional gates verified on 2026-07-28; online dependency audit
pending

## Baseline

- `npm run typecheck --prefix backend` — exit 0.
- `npm run build --prefix backend` — exit 0.
- `npm test --prefix backend` — exit 0; the complete pre-S7-T2 suite passed
  after SDK installation and before production implementation.

## Focused Tests

- `npm run test:gemini --prefix backend` — exit 0.
- Results: 4 configuration tests, 19 provider tests, and 3 composition tests;
  26 passed, 0 failed, 0 skipped.
- Node printed its expected ExperimentalWarning for the deterministic
  `MockTimers` API used by two timeout/cleanup tests.

## S7-T1 Regression Tests

- `npm run test:ai --prefix backend` — exit 0.
- Results: 21 passed, 0 failed, 0 skipped across registry, structured output,
  runtime, and fake provider.

## Full Backend Tests

- `npm test --prefix backend` — exit 0.
- Results: 71 passed, 0 failed, 0 skipped across all explicitly registered
  backend test files.

## Deterministic Evaluation Suite

- `npm run test:ai-evals --prefix backend` — exit 0.
- Results: all 11 fake-transport adapter cases passed; no network calls.

## TypeScript

- `npm run typecheck --prefix backend` — exit 0; `tsc --noEmit`.

## Lint

- `frontend/node_modules/.bin/oxlint backend/src` — exit 0.
- No S7-T2 errors or warnings. Two unchanged warnings remain in
  `backend/src/processing/pdf-text.ts` and
  `backend/src/processing/processing.service.ts`.
- Targeted new-code lint also exited 0 with no output.

## Build

- `npm run build --prefix backend` — exit 0; TypeScript build completed.
- `npm run db:validate --prefix backend` — exit 0; existing Prisma schema is
  valid.

## Dependency and Security

- `npm ls @google/genai @google/generative-ai --prefix backend --depth=0` —
  exit 0; only official `@google/genai@2.13.0` is installed.
- Initial install succeeded and reported 5 whole-tree audit findings (4
  moderate, 1 high) without attribution.
- `npm audit --prefix backend --omit=dev --json` — exit 1 because sandbox DNS
  could not reach the registry.
- An escalated retry was rejected because a registry audit submits dependency
  metadata externally; no workaround was attempted.
- `npm audit --prefix backend --omit=dev --offline --json` — exit 0; no
  vulnerabilities were present in local cached advisory data. This result is
  limited by cache freshness and does not resolve the unattributed install
  counts.
- No automatic audit fix or unrelated dependency mutation was applied.

## Vendor Boundary

- `rg -n 'from "@google/genai"|require\\("@google/genai"\\)' backend/src` —
  exit 0 with exactly one match:
  `backend/src/ai/providers/gemini/gemini-sdk-client.ts`.
- `rg -n 'geminiOptions|console\\.|logger\\.|rawResponse'` across production
  Gemini/composition files — exit 1, the expected no-match result.
- `git diff --check` — exit 0.

## Remaining Risks

- SDK cancellation is client-side only and may not cancel server processing.
- Configured model compatibility with optional temperature must be managed
  operationally.
- No live network integration test is planned or required for normal
  verification.
- A current online npm audit still requires explicit authorization to submit
  dependency metadata; the offline audit cannot establish registry freshness.
