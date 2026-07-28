# S7-T2 Gemini Provider Adapter Plan

Status: Implementation complete; online dependency audit pending

Branch: `feature/s7-gemini-provider-adapter`

## Objective

Connect the official Gemini JavaScript/TypeScript SDK to Sophia's S7-T1
provider-neutral runtime without exposing Gemini types or behavior to shared
contracts or product services.

## Selected Skills

- `sophia-backend-engineer`: provider adapter, server configuration, explicit
  composition, and simple TypeScript module boundaries.
- `sophia-context-engineer`: preserve normalized message meaning without adding
  prompts, philosophy behavior, RAG, or memory.
- `sophia-product-planner`: keep S7-T2 limited to the adapter and controlled
  composition.
- `sophia-verification-engineer`: deterministic unit/evaluation harnesses,
  red-green evidence, and fresh completion gates.

The generic workflow skill names requested by the task are not installed.
Their practices are applied directly through these task files, strict TDD,
interface review, security review, and command evidence.

## Scope

Included:

- official `@google/genai` dependency
- Gemini `generateContent` adapter
- validated optional server configuration
- explicit instance-owned provider registration and runtime composition
- normalized text and structured-output mapping
- normalized finish reason and usage mapping
- safe error mapping
- cancellation and request timeout behavior
- deterministic fake-SDK tests and adapter evaluations
- documentation and ADR update

Excluded:

- user-facing routes or UI
- chat, summaries, passage explanations, or prompts
- streaming
- tools or function calling
- RAG, embeddings, vector search, or memory
- persistence, jobs, retries, or provider fallback

## Architecture Decision

Use the official `@google/genai` SDK with `models.generateContent`.

Google recommends the Interactions API for new projects, but S7-T1 already
defines a unary, stateless request/response contract. `generateContent` remains
fully supported and directly provides the required system instruction, ordered
content roles, structured JSON schema, candidate finish reason, usage metadata,
and `AbortSignal` configuration. Adopting Interactions would introduce stored
interaction and step semantics that S7-T1 does not need.

The configured model ID is mandatory when Gemini is enabled. No production
default model will be hardcoded.

## Proven S7-T1 Contract Defect

S7-T1 has no cancellation field and no normalized `cancelled` error even though
S7-T2 requires cancellation to pass from `AIRuntime` to a provider.

Before changing the shared contract:

1. add a failing runtime contract test
2. record the failure
3. add only `AIRequest.signal?: AbortSignal` and `cancelled`
4. make already-aborted requests fail before provider invocation
5. rerun all S7-T1 tests

The existing structured-output failure code is `invalid_response`, not
`invalid_output`. The repository contract remains authoritative; S7-T2 will not
rename it.

## TDD Sequence

1. Cancellation contract correction.
2. Gemini configuration parsing and optional-startup behavior.
3. Gemini provider contract and stable provider ID.
4. Text message and generation-option mapping.
5. Text response allowlisting, finish reason, and optional usage mapping.
6. Structured request guidance, JSON parsing, and mandatory runtime validation.
7. Safe error normalization by SDK status and narrow transport fallbacks.
8. Already-aborted, active cancellation, timeout, and cleanup behavior.
9. Explicit registry/runtime composition and missing configuration.
10. Privacy boundary and vendor import search.
11. Deterministic adapter evaluation suite.
12. Documentation, ADR, and final review.

For every behavior:

1. write the test
2. run it and record the expected failure
3. implement the smallest correction
4. run the focused test
5. refactor only after green

## Planned Module Boundary

```text
backend/src/ai/
├── composition.ts
└── providers/
    └── gemini/
        ├── gemini-config.ts
        ├── gemini-provider.ts
        └── gemini-sdk-client.ts
```

Only provider-specific files and AI composition may import `@google/genai`.
Shared contracts, `AIRuntime`, product modules, and HTTP modules may not.

## Verification Gates

```sh
npm run test:gemini --prefix backend
npm run test:ai --prefix backend
npm test --prefix backend
npm run test:ai-evals --prefix backend
npm run typecheck --prefix backend
frontend/node_modules/.bin/oxlint backend/src
npm run build --prefix backend
npm audit --prefix backend --omit=dev
git diff --check
```

Vendor boundary:

```sh
rg -n 'from "@google/genai"|require\\("@google/genai"\\)' backend/src
```
