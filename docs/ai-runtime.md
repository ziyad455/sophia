# AI Runtime and Gemini Adapter

S7-T1 established Sophia's provider-neutral generation boundary. S7-T2 adds
Gemini behind that boundary. Future product features depend on `AIRuntime`;
only provider adapters and backend composition depend on `AIProvider`,
`AIProviderRegistry`, or a provider SDK.

The runtime remains unary at the response level. Streaming, tools, prompts,
context assembly, persistence, and retrieval are later tasks.

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

## Context Boundary

This task affects only the provider/runtime layer. It does not decide which
context Sophia should send.

- Static product rules remain in repository context and future system prompts.
- Dynamic reading context remains selected passage, book/chapter data, notes,
  highlights, retrieved chunks, conversation state, and memory.
- A later context builder and prompt composer will choose and separate those
  layers before producing `AIRequest.messages`.

No textual evidence or interpretive background is assembled by S7-T1.

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
```

The deterministic evaluation suite covers eleven adapter-boundary cases,
including provider replacement. No live integration test is included in S7-T2;
adding one later must be explicit opt-in, credential-gated, and excluded from
normal CI.

## Current Boundaries

Not implemented here:

- retries or provider fallback
- streaming
- prompts or task modes
- chat or HTTP endpoints
- summaries, explanations, or reflection behavior
- RAG, embeddings, or memory
- AI persistence or audit tables
