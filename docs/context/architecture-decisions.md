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

## ADR: Prompts Are Code-Defined and Exactly Versioned

Status: Accepted on 2026-07-29

### Context

Future explanation, summary, reflection, and chat services need reproducible
prompt construction without coupling product behavior to Gemini, accepting
unvalidated context, or silently changing when a new prompt is registered.
Sophia already has normalized `AIMessage` and runtime-validation contracts but
no prompt abstraction, template engine, schema library, or production AI
feature consumer.

### Decision

- Define prompts in TypeScript with a stable lowercase ID, a canonical positive
  integer version string, an internal description, an S7-T1-compatible runtime
  input validator, and a deterministic renderer to normalized `AIMessage[]`.
- Register definitions explicitly in an instance-owned `PromptRegistry`.
- Resolve only an exact ID/version pair. Do not support “latest,” aliases,
  registration-order selection, rollout percentages, or silent replacement.
- Validate unknown input before rendering and validate/reconstruct rendered
  messages before returning them.
- Return only frozen prompt identity and normalized messages; do not expose
  definitions, schemas, raw input, providers, models, or provider options.
- Use prompt-domain errors separate from `AIError` and HTTP behavior, with
  fixed messages that omit input, rendered content, and validator issues.
- Keep the registry independent from `AIRuntime` and provider adapters. Future
  services will render first and then pass the messages to `AIRuntime`.
- Add no production definitions or application wiring until a later feature
  has a real prompt to register.

### Consequences

- Prompt behavior can be reproduced by an explicit ID/version and tested
  without credentials, providers, or network access.
- Multiple versions may coexist safely, and duplicate exact registrations fail
  instead of changing behavior.
- Code review and deterministic tests remain responsible for ensuring a
  definition does no I/O, does not close over mutable external state, and
  renders deterministically; the registry cannot prove those properties for
  arbitrary JavaScript.
- Code-defined renderers avoid a new template engine and arbitrary runtime
  expression evaluation.
- Structured message separation and validation reduce prompt-injection surface
  but do not eliminate prompt injection. Untrusted book/user content remains
  data, and permissions must be enforced in code.
- Context building, production philosophy prompts, prompt-quality evaluations,
  application composition, routes, persistence, analytics, and prompt editing
  remain later decisions.

## ADR: Context Assembly Is Deterministic and Uses Pre-Authorized Blocks

Status: Accepted on 2026-08-03

### Context

Future explanation, summary, reflection, and chat features need selected
passages and relevant reading material without coupling source selection to a
provider or mixing database access with prompt construction. Sophia has
user-owned books, pages, highlights, and notes, but S7-T4 has no product feature
service that can make an authorization or relevance decision. The ingestion
chunker has an approximate word-based token heuristic, not an authoritative
provider tokenizer or a reusable context contract.

### Decision

- Feature services must authenticate, authorize, load, and select candidate
  records before passing them to `ContextBuilder`.
- Represent candidates as Sophia-owned structured blocks with controlled
  source kinds and provenance. Do not pass raw database entities, provider
  payloads, storage paths, or arbitrary metadata.
- Build synchronously and without database, filesystem, network, provider,
  runtime, or prompt-registry calls.
- Reject invalid input and duplicate block IDs. Sort required blocks first,
  then by descending caller priority, fixed kind rank, and stable block ID.
- Use exact Unicode code points as the explicit deterministic budget unit. Do
  not describe that unit as model tokens or reuse the ingestion heuristic.
- Require every explicitly required block to exist, be allowed, and fit whole.
  Fail rather than silently remove or truncate required context.
- Exclude optional overflow with content-free reasons. Permit visible
  prefix-preserving truncation only when optional page/chapter candidates opt
  in; never truncate selected passages, metadata, highlights, or notes.
- Return frozen fresh structured blocks, controlled provenance, usage, budget,
  and exclusions. Do not concatenate context into prompt text in the builder.
- Use fixed privacy-safe context errors. Treat all candidate content as private
  and potentially instruction-like data.

### Consequences

- Context assembly is reproducible without credentials, SDKs, network access,
  or global mutable state.
- Provider replacement and prompt versioning remain independent of source
  selection and context budgeting.
- Structured output preserves the evidence-to-source relationship needed for
  future citations and audit records, while future prompt definitions retain
  control over instruction/data separation.
- Unicode code-point budgeting is intentionally conservative infrastructure,
  not exact provider token accounting. A future tokenizer policy requires a
  separate explicit decision and deterministic injection boundary.
- Authorization correctness remains a caller responsibility. The builder
  cannot prevent cross-user mixing if an upstream service supplies improperly
  authorized candidates.
- RAG chunks, retrieval/reranking, conversation history, long-term memory,
  production prompts, application composition, routes, persistence, and UI
  remain later decisions.

## ADR: Structured Outputs Are Directly Imported and Runtime-Validated

Status: Accepted on 2026-08-07

### Context

S7-T1 already defines provider-neutral structured schemas, optional JSON Schema
guidance, normalized provider values, and authoritative validation inside
`AIRuntime`. S7-T2 already parses Gemini JSON inside the adapter and forwards an
unknown candidate value. The missing application layer is exact output identity
and versioning plus a typed result that future features can consume without
constructing low-level output requirements or narrowing response unions.

The current runtime also copied arbitrary validator issue strings into public
error details and did not safely normalize malformed validator-result objects.
Those behaviors could expose generated private content or raw runtime failures.

### Decision

- Define application output contracts in TypeScript with a stable lowercase
  ID, exact positive-integer version string, internal description, the existing
  runtime validator, and optional provider-neutral JSON Schema metadata.
- Import definitions directly and select an exact constant at the feature call
  site. Do not add a registry, global mutable state, import-time registration,
  latest-version selection, migration system, or rollout mechanism.
- Add `AIRuntime.generateStructured` as a thin typed facade over the existing
  generation path. It validates/captures the definition before provider work
  and returns trusted `data` with exact output identity/version and normalized
  response metadata.
- Keep JSON parsing in provider adapters and runtime validation in `AIRuntime`.
  JSON Schema is provider guidance only; Gemini-specific support remains inside
  `GeminiProvider`.
- Classify empty, malformed, and schema-invalid structured results as
  `invalid_output`. Retain `invalid_response` for malformed provider metadata
  or normalized response envelopes.
- Do not expose validator issues or generated values in safe errors. Preserve
  unexpected causes only as internal, non-serialized diagnostics under the
  existing error policy.
- Require each definition validator to own its strict fields, nested types,
  enums, bounds, finite-number policy, and any explicit normalization. Add no
  generic repair or coercion behavior.

### Consequences

- Future feature code can request one exact output definition and consume
  strongly typed validated data without `JSON.parse`, provider imports, output
  casts, response-union narrowing, or duplicate validation.
- V1 and V2 definitions can coexist as separate imported constants without a
  mutable registry or silent version change.
- Providers may improve candidate conformance with JSON Schema, but cannot
  decide application validity or output version.
- Deterministic tests use the existing `FakeAIProvider`; malformed JSON remains
  an adapter test because provider-neutral responses already contain `unknown`.
- No production philosophy output, prompt, route, UI, persistence, RAG, memory,
  streaming, retry, fallback, or repair behavior is introduced.

## ADR: AI Tracing Uses an Instance-Owned Metadata Sink

Status: Accepted on 2026-08-07

### Context

The provider-neutral runtime now has exact prompt, context, structured-output,
provider, usage, and normalized error boundaries, but no request correlation,
duration measurement, structured logger, or trace persistence. Sophia's future
AI features and evaluations need to compare behavior without exposing private
book passages, notes, highlights, reflections, questions, or generated output.
The MVP has no trace-query feature, retention policy, or audit-grade delivery
requirement.

### Decision

- Add an optional `AITraceSink` to each explicitly composed `AIRuntime`; do not
  create global trace state or couple the runtime to Prisma, a provider, or a
  logging/telemetry framework.
- Give each configured execution a server-generated UUID, ISO wall timestamps,
  and monotonic duration, ending exactly once as success, failure, or cancelled.
- Keep call metadata separate from `AIRequest` so it cannot reach providers.
  Reconstruct prompt identity and context statistics from controlled fields,
  and capture structured-output identity from the validated S7-T5 definition.
- Record only normalized provider/model/finish/usage and normalized error code
  and retryability. Omit usage unless the provider reports the complete
  normalized counters.
- Do not record messages, prompt inputs, context content/provenance, generated
  output, validator issues, raw provider errors/responses, SDK values,
  credentials, storage paths, or user/book/resource identifiers.
- Treat trace setup, completion, and sink recording as best-effort. Their
  failures cannot replace the AI result or authoritative original error. Do not
  add console logging where no safe structured logger exists.
- Provide a deterministic in-memory sink plus injectable clock/ID sources for
  offline tests. Production defaults remain server-owned.
- Do not persist traces in S7-T6. Revisit storage only with a concrete query,
  ownership/access model, retention/deletion policy, and delivery requirement.

### Consequences

- Future S7-T7 evaluations can correlate prompt/output versions, provider/model,
  context budget statistics, latency, usage, and outcome without retaining
  private philosophical reading content.
- Future structured logger, database, or telemetry implementations can satisfy
  `AITraceSink` without changing runtime execution or provider adapters.
- Best-effort delivery is appropriate for operational MVP instrumentation but
  is not an audit log. A future audit-grade requirement needs a separate
  reliability and persistence design.
- Trace IDs remain visible through the sink boundary rather than changing the
  existing AI result/error contracts or product APIs.

## ADR: Private Chat Is Owned Through UserBook

Status: Accepted on 2026-08-20

### Context

Sophia's `Book` records may be shared by multiple users, while questions,
reflections, quoted passages, and future assistant answers are private reading
data. The schema already contains future-facing chat tables and denormalized
user/book fields, but it had no application service or API boundary.

### Decision

- Treat `UserBook` as the authoritative chat ownership boundary. Every chat
  operation derives the user from authenticated request context and scopes the
  requested session to both that user and the route's `userBookId`.
- Return 404 for malformed, missing, mismatched, or unowned chat resources.
- Expose allowlisted DTOs rather than Prisma records. Browser writes accept
  only bounded plain-text content and always assign role `user` server-side.
- Order messages by server-generated `createdAt ASC, id ASC`; the UUID
  tie-breaker provides deterministic order for equal timestamps without a
  client-controlled sequence or allocation transaction.
- Preserve the existing schema and cascade rather than removing future-facing
  columns or adding a speculative migration. Delete sessions with one scoped
  database statement and let the foreign key cascade remove messages.
- Defer assistant persistence until a production orchestration task needs an
  internal-only method. Do not call AI providers, runtime, prompts, or context
  assembly from the persistence layer.

### Consequences

- Owners of the same underlying `Book` cannot discover or mutate one another's
  conversations.
- S8-T1 has no schema migration and no new dependency.
- Public ordering is stable but does not claim that equal database timestamps
  encode request-arrival order; UUID is the documented tie-breaker.
- Existing legacy `system` and `tool` enum values remain in storage for
  compatibility but are neither writable nor readable through S8-T1 APIs.
- Later AI chat work must introduce its assistant-write boundary explicitly and
  keep authorization and private-content logging rules intact.
