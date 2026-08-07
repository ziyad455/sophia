import assert from "node:assert/strict";
import test from "node:test";
import type {
  AIProvider,
  AIProviderResponse,
  AIRequest,
  StructuredOutputSchema,
} from "./contracts";
import { AIError } from "./errors";
import { AIProviderRegistry } from "./provider-registry";
import { AIRuntime } from "./ai-runtime";

type ProviderHandler = (
  request: AIRequest<unknown>,
) => Promise<AIProviderResponse>;

function createRuntime(handler: ProviderHandler): {
  runtime: AIRuntime;
  provider: AIProvider;
} {
  const provider: AIProvider = {
    id: "fake",
    generate: handler,
  };
  const providers = new AIProviderRegistry();

  providers.register(provider);

  return {
    runtime: new AIRuntime({
      providers,
      defaultProviderId: "fake",
    }),
    provider,
  };
}

function textResponse(
  overrides: Partial<AIProviderResponse> = {},
): AIProviderResponse {
  return {
    providerId: "fake",
    model: "fake-model",
    output: {
      type: "text",
      text: "The examined life asks us to question our assumptions.",
    },
    finishReason: "stop",
    usage: {
      inputTokens: 12,
      outputTokens: 10,
      totalTokens: 22,
    },
    ...overrides,
  };
}

function hasAIError(code: AIError["code"]) {
  return (error: unknown) =>
    error instanceof AIError &&
    error.code === code;
}

test("forwards a normalized request unchanged to the configured provider", async () => {
  let receivedRequest: AIRequest<unknown> | undefined;
  const { runtime } = createRuntime(async (request) => {
    receivedRequest = request;
    return textResponse();
  });
  const request: AIRequest = {
    messages: [
      {
        role: "system",
        content: "Explain the idea clearly.",
      },
      {
        role: "user",
        content: "What does Socrates mean?",
      },
    ],
    model: "fake-model",
    temperature: 0.3,
    maxOutputTokens: 400,
  };

  const response = await runtime.generate(request);

  assert.equal(receivedRequest, request);
  assert.deepEqual(response, textResponse());
});

test("validates structured provider data before returning a typed response", async () => {
  type Explanation = {
    simple: string;
  };
  const schema: StructuredOutputSchema<Explanation> = {
    name: "passage_explanation",
    validate(value) {
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as Record<string, unknown>).simple === "string"
      ) {
        return {
          success: true,
          value: {
            simple: (value as Record<string, string>).simple,
          },
        };
      }

      return {
        success: false,
        issues: ["simple must be a string"],
      };
    },
  };
  const { runtime } = createRuntime(async () => ({
    providerId: "fake",
    model: "fake-model",
    output: {
      type: "structured",
      value: {
        simple: "Examine what you take for granted.",
      },
    },
    finishReason: "stop",
  }));

  const response = await runtime.generate<Explanation>({
    messages: [{ role: "user", content: "Explain this passage." }],
    output: {
      type: "structured",
      schema,
    },
  });

  assert.deepEqual(response.output, {
    type: "structured",
    value: {
      simple: "Examine what you take for granted.",
    },
  });
});

test("rejects malformed requests before calling a provider", async () => {
  let providerCalls = 0;
  const { runtime } = createRuntime(async () => {
    providerCalls += 1;
    return textResponse();
  });
  const invalidRequests = [
    { messages: [] },
    { messages: [{ role: "user", content: "   " }] },
    { messages: [{ role: "developer", content: "Unsupported role." }] },
    { messages: [{ role: "user", content: "Question" }], model: "   " },
    { messages: [{ role: "user", content: "Question" }], temperature: 3 },
    {
      messages: [{ role: "user", content: "Question" }],
      maxOutputTokens: 0,
    },
  ] as AIRequest[];

  for (const request of invalidRequests) {
    await assert.rejects(runtime.generate(request), hasAIError("invalid_request"));
  }

  assert.equal(providerCalls, 0);
});

test("requires provider output to match the requested output mode", async () => {
  const structuredSchema: StructuredOutputSchema<{ answer: string }> = {
    name: "answer",
    validate: () => ({
      success: true,
      value: { answer: "A" },
    }),
  };
  const textRuntime = createRuntime(async () => ({
    ...textResponse(),
    output: {
      type: "structured",
      value: { answer: "A" },
    },
  })).runtime;
  const structuredRuntime = createRuntime(async () => textResponse()).runtime;

  await assert.rejects(
    textRuntime.generate({
      messages: [{ role: "user", content: "Question" }],
    }),
    hasAIError("invalid_response"),
  );
  await assert.rejects(
    structuredRuntime.generate({
      messages: [{ role: "user", content: "Question" }],
      output: {
        type: "structured",
        schema: structuredSchema,
      },
    }),
    hasAIError("invalid_output"),
  );
});

test("rejects malformed normalized provider metadata", async () => {
  const malformedResponses: AIProviderResponse[] = [
    textResponse({ providerId: "another-provider" }),
    textResponse({ model: "   " }),
    textResponse({ finishReason: "unsupported" as "stop" }),
    textResponse({
      usage: {
        inputTokens: -1,
        outputTokens: 2,
        totalTokens: 1,
      },
    }),
  ];

  for (const response of malformedResponses) {
    const { runtime } = createRuntime(async () => response);

    await assert.rejects(
      runtime.generate({
        messages: [{ role: "user", content: "Question" }],
      }),
      hasAIError("invalid_response"),
    );
  }
});

test("returns only normalized fields and discards extra provider payload data", async () => {
  const { runtime } = createRuntime(async () => ({
    ...textResponse(),
    rawResponse: {
      secret: "provider-specific data",
    },
  } as AIProviderResponse));

  const response = await runtime.generate({
    messages: [{ role: "user", content: "Question" }],
  });

  assert.equal(Object.hasOwn(response, "rawResponse"), false);
  assert.deepEqual(response, textResponse());
});

test("normalizes unknown provider failures without exposing their message", async () => {
  const { runtime } = createRuntime(async () => {
    throw new Error("API key secret should not leak");
  });

  await assert.rejects(
    runtime.generate({
      messages: [{ role: "user", content: "Question" }],
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "provider_failure" &&
      error.providerId === "fake" &&
      error.message === "The AI provider request failed." &&
      error.message.includes("secret") === false,
  );
});

test("rejects an already-cancelled request before invoking the provider", async () => {
  const controller = new AbortController();
  let providerCalls = 0;
  const { runtime } = createRuntime(async () => {
    providerCalls += 1;
    return textResponse();
  });

  controller.abort();

  await assert.rejects(
    runtime.generate({
      messages: [{ role: "user", content: "Explain this passage." }],
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "cancelled" &&
      error.retryable === false,
  );
  assert.equal(providerCalls, 0);
});
