import assert from "node:assert/strict";
import test from "node:test";
import type {
  AIProvider,
  StructuredOutputSchema,
} from "../../contracts";
import { AIError } from "../../errors";
import { AIRuntime } from "../../ai-runtime";
import { AIProviderRegistry } from "../../provider-registry";
import type {
  GeminiGenerateContentRequest,
  GeminiSDKClient,
} from "./gemini-sdk-client";
import { GeminiProvider } from "./gemini-provider";

function createClient(
  handler: (
    request: GeminiGenerateContentRequest,
  ) => ReturnType<GeminiSDKClient["generateContent"]>,
): {
  client: GeminiSDKClient;
  requests: GeminiGenerateContentRequest[];
} {
  const requests: GeminiGenerateContentRequest[] = [];

  return {
    requests,
    client: {
      generateContent(request) {
        requests.push(request);
        return handler(request);
      },
    },
  };
}

test("implements AIProvider with a stable Gemini identity", async () => {
  const { client } = createClient(async () => ({
    text: "A careful examination begins with the claim itself.",
    modelVersion: "configured-model-001",
    candidates: [{ finishReason: "STOP" }],
  }));
  const provider: AIProvider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  const response = await provider.generate({
    messages: [
      {
        role: "user",
        content: "How should I begin examining this argument?",
      },
    ],
  });

  assert.equal(provider.id, "gemini");
  assert.deepEqual(response, {
    providerId: "gemini",
    model: "configured-model-001",
    output: {
      type: "text",
      text: "A careful examination begins with the claim itself.",
    },
    finishReason: "stop",
  });
});

test("maps leading system instructions, ordered roles, and normalized settings", async () => {
  const { client, requests } = createClient(async () => ({
    text: "The answer.",
    candidates: [{ finishReason: "STOP" }],
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  await provider.generate({
    messages: [
      { role: "system", content: "Be clear." },
      { role: "system", content: "Preserve uncertainty." },
      { role: "user", content: "What is the claim?" },
      { role: "assistant", content: "The initial claim." },
      { role: "user", content: "What supports it?" },
    ],
    model: "runtime-selected-model",
    temperature: 0.25,
    maxOutputTokens: 500,
  });

  const mappedRequest = requests[0];
  const {
    abortSignal,
    ...mappedConfig
  } = mappedRequest?.config ?? {};

  assert.ok(abortSignal);
  assert.deepEqual(
    {
      model: mappedRequest?.model,
      contents: mappedRequest?.contents,
      config: mappedConfig,
    },
    {
      model: "runtime-selected-model",
      contents: [
        {
          role: "user",
          parts: [{ text: "What is the claim?" }],
        },
        {
          role: "model",
          parts: [{ text: "The initial claim." }],
        },
        {
          role: "user",
          parts: [{ text: "What supports it?" }],
        },
      ],
      config: {
        systemInstruction: {
          parts: [{ text: "Be clear.\n\nPreserve uncertainty." }],
        },
        temperature: 0.25,
        maxOutputTokens: 500,
      },
    },
  );
});

test("rejects a system instruction after conversation content", async () => {
  const { client, requests } = createClient(async () => ({
    text: "This must not be called.",
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  await assert.rejects(
    provider.generate({
      messages: [
        { role: "user", content: "First question." },
        { role: "system", content: "Late instruction." },
      ],
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_request" &&
      error.providerId === "gemini" &&
      error.retryable === false,
  );
  assert.equal(requests.length, 0);
});

test("rejects a system-only request that cannot produce Gemini content", async () => {
  const { client, requests } = createClient(async () => ({
    text: "This must not be called.",
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  await assert.rejects(
    provider.generate({
      messages: [{ role: "system", content: "Only an instruction." }],
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_request" &&
      error.providerId === "gemini",
  );
  assert.equal(requests.length, 0);
});

test("rejects an empty text response without exposing generated content", async () => {
  const { client } = createClient(async () => ({
    text: "   ",
    candidates: [{ finishReason: "STOP" }],
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  await assert.rejects(
    provider.generate({
      messages: [{ role: "user", content: "Explain the distinction." }],
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_response" &&
      error.providerId === "gemini" &&
      error.retryable === false &&
      error.message.includes("   ") === false,
  );
});

test("returns only normalized response fields and falls back to the requested model", async () => {
  const { client } = createClient(async () => ({
    text: "A normalized answer.",
    candidates: [
      {
        finishReason: "STOP",
        privateCandidateData: "discard-me",
      },
    ],
    sdkHttpResponse: {
      headers: {
        authorization: "discard-me",
      },
    },
  } as never));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  const response = await provider.generate({
    messages: [{ role: "user", content: "Question." }],
  });

  assert.deepEqual(response, {
    providerId: "gemini",
    model: "configured-model",
    output: {
      type: "text",
      text: "A normalized answer.",
    },
    finishReason: "stop",
  });
  assert.equal(Object.hasOwn(response, "sdkHttpResponse"), false);
  assert.equal(Object.hasOwn(response, "candidates"), false);
});

test("maps supported structured schema metadata and parses JSON output", async () => {
  type Answer = {
    claim: string;
  };
  const jsonSchema = {
    type: "object",
    properties: {
      claim: {
        type: "string",
        description: "The central claim.",
      },
    },
    required: ["claim"],
    additionalProperties: false,
  } as const;
  const schema: StructuredOutputSchema<Answer> = {
    name: "argument_claim",
    jsonSchema,
    validate: () => ({
      success: true,
      value: { claim: "Validated later by AIRuntime." },
    }),
  };
  const { client, requests } = createClient(async () => ({
    text: '{"claim":"Virtue requires examination."}',
    candidates: [{ finishReason: "STOP" }],
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  const response = await provider.generate({
    messages: [{ role: "user", content: "Identify the claim." }],
    output: {
      type: "structured",
      schema,
    },
  });

  const {
    abortSignal,
    ...structuredConfig
  } = requests[0]?.config ?? {};

  assert.ok(abortSignal);
  assert.deepEqual(structuredConfig, {
    responseMimeType: "application/json",
    responseJsonSchema: jsonSchema,
  });
  assert.deepEqual(response.output, {
    type: "structured",
    value: {
      claim: "Virtue requires examination.",
    },
  });
});

test("rejects unsupported Gemini schema guidance before calling the SDK", async () => {
  const { client, requests } = createClient(async () => ({
    text: '{"claim":"Not called."}',
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  const unsupportedSchemas = [
    {
      type: "object",
      patternProperties: {
        "^claim$": { type: "string" },
      },
    },
    {
      $ref: "#/$defs/claim",
      type: "string",
      $defs: {
        claim: {
          type: "string",
        },
      },
    },
  ];

  for (const jsonSchema of unsupportedSchemas) {
    await assert.rejects(
      provider.generate({
        messages: [{ role: "user", content: "Identify the claim." }],
        output: {
          type: "structured",
          schema: {
            name: "unsupported_schema",
            jsonSchema,
            validate: () => ({
              success: true,
              value: {},
            }),
          },
        },
      }),
      (error: unknown) =>
        error instanceof AIError &&
        error.code === "invalid_request" &&
        error.providerId === "gemini" &&
        error.message.includes("patternProperties") === false,
    );
  }
  assert.equal(requests.length, 0);
});

test("rejects malformed structured JSON without exposing generated output", async () => {
  const rawOutput = '{"claim":';
  const { client } = createClient(async () => ({
    text: rawOutput,
    candidates: [{ finishReason: "STOP" }],
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  await assert.rejects(
    provider.generate({
      messages: [{ role: "user", content: "Identify the claim." }],
      output: {
        type: "structured",
        schema: {
          name: "argument_claim",
          validate: () => ({
            success: true,
            value: {},
          }),
        },
      },
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_response" &&
      error.providerId === "gemini" &&
      error.message.includes(rawOutput) === false,
  );
});

test("keeps AIRuntime validation authoritative for Gemini structured output", async () => {
  type Claim = {
    claim: string;
  };
  const schema: StructuredOutputSchema<Claim> = {
    name: "claim",
    validate(value) {
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as Record<string, unknown>).claim === "string"
      ) {
        return {
          success: true,
          value: {
            claim: (value as Record<string, string>).claim,
          },
        };
      }

      return {
        success: false,
        issues: ["claim must be a string"],
      };
    },
  };
  const responses = [
    '{"claim":"Examine the premise."}',
    '{"claim":42}',
    "   ",
  ];
  const { client } = createClient(async () => ({
    text: responses.shift(),
    candidates: [{ finishReason: "STOP" }],
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });
  const providers = new AIProviderRegistry();

  providers.register(provider);

  const runtime = new AIRuntime({
    providers,
    defaultProviderId: "gemini",
  });
  const request = {
    messages: [{ role: "user" as const, content: "Identify the claim." }],
    output: {
      type: "structured" as const,
      schema,
    },
  };

  const valid = await runtime.generate(request);

  assert.deepEqual(valid.output, {
    type: "structured",
    value: {
      claim: "Examine the premise.",
    },
  });
  await assert.rejects(
    runtime.generate(request),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_response" &&
      error.providerId === "gemini",
  );
  await assert.rejects(
    runtime.generate(request),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_response" &&
      error.providerId === "gemini",
  );
});

test("maps reported token usage and never fabricates incomplete usage", async () => {
  const sdkResponses = [
    {
      text: "Complete usage.",
      candidates: [{ finishReason: "MAX_TOKENS" }],
      usageMetadata: {
        promptTokenCount: 14,
        candidatesTokenCount: 6,
        totalTokenCount: 20,
      },
    },
    {
      text: "Partial usage.",
      candidates: [{ finishReason: "STOP" }],
      usageMetadata: {
        promptTokenCount: 14,
      },
    },
  ];
  const { client } = createClient(async () => sdkResponses.shift() ?? {});
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });
  const request = {
    messages: [{ role: "user" as const, content: "Question." }],
  };

  const complete = await provider.generate(request);
  const partial = await provider.generate(request);

  assert.equal(complete.finishReason, "length");
  assert.deepEqual(complete.usage, {
    inputTokens: 14,
    outputTokens: 6,
    totalTokens: 20,
  });
  assert.equal(Object.hasOwn(partial, "usage"), false);
});

test("normalizes supported Gemini finish reasons", async () => {
  const cases = [
    ["STOP", "stop"],
    ["MAX_TOKENS", "length"],
    ["SAFETY", "content_filtered"],
    ["RECITATION", "content_filtered"],
    ["BLOCKLIST", "content_filtered"],
    ["PROHIBITED_CONTENT", "content_filtered"],
    ["SPII", "content_filtered"],
    ["OTHER", "unknown"],
    [undefined, "unknown"],
  ] as const;

  for (const [geminiReason, expected] of cases) {
    const { client } = createClient(async () => ({
      text: "Mapped.",
      candidates: [{ finishReason: geminiReason }],
    }));
    const provider = new GeminiProvider({
      client,
      model: "configured-model",
      timeoutMs: 30_000,
    });

    const response = await provider.generate({
      messages: [{ role: "user", content: "Question." }],
    });

    assert.equal(response.finishReason, expected);
  }
});

test("normalizes structured Gemini API status errors with safe retryability", async () => {
  const cases = [
    [400, "invalid_request", false],
    [401, "provider_authentication", false],
    [403, "provider_authentication", false],
    [408, "timeout", true],
    [429, "rate_limited", true],
    [500, "provider_unavailable", true],
    [502, "provider_unavailable", true],
    [503, "provider_unavailable", true],
    [504, "provider_unavailable", true],
    [418, "provider_failure", false],
  ] as const;
  const unsafeMessage =
    "GEMINI_API_KEY=secret passage='private philosophical reflection'";

  for (const [status, code, retryable] of cases) {
    const providerError = Object.assign(new Error(unsafeMessage), { status });
    const { client } = createClient(async () => {
      throw providerError;
    });
    const provider = new GeminiProvider({
      client,
      model: "configured-model",
      timeoutMs: 30_000,
    });

    await assert.rejects(
      provider.generate({
        messages: [{ role: "user", content: "Private question." }],
      }),
      (error: unknown) =>
        error instanceof AIError &&
        error.code === code &&
        error.providerId === "gemini" &&
        error.retryable === retryable &&
        error.cause === providerError &&
        error.message.includes("secret") === false &&
        error.message.includes("private") === false,
    );
  }
});

test("normalizes known network failures and unknown errors safely", async () => {
  const cases = [
    {
      error: Object.assign(new Error("socket included private prompt"), {
        code: "ECONNRESET",
      }),
      expectedCode: "provider_unavailable",
      retryable: true,
    },
    {
      error: new Error("fetch failed with private prompt", {
        cause: Object.assign(new Error("DNS lookup failed"), {
          code: "EAI_AGAIN",
        }),
      }),
      expectedCode: "provider_unavailable",
      retryable: true,
    },
    {
      error: new Error("unknown failure included private prompt"),
      expectedCode: "provider_failure",
      retryable: false,
    },
  ] as const;

  for (const { error: providerError, expectedCode, retryable } of cases) {
    const { client } = createClient(async () => {
      throw providerError;
    });
    const provider = new GeminiProvider({
      client,
      model: "configured-model",
      timeoutMs: 30_000,
    });

    await assert.rejects(
      provider.generate({
        messages: [{ role: "user", content: "Private question." }],
      }),
      (error: unknown) =>
        error instanceof AIError &&
        error.code === expectedCode &&
        error.retryable === retryable &&
        error.message.includes("private") === false,
    );
  }
});

test("normalizes an empty safety-blocked response as content filtering", async () => {
  const { client } = createClient(async () => ({
    candidates: [{ finishReason: "SAFETY" }],
    promptFeedback: {
      blockReason: "SAFETY",
    },
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  await assert.rejects(
    provider.generate({
      messages: [{ role: "user", content: "Question." }],
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "content_filtered" &&
      error.providerId === "gemini" &&
      error.retryable === false,
  );
});

test("rejects an already-aborted signal before calling Gemini", async () => {
  const controller = new AbortController();
  const { client, requests } = createClient(async () => ({
    text: "This must not be called.",
  }));
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  controller.abort();

  await assert.rejects(
    provider.generate({
      messages: [{ role: "user", content: "Question." }],
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "cancelled" &&
      error.retryable === false,
  );
  assert.equal(requests.length, 0);
});

test("forwards active cancellation through Gemini's AbortSignal", async () => {
  const controller = new AbortController();
  let sdkSignal: AbortSignal | undefined;
  const { client } = createClient(async (request) => {
    sdkSignal = request.config?.abortSignal;

    if (!sdkSignal) {
      throw new Error("Missing SDK abort signal.");
    }

    return new Promise((_, reject) => {
      sdkSignal?.addEventListener(
        "abort",
        () => reject(new DOMException("SDK aborted.", "AbortError")),
        { once: true },
      );
    });
  });
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });
  const pending = provider.generate({
    messages: [{ role: "user", content: "Question." }],
    signal: controller.signal,
  });

  controller.abort();

  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "cancelled" &&
      error.retryable === false,
  );
  assert.equal(sdkSignal?.aborted, true);
});

test("normalizes the configured request deadline as timeout", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });

  const { client } = createClient(async (request) => {
    const sdkSignal = request.config?.abortSignal;

    if (!sdkSignal) {
      throw new Error("Missing SDK abort signal.");
    }

    return new Promise((_, reject) => {
      sdkSignal.addEventListener(
        "abort",
        () => reject(new DOMException("SDK aborted.", "AbortError")),
        { once: true },
      );
    });
  });
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });
  const pending = provider.generate({
    messages: [{ role: "user", content: "Question." }],
  });

  context.mock.timers.tick(30_000);

  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "timeout" &&
      error.retryable === true,
  );
});

test("cleans caller abort listeners and timeout timers after completion", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });

  const controller = new AbortController();
  let sdkSignal: AbortSignal | undefined;
  const { client } = createClient(async (request) => {
    sdkSignal = request.config?.abortSignal;

    return {
      text: "Completed.",
      candidates: [{ finishReason: "STOP" }],
    };
  });
  const provider = new GeminiProvider({
    client,
    model: "configured-model",
    timeoutMs: 30_000,
  });

  await provider.generate({
    messages: [{ role: "user", content: "Question." }],
    signal: controller.signal,
  });

  assert.ok(sdkSignal);
  assert.equal(sdkSignal.aborted, false);

  controller.abort();
  context.mock.timers.tick(30_000);

  assert.equal(sdkSignal.aborted, false);
});
