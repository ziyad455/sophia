# AI Runtime, Gemini Adapter, Prompt Registry, and Context Builder

S7-T1 established Sophia's provider-neutral generation boundary. S7-T2 adds
Gemini behind that boundary. S7-T3 adds exact, code-defined prompt resolution
in front of the runtime. S7-T4 adds deterministic assembly of pre-authorized
reading context. Future product features will use `ContextBuilder`,
`PromptRegistry`, and `AIRuntime`; only provider adapters and backend
composition depend on `AIProvider`, `AIProviderRegistry`, or a provider SDK.

The runtime remains unary at the response level. Streaming, tools, production
prompts, persistence, and retrieval are later tasks. S7-T3 provides the prompt
registry contract but deliberately registers no production prompt. S7-T4
provides the context contract but deliberately loads no records and adds no
application wiring.

## Module Layout

```text
backend/src/ai/
├── composition.ts
├── index.ts
├── contracts.ts
├── errors.ts
├── provider-registry.ts
├── structured-output.ts
├── ai-runtime.ts
├── prompts/
│   ├── contracts.ts
│   ├── errors.ts
│   ├── prompt-registry.ts
│   └── index.ts
├── context/
│   ├── contracts.ts
│   ├── errors.ts
│   ├── context-builder.ts
│   └── index.ts
├── providers/
│   └── gemini/
│       ├── gemini-config.ts
│       ├── gemini-provider.ts
│       └── gemini-sdk-client.ts
└── testing/
    ├── index.ts
    └── fake-ai-provider.ts
```

## Runtime Boundary

Application composition registers provider adapters and selects one default
provider. Feature services receive the configured runtime:

```ts
import {
  AIRuntime,
  AIProviderRegistry,
} from "./ai";
import { FakeAIProvider } from "./ai/testing";

const providers = new AIProviderRegistry();

providers.register(new FakeAIProvider());

const aiRuntime = new AIRuntime({
  providers,
  defaultProviderId: "fake",
});
```

There is no global provider registry. Tests and future application composition
create isolated instances explicitly.

Provider IDs are stable lowercase identifiers of at most 64 characters. They
may contain letters, numbers, `.`, `_`, and `-`, and must start with a letter or
number. Registering the same ID twice fails instead of silently replacing an
adapter.

## Normalized Request

`AIRequest` contains:

- ordered `system`, `user`, and `assistant` text messages
- an optional model identifier
- optional temperature from 0 through 2
- an optional positive integer output-token limit
- either text output or a structured-output requirement
- an optional `AbortSignal`

Requests do not contain a provider ID. The provider is selected when the
runtime is composed, keeping product services provider-neutral.

```ts
const response = await aiRuntime.generate({
  messages: [
    {
      role: "system",
      content: "Explain the idea clearly.",
    },
    {
      role: "user",
      content: "What does this passage mean?",
    },
  ],
  temperature: 0.3,
  maxOutputTokens: 400,
});
```

The runtime validates request shape before calling a provider. It preserves the
request object and message text rather than rewriting future prompt/context
work. An already-aborted request fails before provider invocation.

## Normalized Response

Every successful response identifies:

- provider
- model
- text or structured output
- normalized finish reason
- optional normalized token usage

The runtime treats adapter responses as untrusted. It validates each normalized
field and reconstructs the return object from the allowlisted fields. Extra
provider SDK data is discarded and cannot pass through to feature code.

Supported finish reasons are:

- `stop`
- `length`
- `content_filtered`
- `unknown`

Provider adapters are responsible for mapping SDK-specific finish reasons and
token counters into these contracts.

## Structured Output

Sophia does not depend on a schema library in this foundation. A structured
schema supplies:

- a stable name
- an optional description
- an optional provider-neutral JSON Schema hint
- an authoritative validator that returns either typed data or issues

```ts
import type { StructuredOutputSchema } from "./ai";

type Reflection = {
  question: string;
};

const reflectionSchema: StructuredOutputSchema<Reflection> = {
  name: "reflection",
  jsonSchema: {
    type: "object",
    required: ["question"],
    properties: {
      question: { type: "string" },
    },
    additionalProperties: false,
  },
  validate(value) {
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>).question === "string"
    ) {
      return {
        success: true,
        value: {
          question: (value as Record<string, string>).question,
        },
      };
    }

    return {
      success: false,
      issues: ["question must be a string"],
    };
  },
};

const result = await aiRuntime.generate<Reflection>({
  messages: [{ role: "user", content: "Ask one reflection question." }],
  output: {
    type: "structured",
    schema: reflectionSchema,
  },
});
```

An adapter may use `jsonSchema` to request native structured generation, but
provider enforcement is never trusted as the final check. `AIRuntime` validates
the returned value and only then returns typed data.

Validator issues should name fields and constraints without copying private
model output into error details.

## Normalized Errors

`AIError` is independent of HTTP. Controllers added in later tasks may map it
to transport behavior without making this runtime depend on Express.

| Code | Meaning |
| --- | --- |
| `invalid_request` | The normalized request or registration input is invalid. |
| `provider_already_registered` | A provider ID was registered twice. |
| `provider_not_found` | The configured provider is unavailable in the registry. |
| `provider_authentication` | A provider rejected its credentials. |
| `rate_limited` | A provider rate limit was reached. |
| `timeout` | A provider operation timed out. |
| `cancelled` | The caller cancelled the operation. |
| `provider_unavailable` | A known temporary provider outage occurred. |
| `content_filtered` | A provider blocked output under its safety policy. |
| `invalid_response` | Provider metadata, output mode, or structured data was invalid. |
| `provider_failure` | An otherwise unknown provider failure occurred. |

Provider adapters should translate known SDK errors into `AIError` and set
`retryable` deliberately. Unknown failures are normalized to a non-retryable,
generic message. The original error is retained as `cause` for controlled
diagnostics, but its message is not copied into the normalized message.

The runtime itself does not log requests, outputs, or error causes.

## Deterministic Fake Provider

`FakeAIProvider` is the test and development harness for future AI features. It:

- records every normalized request
- returns queued responses in order
- throws queued errors in order
- returns a stable fallback response when the queue is empty
- reads no environment variables
- performs no network, filesystem, database, or logging work

```ts
const provider = new FakeAIProvider();

provider.enqueueResponse({
  providerId: "fake",
  model: "fake-model",
  output: {
    type: "text",
    text: "A controlled answer.",
  },
  finishReason: "stop",
});
```

Queued responses deliberately still pass through `AIRuntime` validation. This
makes the fake useful for testing invalid-provider and structured-output paths,
not only happy paths.

## Versioned Prompt Registry

`PromptRegistry` is a provider-neutral boundary between future feature services
and `AIRuntime`:

```text
Feature service
    ↓
PromptRegistry.render(exact ID, exact version, unknown input)
    ↓
validated normalized AI messages
    ↓
AIRuntime
    ↓
AIProvider
```

The registry never calls `AIRuntime` or a provider. It performs no network,
database, filesystem, environment, persistence, or logging work. It is
explicitly instantiated, owns a private map, and has no global instance or
import-time registration:

```ts
const promptRegistry = new PromptRegistry();
```

S7-T3 does not add this empty registry to backend application composition.
Composition will become useful only when a later feature supplies an actual
production definition.

### Prompt Definition Contract

Each code-defined `PromptDefinition<TInput>` contains:

- a stable prompt ID
- an explicit version
- a concise internal description
- an `inputSchema.validate(unknown)` function that reuses S7-T1's
  `StructuredOutputValidationResult<T>`
- a deterministic renderer that receives validated input and returns Sophia's
  existing `AIMessage[]`

The registry captures validator and renderer function references at
registration. It does not return definitions, schemas, validators, raw input,
or its internal collections.

Prompt IDs follow the same stable lowercase identifier style as provider IDs:
they start with a lowercase letter or number, contain only lowercase letters,
numbers, `.`, `_`, or `-`, and are at most 64 characters.

Prompt versions are canonical positive base-10 integer strings up to 80
characters (`"1"`, `"2"`, and so on), matching the existing future
`promptVersion` persistence metadata. `"latest"`, `"v1"`, zero, leading zeros,
semantic-version ranges, aliases, rollout percentages, and registration order
are not resolution mechanisms. Multiple versions of one ID may coexist, but an
exact ID/version pair cannot be overwritten.

### Render and Validation Boundary

`PromptRegistry.render(promptId, promptVersion, input)`:

1. validates the ID and version
2. resolves only the exact registered pair
3. validates `input` from `unknown`
4. invokes the renderer with the validator's typed value
5. validates the complete rendered message collection
6. reconstructs allowlisted `role` and `content` fields
7. returns a frozen result containing only `promptId`, `promptVersion`, and
   frozen normalized messages

Rendered output must be a non-empty array. Every entry must be a plain data
record containing exactly a supported Sophia role and non-empty string content.
The registry rejects unsupported roles, empty content, undefined or wrong
types, unexpected fields, arrays, accessors, and class/provider SDK instances.
It never drops, rewrites, or coerces an invalid message.

Each render builds fresh result objects. Freezing prevents caller mutation, and
capturing registered behavior prevents later mutation of the definition object
from replacing the stored validator or renderer.

### Prompt-Domain Errors and Privacy

Prompt failures remain separate from `AIError`, HTTP status logic, and Gemini
failures:

| Code | Meaning |
| --- | --- |
| `invalid_prompt_id` | The ID is not a stable prompt identifier. |
| `invalid_prompt_version` | The version is not a canonical positive integer string. |
| `invalid_prompt_definition` | Registration received a malformed definition. |
| `duplicate_prompt` | The exact ID/version pair is already registered. |
| `prompt_not_found` | The exact ID/version pair is not registered. |
| `invalid_prompt_input` | Unknown input failed the definition validator. |
| `invalid_rendered_prompt` | The renderer returned invalid normalized messages. |
| `prompt_render_failed` | The validator or renderer threw unexpectedly. |

Public messages are fixed. Safe, already-validated prompt identity is included
where useful, but raw input, validator issues, rendered messages, passages,
notes, highlights, and reflections are not attached. Unexpected exceptions may
be retained as a non-enumerable internal `cause`; callers must not serialize or
log causes.

Prompt input cannot select a provider, model, version alias, role, or arbitrary
provider options through this contract. Definition validators must not accept
message roles from input, and renderers should keep trusted instructions and
untrusted content in separate normalized messages.

The registry provides validation, structure, and reproducibility. It does not
completely solve prompt injection: book text and user content remain untrusted
data, and permissions or safety policy must be enforced in code rather than
assumed from delimiters or instructions.

### Prompt Tests and Evaluation

Unit tests use only test definitions and verify registration, duplicate
protection, exact versions, identity validation, input validation, deterministic
rendering, strict message validation, mutation safety, exception privacy,
definition validation, and instance isolation:

```sh
npm run test:prompts --prefix backend
```

The deterministic evaluation adds eleven cases for exact resolution,
duplicates, multiple versions, missing definitions, invalid input,
determinism, invalid messages, mutation safety, isolation, safe error content,
and provider-neutral result fields:

```sh
npm run test:prompt-evals --prefix backend
```

The initial S7-T3 baseline is 11/11 cases passing. It uses no credentials,
provider, SDK, or external call. This baseline checks architecture and
deterministic behavior; it does not evaluate future philosophy prompt quality
or prove that arbitrary third-party renderer code is deterministic.

## Context Boundary

`ContextBuilder` is a synchronous, provider-neutral boundary between an
authorized feature service and future prompt construction:

```text
Authorized feature service
    ↓ pre-authorized candidate blocks
ContextBuilder.build(request)
    ↓ validated, ordered ContextPackage
PromptRegistry
    ↓ normalized messages
AIRuntime
    ↓
AIProvider
```

S7-T4 implements only the context-builder step. It does not call
`PromptRegistry`, `AIRuntime`, a provider, the database, the filesystem, or the
network. It owns no global state and does no import-time registration.

### Authorization and Candidate Contract

The caller must authenticate the user, verify ownership of every book and
user-owned record, load the records, and decide which records are eligible.
`ContextBuilder` has no repository access and cannot perform those checks. It
must receive candidates that are already authorized for one request; callers
must never combine records from different users.

Each candidate has:

- a stable block ID
- one controlled kind
- non-empty source content
- an integer priority from 0 through 1,000
- either `none` or the narrowly allowed `preserve_start` truncation policy
- controlled provenance containing `bookId`, `userBookId`, and only the
  page/chapter/highlight/note fields valid for that kind

The supported kinds, in their fixed tie-break order, are:

1. `selected_passage`
2. `current_page`
3. `surrounding_page`
4. `current_chapter`
5. `book_metadata`
6. `highlight`
7. `note`

Retrieved chunks, RAG output, general background knowledge, conversation
history, and memory are not S7-T4 candidate kinds. Raw database entities,
storage paths, arbitrary metadata, provider fields, and executable callbacks
are rejected rather than copied.

### Ordering, Budgeting, and Truncation

`build()` validates unknown input, rejects duplicate block IDs, and constructs
a fresh ordering independent of candidate input order:

1. required blocks first
2. descending numeric priority
3. fixed kind order above
4. code-unit block-ID order

Requiredness is explicit request policy through `requiredBlockIds`; no source
kind is always required. Every required ID must exist and be allowed. Required
content is included whole, and the build fails if its combined size exceeds
the request budget.

Budget units are exact Unicode code points in candidate content. This is a
deterministic size control, not a tokenizer or model-token estimate. Requests
are bounded to 100 candidates, 100,000 code points per candidate, and a
100,000-code-point package budget.

Optional blocks that do not fit are excluded with a content-free reason.
Optional `current_page`, `surrounding_page`, and `current_chapter` blocks may
explicitly opt into `preserve_start`. That policy keeps a code-point-safe
prefix and appends `\n[context truncated]` inside the budget. Required blocks,
selected passages, book metadata, highlights, and notes are never truncated.

### Result, Errors, and Privacy

The frozen `ContextPackage` returns:

- ordered, freshly copied blocks
- controlled provenance for each included block
- original/included code-point usage and truncation state per block
- package limit, consumed, and remaining usage
- content-free optional exclusion records

It deliberately returns no combined prompt string, normalized messages,
provider/model selection, raw entity, schema, storage metadata, or logging
payload. Keeping blocks structured preserves provenance for later citations
and lets a future prompt definition decide how trusted instructions and
untrusted source material are separated.

Context errors use stable context-domain codes and fixed public messages. Safe
block identity and kind may be attached when useful; source content, provenance
objects, validation details, and unexpected exception messages are not. An
unexpected cause is retained only as an internal `Error.cause` and must not be
serialized or logged.

Book text, highlights, and notes are untrusted data even after authorization.
The builder validates and packages them but does not interpret or execute their
contents. It reduces accidental instruction/data mixing by returning structured
blocks; it does not solve prompt injection. Future prompt construction must
preserve that separation, and future retrieval must apply the same ownership
boundary before creating candidates.

### Context Tests and Evaluation

Focused unit and deterministic evaluation scripts are:

```sh
npm run test:contexts --prefix backend
npm run test:context-evals --prefix backend
npm run test:context-all --prefix backend
```

The unit suite covers strict validation, ordering, duplicates, required and
optional behavior, Unicode budgeting, truncation, provenance, frozen fresh
results, privacy-safe failures, and instance isolation. The evaluation suite
defines thirteen no-network cases for valid assembly, stable ordering,
determinism, duplicates, invalid input, budget enforcement, required content,
optional exclusion, truncation, provenance, privacy, provider neutrality, and
instruction-like source content.

These tests validate infrastructure behavior; they do not measure philosophy
answer quality, exact provider token usage, retrieval relevance, citation
quality, or prompt-injection resistance. No production source selection,
prompt definition, endpoint, persistence, or UI is included in S7-T4.

## Provider Adapter Obligations

A future real adapter must:

1. implement `AIProvider`
2. translate `AIRequest` into its SDK request without changing product meaning
3. map the SDK response into `AIProviderResponse`
4. parse structured SDK output into an unknown JavaScript value for runtime
   validation
5. map known SDK failures into the normalized error taxonomy
6. avoid returning raw SDK payloads or logging prompts, outputs, or secrets
7. have deterministic adapter tests with the SDK/network boundary mocked

Provider registration and secret-backed configuration belong in backend
composition, not in product services.

## Gemini Provider

The provider ID is `gemini`. The adapter uses the official GA
`@google/genai` package and `models.generateContent`.

Google recommends the Interactions API for new projects, but S7-T1 already
defines a unary, stateless generation contract. `generateContent` remains
supported and directly supplies the system instruction, ordered content,
structured JSON output, finish reason, usage, and `AbortSignal` surfaces needed
by that contract. Interactions would add stored interaction and step semantics
that Sophia does not need in this task.

The installed SDK is isolated in `gemini-sdk-client.ts`. The rest of the
adapter depends on a one-method, adapter-owned client boundary so tests can use
deterministic fakes. Constructing the module does not create a client or issue a
network request.

Official references:

- <https://ai.google.dev/gemini-api/docs/libraries>
- <https://ai.google.dev/gemini-api/docs/interactions-overview>
- <https://ai.google.dev/gemini-api/docs/generate-content/text-generation>
- <https://ai.google.dev/gemini-api/docs/structured-output>

### Configuration and Composition

Gemini configuration is server-only:

| Variable | Requirement |
| --- | --- |
| `GEMINI_API_KEY` | Required and non-empty when Gemini is enabled. |
| `GEMINI_MODEL` | Required and non-empty when Gemini is enabled; no model is hardcoded. |
| `GEMINI_REQUEST_TIMEOUT_MS` | Optional integer from 1,000 through 120,000; defaults to 30,000. |

If all three values are absent, unrelated backend startup remains usable and
`config.ai.gemini` is `undefined`. Partial or empty configuration fails safely.
Calling `createGeminiAIRuntime` without configuration also fails clearly.

Composition is explicit:

```ts
import { config } from "../config";
import { createGeminiAIRuntime } from "./ai/composition";

const { runtime, providers } = createGeminiAIRuntime({
  config: config.ai.gemini,
});
```

The factory creates one client and provider when called, registers provider ID
`gemini` in an instance-owned registry, and selects it as the server-controlled
default. It has no import side effects. Tests can inject a narrow fake client
or an isolated registry.

### Request Mapping

- Leading `system` messages become Gemini's `systemInstruction` in their
  original order, separated by a blank line.
- `user` remains `user`.
- `assistant` becomes Gemini's `model` role.
- A `system` message after conversation content is rejected as ambiguous.
- Model, temperature, and maximum output tokens map only from Sophia's
  normalized fields. There is no unrestricted Gemini options object.
- Structured requests set `responseMimeType: "application/json"` and forward
  `jsonSchema` only when it uses Gemini's documented supported subset.

Configured model compatibility remains an operational concern. In particular,
temperature is sent only when Sophia explicitly supplies it because model
generations differ in their sampling-parameter support.

### Response and Structured Output

The SDK boundary extracts only candidate text, model version, first-candidate
finish reason, prompt block reason, and the three normalized token counters.
SDK HTTP responses, candidates, headers, safety payloads, and unknown fields
are discarded.

Usage is returned only when prompt, candidate, and total token counts are all
reported as safe non-negative integers. Missing values are not derived or
fabricated.

For structured output:

1. the adapter optionally gives Gemini supported JSON Schema guidance
2. Gemini returns JSON text
3. the adapter safely parses it into an unknown value
4. `AIRuntime` runs the schema's authoritative validator
5. only validated typed data reaches product code

Malformed JSON, empty output, unsupported schema guidance, and wrong-shaped
values fail with safe normalized errors. Generated output is not copied into
error messages.

### Errors, Cancellation, and Privacy

The adapter prefers the SDK's numeric `ApiError.status`:

- `400` becomes `invalid_request`
- `401`/`403` become `provider_authentication`
- `408` becomes `timeout`
- `429` becomes retryable `rate_limited`
- `500`/`502`/`503`/`504` become retryable `provider_unavailable`

Known network codes use a narrow fallback. Unknown failures become
non-retryable `provider_failure`. Safety-blocked empty output becomes
`content_filtered`. Public messages are fixed and do not copy SDK messages.
The original cause remains internal, and a numeric HTTP status may appear only
in controlled error details.

Each call receives a private abort controller. Caller cancellation is forwarded
to the SDK and becomes non-retryable `cancelled`; the configured deadline
becomes retryable `timeout`. Timer and caller listener cleanup happens in
`finally`.

The SDK documents `AbortSignal` as client-side cancellation. It does not
guarantee cancellation of server processing or billing after a request has
already been sent.

The adapter adds no logging. API keys, prompts, passages, notes, reflections,
raw responses, and raw provider messages are not logged or returned.

### Testing

Normal tests inject a fake one-method Gemini client and never use credentials or
the network:

```sh
npm run test:gemini --prefix backend
npm run test:ai-evals --prefix backend
npm run test:prompts --prefix backend
npm run test:prompt-evals --prefix backend
```

The deterministic evaluation suite covers eleven adapter-boundary cases,
including provider replacement. No live integration test is included in S7-T2;
adding one later must be explicit opt-in, credential-gated, and excluded from
normal CI.

## Current Boundaries

Not implemented here:

- retries or provider fallback
- streaming
- production prompt definitions or task modes
- production context selection or application wiring
- chat or HTTP endpoints
- summaries, explanations, or reflection behavior
- RAG, embeddings, or memory
- AI persistence or audit tables
