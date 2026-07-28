# S7-T1 AI Provider Interface Plan

Status: Complete

Branch: `feature/s7-ai-provider-interface`

## Purpose

Create the provider-neutral runtime boundary that future Sophia AI features can
use without importing Gemini or any other provider SDK. This task establishes
infrastructure only; it does not add user-facing AI behavior.

## Scope

S7-T1 includes:

- normalized generation request and response types
- an `AIProvider` interface
- a provider registry used only at the composition boundary
- transport-independent, normalized AI errors
- runtime request and provider-response validation
- structured-output schemas and validation
- an `AIRuntime` that resolves and invokes the configured provider
- a deterministic fake provider for tests and later feature development
- unit tests and architecture documentation

S7-T1 excludes:

- Gemini or any other real provider adapter
- Express routes or controllers
- chat, summaries, explanations, or reflection features
- prompts or context assembly
- streaming
- tools or function calling
- RAG, embeddings, or memory
- persistence or Prisma changes

## Repository Audit

- The backend uses strict TypeScript, Express, feature folders, and manual
  composition. There is no dependency-injection framework and no existing
  `backend/src/ai` module.
- Existing tests are colocated `*.test.ts` files built with TypeScript and run
  with Node's test/assert modules.
- Request validation uses handwritten guards. No schema-validation package is a
  direct backend dependency, and this task must not install one.
- HTTP errors use `HttpError`; the AI layer needs errors that do not depend on
  HTTP status codes.
- No AI environment variables or secrets exist. None are needed until a real
  provider adapter is added.
- Logging is console-based and unstructured. The runtime must not log request
  content, model output, or raw provider failures.
- Existing architecture documents require provider replaceability and reserve
  orchestration, context building, prompts, RAG, and memory for separate layers.
- The backend has no lint script. Verification will invoke the repository's
  installed Oxlint binary directly against `backend/src`.

## Interface Decisions

1. Product features call `AIRuntime`, not `AIProvider`.
2. `AIProvider` receives a normalized request and returns an untrusted,
   normalized provider response. It owns provider-SDK translation only.
3. `AIRuntime` is constructed with an explicit registry and default provider
   ID. There is no global mutable registry.
4. Requests contain ordered role/content messages plus conservative generation
   options. They contain no provider ID and no Sophia feature-specific fields.
5. Responses expose provider/model identity, output, finish reason, and optional
   token usage. Raw SDK responses are not exposed.
6. Structured output uses a library-neutral schema contract with a deterministic
   validator result. The runtime validates provider data before returning it.
7. Unknown provider failures are normalized to a safe `AIError`; their original
   messages are not copied into the public error message.
8. The fake provider records requests and consumes a deterministic queue of
   responses or failures. It performs no network, environment, or database work.

## TDD Implementation Steps

### 1. Provider contracts, registry, and errors

1. Add failing tests for registration, duplicate IDs, missing providers, and
   unknown error normalization.
2. Run the focused test/build command and record the expected failure.
3. Add the smallest request/response contracts, `AIProvider`, `AIError`, and
   `AIProviderRegistry`.
4. Run the focused tests and TypeScript until green.

### 2. Structured output

1. Add failing tests for valid typed data, invalid data, validator exceptions,
   and non-structured provider output.
2. Verify failure.
3. Add the schema result contract and validation helper without a third-party
   dependency.
4. Verify focused tests pass.

### 3. AI runtime

1. Add failing tests for request forwarding, provider/model metadata,
   text output, structured output, malformed requests, malformed provider
   responses, and normalized provider errors.
2. Verify failure.
3. Implement the smallest constructor-injected `AIRuntime`.
4. Verify focused tests pass, then refactor only if all tests remain green.

### 4. Deterministic fake provider

1. Add failing tests for deterministic queue order, request recording, queued
   failures, and a stable fallback response.
2. Verify failure.
3. Implement the fake under `backend/src/ai/testing`.
4. Verify focused and full backend tests pass.

### 5. Documentation and review

1. Document the public contracts, registration example, error taxonomy,
   structured-output example, fake-provider use, and Sprint 7 boundaries.
2. Add an ADR entry explaining the provider/runtime split and library-neutral
   structured validation.
3. Review the diff for provider coupling, accidental scope expansion, secret or
   raw-output logging, unsafe error leakage, and unrelated file changes.

## Verification Gates

Run and record:

```sh
npm test --prefix backend
npm run typecheck --prefix backend
frontend/node_modules/.bin/oxlint backend/src
npm run build --prefix backend
git diff --check
```

Also run the root build to verify frontend/backend integration:

```sh
npm run build
```

Expected manual/static checks:

- no provider SDK dependency or provider name appears in product/runtime code
- no route, controller, prompt, context builder, RAG, embedding, or memory code
  is introduced
- the fake provider does not access network, environment, filesystem, or Prisma
- existing reader and frontend code remains untouched
