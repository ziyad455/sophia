# AI Runtime Foundation

S7-T1 establishes Sophia's provider-neutral generation boundary. Future product
features should depend on `AIRuntime`; only provider adapters and the backend
composition root should depend on `AIProvider` or `AIProviderRegistry`.

The foundation is intentionally synchronous at the response level. Streaming,
tools, prompts, context assembly, persistence, retrieval, and real provider
integration are later tasks.

## Module Layout

```text
backend/src/ai/
├── index.ts
├── contracts.ts
├── errors.ts
├── provider-registry.ts
├── structured-output.ts
├── ai-runtime.ts
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
work.

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

## S7-T1 Boundaries

Not implemented here:

- a real AI provider
- provider secrets or environment configuration
- retries, fallback routing, or timeouts
- streaming
- prompts or task modes
- chat or HTTP endpoints
- summaries, explanations, or reflection behavior
- RAG, embeddings, or memory
- AI persistence or audit tables

