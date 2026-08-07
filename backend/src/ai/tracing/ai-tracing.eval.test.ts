import assert from "node:assert/strict";
import test from "node:test";
import {
  AIRuntime,
  AIError,
  AIProviderRegistry,
  type AITraceClock,
  type AITraceMetadata,
  ContextBuilder,
  createAITraceContextMetadata,
  InMemoryAITraceSink,
  type StructuredOutputDefinition,
} from "../index";
import { FakeAIProvider } from "../testing";

class EvalClock implements AITraceClock {
  readonly #wallTimes = [
    new Date("2026-08-07T12:00:00.000Z"),
    new Date("2026-08-07T12:00:00.040Z"),
  ];
  readonly #monotonicTimes = [20, 60];

  now(): Date {
    const value = this.#wallTimes.shift();

    assert.ok(value);
    return value;
  }

  monotonicNow(): number {
    const value = this.#monotonicTimes.shift();

    assert.notEqual(value, undefined);
    return value as number;
  }
}

function createEvalRuntime(options: {
  provider?: FakeAIProvider;
  sink?: InMemoryAITraceSink;
  traceId?: string;
} = {}): {
  provider: FakeAIProvider;
  runtime: AIRuntime;
  sink: InMemoryAITraceSink;
} {
  const provider = options.provider ?? new FakeAIProvider();
  const sink = options.sink ?? new InMemoryAITraceSink();
  const providers = new AIProviderRegistry();

  providers.register(provider);

  return {
    provider,
    sink,
    runtime: new AIRuntime({
      providers,
      defaultProviderId: provider.id,
      tracing: {
        sink,
        createTraceId: () => options.traceId ?? "eval-trace",
        clock: new EvalClock(),
      },
    }),
  };
}

const summaryOutput: StructuredOutputDefinition<{ summary: string }> = {
  id: "eval-summary",
  version: "1",
  description: "A bounded synthetic summary for trace evaluation.",
  schema: {
    validate(value) {
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as Record<string, unknown>).summary === "string"
      ) {
        return {
          success: true,
          value: { summary: (value as { summary: string }).summary },
        };
      }

      return { success: false, issues: ["Invalid synthetic summary."] };
    },
  },
};

test("trace eval 01: one trace correlates all future evaluation metadata", async () => {
  const privatePassage = "EVAL_PRIVATE_PASSAGE";
  const context = new ContextBuilder().build({
    blocks: [{
      id: "passage",
      kind: "selected_passage",
      content: privatePassage,
      priority: 1,
      truncation: "none",
      source: {
        bookId: "11111111-1111-4111-8111-111111111111",
        userBookId: "22222222-2222-4222-8222-222222222222",
        pageStart: 1,
        pageEnd: 1,
      },
    }],
    allowedKinds: ["selected_passage"],
    maxBudget: 100,
  });
  const { provider, runtime, sink } = createEvalRuntime();

  provider.enqueueResponse({
    providerId: provider.id,
    model: "eval-model",
    output: { type: "structured", value: { summary: "PRIVATE_RESULT" } },
    finishReason: "stop",
    usage: { inputTokens: 9, outputTokens: 4, totalTokens: 13 },
  });

  await runtime.generateStructured(
    {
      messages: [{ role: "user", content: "EVAL_PRIVATE_PROMPT" }],
      output: summaryOutput,
    },
    {
      operationName: "summary-eval",
      prompt: { id: "summary", version: "3" },
      context: createAITraceContextMetadata(context),
    },
  );

  assert.deepEqual(sink.traces[0], {
    traceId: "eval-trace",
    operationName: "summary-eval",
    startedAt: "2026-08-07T12:00:00.000Z",
    completedAt: "2026-08-07T12:00:00.040Z",
    durationMs: 40,
    status: "success",
    providerId: "fake",
    prompt: { id: "summary", version: "3" },
    context: {
      blockCount: 1,
      kinds: ["selected_passage"],
      budget: {
        unit: "unicode_code_points",
        limit: 100,
        consumed: 20,
        remaining: 80,
      },
      truncatedBlockCount: 0,
      excludedBlockCount: 0,
    },
    structuredOutput: { id: "eval-summary", version: "1" },
    modelId: "eval-model",
    finishReason: "stop",
    usage: { inputTokens: 9, outputTokens: 4, totalTokens: 13 },
  });
  const serialized = JSON.stringify(sink.traces);

  assert.equal(serialized.includes(privatePassage), false);
  assert.equal(serialized.includes("EVAL_PRIVATE_PROMPT"), false);
  assert.equal(serialized.includes("PRIVATE_RESULT"), false);
});

test("trace eval 02: normalized failure is finalized once", async () => {
  const failure = new AIError("provider_unavailable", "PRIVATE_FAILURE", {
    providerId: "fake",
    retryable: true,
  });
  const { provider, runtime, sink } = createEvalRuntime();

  provider.enqueueError(failure);

  await assert.rejects(
    runtime.generate({ messages: [{ role: "user", content: "Private" }] }),
    (error: unknown) => error === failure,
  );

  assert.equal(sink.traces.length, 1);
  assert.equal(sink.traces[0]?.status, "failure");
  assert.equal(sink.traces[0]?.errorCode, "provider_unavailable");
  assert.equal(sink.traces[0]?.retryable, true);
});

test("trace eval 03: cancellation is distinct and finalized once", async () => {
  const controller = new AbortController();
  const { provider, runtime, sink } = createEvalRuntime();

  controller.abort();

  await assert.rejects(
    runtime.generate({
      messages: [{ role: "user", content: "Private" }],
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof AIError && error.code === "cancelled",
  );

  assert.equal(provider.requests.length, 0);
  assert.equal(sink.traces.length, 1);
  assert.equal(sink.traces[0]?.status, "cancelled");
});

test("trace eval 04: missing provider usage remains absent", async () => {
  const { provider, runtime, sink } = createEvalRuntime();

  provider.enqueueResponse({
    providerId: provider.id,
    model: "eval-model",
    output: { type: "text", text: "Private result" },
    finishReason: "stop",
  });

  await runtime.generate({
    messages: [{ role: "user", content: "Private" }],
  });

  assert.equal(Object.hasOwn(sink.traces[0] ?? {}, "usage"), false);
});

test("trace eval 05: extra caller metadata cannot enter a trace", async () => {
  const privateValues = [
    "PRIVATE_NOTE",
    "PRIVATE_HIGHLIGHT",
    "PRIVATE_RESPONSE",
  ];
  const metadata = {
    operationName: "privacy-eval",
    prompt: { id: "summary", version: "1", input: privateValues[0] },
    highlight: privateValues[1],
    response: privateValues[2],
  } as unknown as AITraceMetadata;
  const { runtime, sink } = createEvalRuntime();

  await runtime.generate(
    { messages: [{ role: "user", content: privateValues.join(" ") }] },
    metadata,
  );

  const serialized = JSON.stringify(sink.traces);

  for (const privateValue of privateValues) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test("trace eval 06: hostile metadata access does not change AI behavior", async () => {
  const metadata = new Proxy(
    {},
    {
      get() {
        throw new Error("PRIVATE_METADATA_FAILURE");
      },
    },
  ) as AITraceMetadata;
  const { runtime, sink } = createEvalRuntime();

  const result = await runtime.generate(
    { messages: [{ role: "user", content: "Private" }] },
    metadata,
  );

  assert.equal(result.providerId, "fake");
  assert.equal(sink.traces[0]?.operationName, "ai.generate");
  assert.equal(
    JSON.stringify(sink.traces).includes("PRIVATE_METADATA_FAILURE"),
    false,
  );
});

test("trace eval 07: sink failure preserves success and original failure", async () => {
  const failingSink = new InMemoryAITraceSink({
    recordError: new Error("Synthetic sink failure."),
  });
  const successful = createEvalRuntime({ sink: failingSink });
  const success = await successful.runtime.generate({
    messages: [{ role: "user", content: "Private" }],
  });
  const failure = new AIError("rate_limited", "Private", {
    providerId: "fake",
    retryable: true,
  });
  const failing = createEvalRuntime({ sink: failingSink });

  failing.provider.enqueueError(failure);

  await assert.rejects(
    failing.runtime.generate({
      messages: [{ role: "user", content: "Private" }],
    }),
    (error: unknown) => error === failure,
  );

  assert.equal(success.providerId, "fake");
  assert.equal(failingSink.recordAttempts, 2);
  assert.equal(failingSink.traces.length, 0);
});

test("trace eval 08: in-memory sinks are isolated, inspectable, and resettable", async () => {
  const first = createEvalRuntime({ traceId: "first" });
  const second = createEvalRuntime({ traceId: "second" });

  await first.runtime.generate({
    messages: [{ role: "user", content: "First private request" }],
  });

  assert.equal(first.sink.traces[0]?.traceId, "first");
  assert.equal(second.sink.traces.length, 0);

  first.sink.reset();

  assert.equal(first.sink.traces.length, 0);
  assert.equal(first.sink.recordAttempts, 0);
});
