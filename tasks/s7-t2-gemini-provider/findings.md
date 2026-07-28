# S7-T2 Findings

## Repository Audit

- S7-T1 is merged into clean `main` at `85bbb96`.
- `AIProvider` receives `AIRequest<unknown>` and returns
  `AIProviderResponse`.
- `AIRuntime` validates requests, resolves one configured provider from an
  instance-owned registry, invokes it, strips extra provider fields, and runs
  structured validation.
- `AIProviderRegistry` rejects unstable IDs and duplicates.
- `AIError` is transport-independent and currently includes
  `invalid_request`, provider configuration/transport categories,
  `invalid_response`, and `provider_failure`.
- `StructuredOutputSchema` exposes optional `jsonSchema` metadata and an
  authoritative validator.
- `FakeAIProvider` is deterministic and performs no I/O.
- There is no cancellation field or `cancelled` error category.
- Tests are colocated TypeScript files compiled before execution with
  `node:test` and `node:assert`.
- Environment configuration is parsed centrally in `backend/src/config.ts`.
- Configuration is evaluated at backend import/startup, so Gemini must remain
  optional when both key and model are absent.
- There is no DI framework. Composition is manual and instance-owned.
- Logging is console-based around startup and processing only. The adapter must
  add no logging.
- Backend uses npm with `backend/package-lock.json`, Node `v22.23.1`,
  TypeScript `6.0.3`, strict `NodeNext` module resolution.
- Before S7-T2, neither `@google/genai` nor legacy
  `@google/generative-ai` was installed.
- No Gemini code exists in the repository.

## Official SDK/API Research

Official sources checked on 2026-07-28:

- Google SDK library guide:
  <https://ai.google.dev/gemini-api/docs/libraries>
- Gemini API overview:
  <https://ai.google.dev/api>
- Interactions overview:
  <https://ai.google.dev/gemini-api/docs/interactions-overview>
- GenerateContent text generation:
  <https://ai.google.dev/gemini-api/docs/generate-content/text-generation>
- Structured output:
  <https://ai.google.dev/gemini-api/docs/structured-output>
- Official JavaScript SDK reference:
  <https://googleapis.github.io/js-genai/>
- GenerateContent configuration:
  <https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html>
- GenerateContent response:
  <https://googleapis.github.io/js-genai/release_docs/classes/types.GenerateContentResponse.html>
- SDK `ApiError`:
  <https://googleapis.github.io/js-genai/release_docs/classes/errors.ApiError.html>

Findings:

- The official GA JavaScript/TypeScript SDK is `@google/genai`.
- `@google/generative-ai` is legacy and not actively maintained.
- Interactions is GA and recommended for new projects; `generateContent`
  remains fully supported and is the direct unary generation API.
- `GenerateContentConfig` supports `systemInstruction`, `temperature`,
  `maxOutputTokens`, `responseMimeType`, `responseJsonSchema`, and
  `abortSignal`.
- `abortSignal` stops the client-side operation only; Google warns it may not
  cancel server processing or billing.
- `GenerateContentResponse` exposes text, candidates, `modelVersion`, full SDK
  HTTP response, and usage metadata. Sophia must allowlist only normalized
  fields and discard the SDK HTTP response.
- JSON Schema support is a documented subset. Sophia's runtime validator must
  remain authoritative.
- The SDK exposes `ApiError.status` as a structured HTTP status.
- Installed `@google/genai` version `2.13.0` requires Node 20 or newer.
- Its installed `GenerateContentParameters` type requires `model` and
  `contents`, with an optional `GenerateContentConfig`.
- Its installed types confirm optional `promptTokenCount`,
  `candidatesTokenCount`, and `totalTokenCount`; usage must be omitted unless
  all normalized fields are actually reported.
- Its installed `HttpOptions` also exposes a millisecond timeout, while the
  adapter still needs a controller to distinguish caller cancellation from its
  own deadline.
- Stable model IDs change over time. The model must be validated configuration,
  not a hardcoded adapter default.
- Current newest stable models deprecate sampling parameters. Sophia will map
  `temperature` only when the caller explicitly supplies it and document that
  configured model compatibility is operationally significant.

## Selected API

Use `models.generateContent`.

Reason:

- exact fit for S7-T1's unary contract
- direct system/content role mapping
- direct candidate finish reason and token usage
- direct structured JSON Schema guidance
- direct `AbortSignal`
- no state storage, interaction IDs, server-side history, steps, agents,
  background jobs, or streaming

This is a contained adapter decision, not a claim that Interactions is inferior.

## Risks

- The S7-T1 cancellation gap was corrected with provider-neutral
  `AIRequest.signal` and `cancelled`; the contract and adapter tests are green.
- Gemini's supported JSON Schema is a subset; unsupported keywords must be
  rejected before transport.
- SDK cancellation does not guarantee server-side cancellation.
- New model generations may reject temperature. The adapter cannot infer model
  capabilities from an arbitrary configured ID.
- Raw SDK error messages may contain request/provider details and must never be
  copied into safe messages.
- There is no existing AI consumer, so composition must be a factory without
  unused global state or import-time client creation.
- Installing the SDK reported five whole-tree dependency audit findings (four
  moderate, one high) but did not print attribution. A fresh registry audit was
  unavailable in the sandbox and external submission of the dependency graph
  was not authorized. The local offline production audit exited 0 with no
  cached findings, but that is not a substitute for a current registry audit.
- No live Gemini call was made. Unit and evaluation coverage prove the adapter
  boundary deterministically, not credential/model availability.
