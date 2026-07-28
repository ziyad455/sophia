import assert from "node:assert/strict";
import test from "node:test";
import { AIRuntime } from "../../ai-runtime";
import type {
  AIProvider,
  AIRequest,
  StructuredOutputSchema,
} from "../../contracts";
import { AIError } from "../../errors";
import { AIProviderRegistry } from "../../provider-registry";
import { FakeAIProvider } from "../../testing/fake-ai-provider";
import { GeminiProvider } from "./gemini-provider";
import type {
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiSDKClient,
} from "./gemini-sdk-client";

type GeminiHandler = (
  request: GeminiGenerateContentRequest,
) => Promise<GeminiGenerateContentResponse>;

function createProvider(
  handler: GeminiHandler,
  capturedRequests: GeminiGenerateContentRequest[] = [],
): GeminiProvider {
  const client: GeminiSDKClient = {
    generateContent(request) {
      capturedRequests.push(request);
      return handler(request);
    },
  };

  return new GeminiProvider({
    client,
    model: "evaluation-model",
    timeoutMs: 30_000,
  });
}

function createRuntime(provider: AIProvider): AIRuntime {
  const providers = new AIProviderRegistry();

  providers.register(provider);

  return new AIRuntime({
    providers,
    defaultProviderId: provider.id,
  });
}

const textRequest: AIRequest = {
  messages: [{ role: "user", content: "Evaluate this argument." }],
};

test("eval 01: Sophia text request maps to Gemini roles", async () => {
  const requests: GeminiGenerateContentRequest[] = [];
  const provider = createProvider(
    async () => ({
      text: "Mapped.",
      candidates: [{ finishReason: "STOP" }],
    }),
    requests,
  );

  await provider.generate({
    messages: [
      { role: "system", content: "Be precise." },
      { role: "user", content: "Premise?" },
      { role: "assistant", content: "First premise." },
      { role: "user", content: "Support?" },
    ],
  });

  assert.deepEqual(requests[0]?.contents, [
    { role: "user", parts: [{ text: "Premise?" }] },
    { role: "model", parts: [{ text: "First premise." }] },
    { role: "user", parts: [{ text: "Support?" }] },
  ]);
});

test("eval 02: Gemini text response maps to Sophia", async () => {
  const provider = createProvider(async () => ({
    text: "Normalized.",
    modelVersion: "evaluation-model-001",
    candidates: [{ finishReason: "STOP" }],
  }));

  const response = await provider.generate(textRequest);

  assert.deepEqual(response, {
    providerId: "gemini",
    model: "evaluation-model-001",
    output: { type: "text", text: "Normalized." },
    finishReason: "stop",
  });
});

test("eval 03: structured schema metadata maps to Gemini", async () => {
  const requests: GeminiGenerateContentRequest[] = [];
  const jsonSchema = {
    type: "object",
    properties: {
      claim: { type: "string" },
    },
    required: ["claim"],
  };
  const provider = createProvider(
    async () => ({
      text: '{"claim":"A"}',
      candidates: [{ finishReason: "STOP" }],
    }),
    requests,
  );

  await provider.generate({
    ...textRequest,
    output: {
      type: "structured",
      schema: {
        name: "claim",
        jsonSchema,
        validate: () => ({ success: true, value: { claim: "A" } }),
      },
    },
  });

  assert.equal(requests[0]?.config?.responseMimeType, "application/json");
  assert.equal(requests[0]?.config?.responseJsonSchema, jsonSchema);
});

test("eval 04: malformed structured output is rejected", async () => {
  const provider = createProvider(async () => ({
    text: '{"claim":',
    candidates: [{ finishReason: "STOP" }],
  }));

  await assert.rejects(
    provider.generate({
      ...textRequest,
      output: {
        type: "structured",
        schema: {
          name: "claim",
          validate: () => ({ success: true, value: {} }),
        },
      },
    }),
    (error: unknown) =>
      error instanceof AIError && error.code === "invalid_response",
  );
});

test("eval 05: wrong-shaped structured output is rejected by AIRuntime", async () => {
  const schema: StructuredOutputSchema<{ claim: string }> = {
    name: "claim",
    validate(value) {
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as Record<string, unknown>).claim === "string"
      ) {
        return {
          success: true,
          value: { claim: (value as Record<string, string>).claim },
        };
      }

      return { success: false, issues: ["claim must be a string"] };
    },
  };
  const runtime = createRuntime(
    createProvider(async () => ({
      text: '{"claim":42}',
      candidates: [{ finishReason: "STOP" }],
    })),
  );

  await assert.rejects(
    runtime.generate({
      ...textRequest,
      output: { type: "structured", schema },
    }),
    (error: unknown) =>
      error instanceof AIError && error.code === "invalid_response",
  );
});

test("eval 06: unknown Gemini fields do not leak", async () => {
  const provider = createProvider(async () => ({
    text: "Allowlisted.",
    candidates: [{ finishReason: "STOP", secret: "discard" }],
    sdkHttpResponse: { authorization: "discard" },
  } as never));

  const response = await provider.generate(textRequest);

  assert.equal(Object.hasOwn(response, "candidates"), false);
  assert.equal(Object.hasOwn(response, "sdkHttpResponse"), false);
});

test("eval 07: authentication failure maps safely", async () => {
  const provider = createProvider(async () => {
    throw Object.assign(new Error("secret-key"), { status: 401 });
  });

  await assert.rejects(
    provider.generate(textRequest),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "provider_authentication" &&
      error.retryable === false &&
      error.message.includes("secret-key") === false,
  );
});

test("eval 08: rate limiting is retryable", async () => {
  const provider = createProvider(async () => {
    throw Object.assign(new Error("private prompt"), { status: 429 });
  });

  await assert.rejects(
    provider.generate(textRequest),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "rate_limited" &&
      error.retryable === true,
  );
});

test("eval 09: caller cancellation maps safely", async () => {
  const controller = new AbortController();
  const provider = createProvider(async (request) => {
    const signal = request.config?.abortSignal;

    if (!signal) {
      throw new Error("Missing signal.");
    }

    return new Promise((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted.", "AbortError")),
        { once: true },
      );
    });
  });
  const pending = provider.generate({
    ...textRequest,
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
});

test("eval 10: missing usage is not fabricated", async () => {
  const provider = createProvider(async () => ({
    text: "No usage.",
    candidates: [{ finishReason: "STOP" }],
  }));

  const response = await provider.generate(textRequest);

  assert.equal(Object.hasOwn(response, "usage"), false);
});

test("eval 11: provider replacement preserves product-facing output contracts", async () => {
  const geminiRuntime = createRuntime(
    createProvider(async () => ({
      text: "Same normalized output.",
      candidates: [{ finishReason: "STOP" }],
    })),
  );
  const fake = new FakeAIProvider({
    id: "replacement",
    defaultModel: "replacement-model",
  });

  fake.enqueueResponse({
    providerId: "replacement",
    model: "replacement-model",
    output: {
      type: "text",
      text: "Same normalized output.",
    },
    finishReason: "stop",
  });

  const fakeRuntime = createRuntime(fake);
  const [geminiResponse, fakeResponse] = await Promise.all([
    geminiRuntime.generate(textRequest),
    fakeRuntime.generate(textRequest),
  ]);

  assert.deepEqual(geminiResponse.output, fakeResponse.output);
  assert.equal(geminiResponse.finishReason, fakeResponse.finishReason);
});
