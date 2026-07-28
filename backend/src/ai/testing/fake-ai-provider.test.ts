import assert from "node:assert/strict";
import test from "node:test";
import type { AIProviderResponse, AIRequest } from "../contracts";
import { AIError } from "../errors";
import { FakeAIProvider } from "./fake-ai-provider";

function request(content: string, model?: string): AIRequest {
  return {
    messages: [{ role: "user", content }],
    model,
  };
}

function response(text: string): AIProviderResponse {
  return {
    providerId: "fake",
    model: "fake-model",
    output: {
      type: "text",
      text,
    },
    finishReason: "stop",
  };
}

test("returns queued responses in order and records every request", async () => {
  const provider = new FakeAIProvider();
  const firstRequest = request("First question");
  const secondRequest = request("Second question");
  const firstResponse = response("First answer");
  const secondResponse = response("Second answer");

  provider.enqueueResponse(firstResponse);
  provider.enqueueResponse(secondResponse);

  assert.equal(await provider.generate(firstRequest), firstResponse);
  assert.equal(await provider.generate(secondRequest), secondResponse);
  assert.deepEqual(provider.requests, [firstRequest, secondRequest]);
});

test("throws queued failures at their deterministic position", async () => {
  const provider = new FakeAIProvider();
  const failure = new AIError(
    "rate_limited",
    "The AI provider rate limit was reached.",
    {
      providerId: "fake",
      retryable: true,
    },
  );
  const nextResponse = response("Recovered");

  provider.enqueueError(failure);
  provider.enqueueResponse(nextResponse);

  await assert.rejects(provider.generate(request("Try once")), (error: unknown) =>
    error === failure
  );
  assert.equal(await provider.generate(request("Try again")), nextResponse);
  assert.equal(provider.requests.length, 2);
});

test("uses a stable fallback response without network or configuration", async () => {
  const provider = new FakeAIProvider();
  const first = await provider.generate(request("Question", "requested-model"));
  const second = await provider.generate(request("Another question"));

  assert.deepEqual(first, {
    providerId: "fake",
    model: "requested-model",
    output: {
      type: "text",
      text: "Deterministic fake AI response.",
    },
    finishReason: "stop",
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  });
  assert.deepEqual(second, {
    ...first,
    model: "fake-model",
  });
});

test("supports an isolated provider identity for registry-level tests", async () => {
  const provider = new FakeAIProvider({
    id: "secondary-fake",
    defaultModel: "secondary-model",
  });

  assert.equal(provider.id, "secondary-fake");
  assert.deepEqual(await provider.generate(request("Question")), {
    providerId: "secondary-fake",
    model: "secondary-model",
    output: {
      type: "text",
      text: "Deterministic fake AI response.",
    },
    finishReason: "stop",
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  });
});
