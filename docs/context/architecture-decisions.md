# Architecture Decisions

## Current MVP Architecture

Frontend:
React + TypeScript

Backend:
Express.js + TypeScript

Database:
PostgreSQL + Prisma

Storage:
Local file system for PDFs during MVP

AI:
Provider abstraction

Future:
pgvector for vector search
RAG for book/chapter context
Long-term memory for personalization

## Principles

- Keep the MVP simple.
- Do not introduce microservices.
- Do not introduce Python unless necessary.
- Do not couple the app directly to one AI provider.
- Keep the AI provider replaceable.
- Build services around product features, not technical buzzwords.

## Main Backend Areas

- books
- reader
- chat
- ai
- notes
- highlights
- memory

## ADR: Provider-Neutral AI Runtime Foundation

Status: Accepted on 2026-07-28

### Context

Sprint 7 will add AI capabilities after Sophia already has user-owned books,
reading structure, notes, highlights, and reading sessions. Those product
features must not become coupled to Gemini or another provider SDK. The backend
currently uses simple manual composition and has no dependency-injection or
schema-validation framework.

### Decision

- Product services will call a constructor-injected `AIRuntime`.
- Provider SDK adapters will implement the normalized `AIProvider` interface.
- Providers will be registered in an explicit, instance-owned registry at the
  backend composition boundary. There will be no global registry.
- The default provider will be selected when `AIRuntime` is constructed, not in
  individual AI requests.
- Requests will contain provider-neutral messages and conservative generation
  options. Responses will expose only allowlisted normalized fields.
- Structured output will use a library-neutral schema contract with optional
  JSON Schema metadata and mandatory runtime validation.
- Provider failures will use a transport-independent `AIError` taxonomy.
  Unknown error messages and raw provider payloads will not cross the runtime
  boundary.
- A deterministic in-memory fake provider will be the default test harness for
  later AI feature work.

### Consequences

- Future chat, summary, explanation, and reflection services can remain
  independent of provider SDKs.
- A real adapter must translate requests, responses, finish reasons, usage, and
  known errors into Sophia's contracts.
- Runtime composition must explicitly register an adapter and choose a default
  provider before AI calls can run.
- Native provider structured-output support may improve generation, but Sophia's
  own validation remains authoritative.
- Streaming, retry/fallback policy, timeouts, prompts, context building, RAG,
  embeddings, memory, endpoints, and persistence remain separate future
  decisions.

## ADR: Gemini Uses the GenerateContent Adapter

Status: Accepted on 2026-07-28

### Context

Google's current GA JavaScript/TypeScript SDK is `@google/genai`. Google
recommends the Interactions API for new projects, while `generateContent`
remains supported. Sophia's S7-T1 provider interface is already unary and
stateless; it has no stored interaction IDs, steps, background execution, or
server-owned conversation state.

### Decision

- Use `@google/genai` with `models.generateContent` for the S7-T2 Gemini
  adapter.
- Keep SDK imports and response objects inside Gemini-specific adapter code.
- Construct the SDK client only through explicit runtime composition.
- Select model ID from validated server configuration rather than an adapter
  default.
- Use Gemini JSON Schema support as optional generation guidance, with
  `AIRuntime` validation remaining authoritative.
- Forward caller cancellation through the SDK's `AbortSignal` and enforce a
  bounded adapter deadline.
- Add the provider-neutral `AIRequest.signal` field and `cancelled` error code
  because S7-T1 could not otherwise express the required cancellation
  behavior.

### Consequences

- The existing provider-neutral product contract stays unary and does not gain
  Gemini interaction state.
- Future provider replacement remains possible without changing product
  services.
- Streaming, tools, and stateful interaction features require separate
  decisions rather than leaking through an unrestricted provider-options
  escape hatch.
- SDK cancellation is client-side only and may not stop server processing or
  billing.
- Configured model compatibility, including optional sampling settings, must be
  managed operationally.
