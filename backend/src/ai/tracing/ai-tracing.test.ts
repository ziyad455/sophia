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

class DeterministicTraceClock implements AITraceClock {
  readonly #wallTimes: Date[];
  readonly #monotonicTimes: number[];

  constructor(wallTimes: readonly string[], monotonicTimes: readonly number[]) {
    this.#wallTimes = wallTimes.map((value) => new Date(value));
    this.#monotonicTimes = [...monotonicTimes];
  }

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

function createTracedRuntime(options: {
  provider?: FakeAIProvider;
  sink?: InMemoryAITraceSink;
  traceIds?: readonly string[];
  wallTimes?: readonly string[];
  monotonicTimes?: readonly number[];
} = {}): {
  provider: FakeAIProvider;
  runtime: AIRuntime;
  sink: InMemoryAITraceSink;
} {
  const provider = options.provider ?? new FakeAIProvider();
  const providers = new AIProviderRegistry();
  const sink = options.sink ?? new InMemoryAITraceSink();
  const traceIds = [...(options.traceIds ?? ["trace-1"])];

  providers.register(provider);

  return {
    provider,
    sink,
    runtime: new AIRuntime({
      providers,
      defaultProviderId: provider.id,
      tracing: {
        sink,
        createTraceId() {
          const traceId = traceIds.shift();

          assert.ok(traceId);
          return traceId;
        },
        clock: new DeterministicTraceClock(
          options.wallTimes ?? [
            "2026-08-07T10:00:00.000Z",
            "2026-08-07T10:00:00.025Z",
          ],
          options.monotonicTimes ?? [100, 125],
        ),
      },
    }),
  };
}

test("records one successful metadata-only trace without changing the AI result", async () => {
  const { runtime, sink } = createTracedRuntime();

  const result = await runtime.generate({
    messages: [{ role: "user", content: "Private reader question." }],
  });

  assert.deepEqual(result, {
    providerId: "fake",
    model: "fake-model",
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
  assert.deepEqual(sink.traces, [
    {
      traceId: "trace-1",
      operationName: "ai.generate",
      startedAt: "2026-08-07T10:00:00.000Z",
      completedAt: "2026-08-07T10:00:00.025Z",
      durationMs: 25,
      status: "success",
      providerId: "fake",
      modelId: "fake-model",
      finishReason: "stop",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    },
  ]);
});

test("generates a distinct server-side UUID for each AI execution", async () => {
  const provider = new FakeAIProvider();
  const providers = new AIProviderRegistry();
  const sink = new InMemoryAITraceSink();

  providers.register(provider);

  const runtime = new AIRuntime({
    providers,
    defaultProviderId: provider.id,
    tracing: {
      sink,
      clock: new DeterministicTraceClock(
        [
          "2026-08-07T10:00:00.000Z",
          "2026-08-07T10:00:00.001Z",
          "2026-08-07T10:00:00.002Z",
          "2026-08-07T10:00:00.003Z",
        ],
        [0, 1, 2, 3],
      ),
    },
  });

  await runtime.generate({
    messages: [{ role: "user", content: "First private question." }],
  });
  await runtime.generate({
    messages: [{ role: "user", content: "Second private question." }],
  });

  const traceIds = sink.traces.map((trace) => trace.traceId);
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  assert.equal(traceIds.length, 2);
  assert.match(traceIds[0] ?? "", uuidPattern);
  assert.match(traceIds[1] ?? "", uuidPattern);
  assert.notEqual(traceIds[0], traceIds[1]);
});

test("records prompt identity without recording rendered prompt content", async () => {
  const { runtime, sink } = createTracedRuntime();
  const privatePromptContent = "Private rendered prompt and passage.";

  await runtime.generate(
    {
      messages: [{ role: "user", content: privatePromptContent }],
    },
    {
      operationName: "passage-explanation",
      prompt: {
        id: "passage-explanation",
        version: "1",
      },
    },
  );

  assert.equal(sink.traces[0]?.operationName, "passage-explanation");
  assert.deepEqual(sink.traces[0]?.prompt, {
    id: "passage-explanation",
    version: "1",
  });
  assert.equal(JSON.stringify(sink.traces).includes(privatePromptContent), false);
});

test("records context statistics without recording context text or provenance", async () => {
  const privatePassage = "Private selected philosophical passage.";
  const bookId = "11111111-1111-4111-8111-111111111111";
  const userBookId = "22222222-2222-4222-8222-222222222222";
  const contextPackage = new ContextBuilder().build({
    blocks: [
      {
        id: "selected-passage",
        kind: "selected_passage",
        content: privatePassage,
        priority: 100,
        truncation: "none",
        source: {
          bookId,
          userBookId,
          pageStart: 7,
          pageEnd: 7,
        },
      },
    ],
    allowedKinds: ["selected_passage"],
    requiredBlockIds: ["selected-passage"],
    maxBudget: 100,
  });
  const { runtime, sink } = createTracedRuntime();

  await runtime.generate(
    {
      messages: [{ role: "user", content: "Private reader question." }],
    },
    {
      operationName: "passage-explanation",
      context: createAITraceContextMetadata(contextPackage),
    },
  );

  assert.deepEqual(sink.traces[0]?.context, {
    blockCount: 1,
    kinds: ["selected_passage"],
    budget: {
      unit: "unicode_code_points",
      limit: 100,
      consumed: 39,
      remaining: 61,
    },
    truncatedBlockCount: 0,
    excludedBlockCount: 0,
  });
  const serialized = JSON.stringify(sink.traces);

  assert.equal(serialized.includes(privatePassage), false);
  assert.equal(serialized.includes(bookId), false);
  assert.equal(serialized.includes(userBookId), false);
});

test("records structured-output identity without recording generated data", async () => {
  const privateGeneratedValue = "Private generated structured value.";
  const output: StructuredOutputDefinition<{ summary: string }> = {
    id: "passage-summary",
    version: "1",
    description: "A bounded test summary.",
    schema: {
      validate(value) {
        if (
          typeof value === "object" &&
          value !== null &&
          typeof (value as Record<string, unknown>).summary === "string"
        ) {
          return {
            success: true,
            value: {
              summary: (value as { summary: string }).summary,
            },
          };
        }

        return { success: false, issues: ["Invalid summary."] };
      },
    },
  };
  const { provider, runtime, sink } = createTracedRuntime();

  provider.enqueueResponse({
    providerId: provider.id,
    model: "fake-structured-model",
    output: {
      type: "structured",
      value: { summary: privateGeneratedValue },
    },
    finishReason: "stop",
  });

  await runtime.generateStructured(
    {
      messages: [{ role: "user", content: "Private summary request." }],
      output,
    },
    { operationName: "passage-summary" },
  );

  assert.equal(sink.traces.length, 1);
  assert.deepEqual(sink.traces[0]?.structuredOutput, {
    id: "passage-summary",
    version: "1",
  });
  assert.equal(JSON.stringify(sink.traces).includes(privateGeneratedValue), false);
});

test("records only normalized provider and model identity", async () => {
  const provider = new FakeAIProvider({ id: "local-test-provider" });
  const { runtime, sink } = createTracedRuntime({ provider });

  provider.enqueueResponse({
    providerId: provider.id,
    model: "provider-neutral-model",
    output: { type: "text", text: "Private generated response." },
    finishReason: "length",
  });

  await runtime.generate({
    messages: [{ role: "user", content: "Private reader question." }],
  });

  assert.equal(sink.traces[0]?.providerId, "local-test-provider");
  assert.equal(sink.traces[0]?.modelId, "provider-neutral-model");
  assert.equal(sink.traces[0]?.finishReason, "length");
});

test("records genuinely reported usage and never fabricates missing usage", async () => {
  const { provider, runtime, sink } = createTracedRuntime({
    traceIds: ["usage-reported", "usage-missing"],
    wallTimes: [
      "2026-08-07T10:00:00.000Z",
      "2026-08-07T10:00:00.010Z",
      "2026-08-07T10:00:00.020Z",
      "2026-08-07T10:00:00.030Z",
    ],
    monotonicTimes: [0, 10, 20, 30],
  });

  provider.enqueueResponse({
    providerId: provider.id,
    model: "fake-model",
    output: { type: "text", text: "Private first response." },
    finishReason: "stop",
    usage: {
      inputTokens: 11,
      outputTokens: 7,
      totalTokens: 18,
    },
  });
  provider.enqueueResponse({
    providerId: provider.id,
    model: "fake-model",
    output: { type: "text", text: "Private second response." },
    finishReason: "stop",
  });

  await runtime.generate({
    messages: [{ role: "user", content: "First private question." }],
  });
  await runtime.generate({
    messages: [{ role: "user", content: "Second private question." }],
  });

  assert.deepEqual(sink.traces[0]?.usage, {
    inputTokens: 11,
    outputTokens: 7,
    totalTokens: 18,
  });
  assert.equal(Object.hasOwn(sink.traces[1] ?? {}, "usage"), false);
});

test("finalizes a safe failure trace and preserves the normalized provider error", async () => {
  const privateProviderMessage = "SECRET_RAW_PROVIDER_ERROR";
  const failure = new AIError("rate_limited", privateProviderMessage, {
    providerId: "fake",
    retryable: true,
    cause: new Error(privateProviderMessage),
  });
  const { provider, runtime, sink } = createTracedRuntime();

  provider.enqueueError(failure);

  await assert.rejects(
    runtime.generate({
      messages: [{ role: "user", content: "Private reader question." }],
    }),
    (error: unknown) => error === failure,
  );

  assert.equal(sink.traces.length, 1);
  assert.equal(sink.traces[0]?.status, "failure");
  assert.equal(sink.traces[0]?.providerId, "fake");
  assert.equal(sink.traces[0]?.errorCode, "rate_limited");
  assert.equal(sink.traces[0]?.retryable, true);
  assert.equal(JSON.stringify(sink.traces).includes(privateProviderMessage), false);
});

test("traces invalid structured output without recording the malformed value", async () => {
  const privateMalformedValue = "SECRET_MALFORMED_OUTPUT";
  const { provider, runtime, sink } = createTracedRuntime();

  provider.enqueueResponse({
    providerId: provider.id,
    model: "fake-structured-model",
    output: {
      type: "structured",
      value: { summary: privateMalformedValue },
    },
    finishReason: "stop",
  });

  await assert.rejects(
    runtime.generateStructured({
      messages: [{ role: "user", content: "Private summary request." }],
      output: {
        id: "passage-summary",
        version: "2",
        description: "A bounded test summary.",
        schema: {
          validate: () => ({
            success: false,
            issues: [privateMalformedValue],
          }),
        },
      },
    }),
    (error: unknown) =>
      error instanceof AIError && error.code === "invalid_output",
  );

  assert.equal(sink.traces.length, 1);
  assert.equal(sink.traces[0]?.status, "failure");
  assert.equal(sink.traces[0]?.errorCode, "invalid_output");
  assert.deepEqual(sink.traces[0]?.structuredOutput, {
    id: "passage-summary",
    version: "2",
  });
  assert.equal(JSON.stringify(sink.traces).includes(privateMalformedValue), false);
});

test("finalizes cancellation exactly once without invoking the provider", async () => {
  const controller = new AbortController();
  const { provider, runtime, sink } = createTracedRuntime();

  controller.abort();

  await assert.rejects(
    runtime.generate({
      messages: [{ role: "user", content: "Private cancelled question." }],
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof AIError && error.code === "cancelled",
  );

  assert.equal(provider.requests.length, 0);
  assert.equal(sink.traces.length, 1);
  assert.equal(sink.traces[0]?.status, "cancelled");
  assert.equal(sink.traces[0]?.errorCode, "cancelled");
  assert.equal(sink.traces[0]?.retryable, false);
});

test("excludes prompt, passage, note, highlight, response, and raw error secrets", async () => {
  const secrets = {
    prompt: "SECRET_PROMPT_CONTENT",
    passage: "SECRET_BOOK_PASSAGE",
    note: "SECRET_PRIVATE_NOTE",
    highlight: "SECRET_PRIVATE_HIGHLIGHT",
    response: "SECRET_GENERATED_RESPONSE",
    rawError: "SECRET_RAW_PROVIDER_ERROR_DETAIL",
  };
  const { provider, runtime, sink } = createTracedRuntime({
    traceIds: ["privacy-success", "privacy-failure"],
    wallTimes: [
      "2026-08-07T10:00:00.000Z",
      "2026-08-07T10:00:00.010Z",
      "2026-08-07T10:00:00.020Z",
      "2026-08-07T10:00:00.030Z",
    ],
    monotonicTimes: [0, 10, 20, 30],
  });
  const untrustedMetadata = {
    operationName: "privacy-check",
    prompt: {
      id: "passage-explanation",
      version: "1",
      content: secrets.prompt,
    },
    context: {
      blockCount: 2,
      kinds: ["selected_passage", "note"],
      budget: {
        unit: "unicode_code_points",
        limit: 100,
        consumed: 80,
        remaining: 20,
      },
      truncatedBlockCount: 0,
      excludedBlockCount: 1,
      passage: secrets.passage,
    },
    note: secrets.note,
    highlight: secrets.highlight,
  } as unknown as AITraceMetadata;

  provider.enqueueResponse({
    providerId: provider.id,
    model: "fake-model",
    output: { type: "text", text: secrets.response },
    finishReason: "stop",
  });

  await runtime.generate(
    {
      messages: [{ role: "user", content: secrets.prompt }],
    },
    untrustedMetadata,
  );

  provider.enqueueError(new Error(secrets.rawError));

  await assert.rejects(
    runtime.generate(
      {
        messages: [{ role: "user", content: secrets.passage }],
      },
      untrustedMetadata,
    ),
    (error: unknown) =>
      error instanceof AIError && error.code === "provider_failure",
  );

  const serialized = JSON.stringify(sink.traces);

  assert.equal(sink.traces.length, 2);
  for (const secret of Object.values(secrets)) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("contains trace sink failures and preserves a successful AI result", async () => {
  const sinkFailure = new Error("Synthetic trace sink failure.");
  const sink = new InMemoryAITraceSink({ recordError: sinkFailure });
  const { runtime } = createTracedRuntime({ sink });

  const result = await runtime.generate({
    messages: [{ role: "user", content: "Private reader question." }],
  });

  assert.equal(result.output.type, "text");
  assert.equal(sink.recordAttempts, 1);
  assert.equal(sink.traces.length, 0);
});

test("keeps trace state isolated between runtime instances", async () => {
  const firstSink = new InMemoryAITraceSink();
  const secondSink = new InMemoryAITraceSink();
  const first = createTracedRuntime({
    sink: firstSink,
    traceIds: ["first-runtime-trace"],
  });
  const second = createTracedRuntime({
    sink: secondSink,
    traceIds: ["second-runtime-trace"],
  });

  await first.runtime.generate({
    messages: [{ role: "user", content: "First private question." }],
  });

  assert.deepEqual(
    firstSink.traces.map((trace) => trace.traceId),
    ["first-runtime-trace"],
  );
  assert.equal(secondSink.traces.length, 0);

  await second.runtime.generate({
    messages: [{ role: "user", content: "Second private question." }],
  });

  assert.deepEqual(
    firstSink.traces.map((trace) => trace.traceId),
    ["first-runtime-trace"],
  );
  assert.deepEqual(
    secondSink.traces.map((trace) => trace.traceId),
    ["second-runtime-trace"],
  );
});

test("contains trace setup and completion failures without changing AI results", async () => {
  const createRuntime = (tracing: {
    sink: InMemoryAITraceSink;
    createTraceId: () => string;
    clock: AITraceClock;
  }): AIRuntime => {
    const provider = new FakeAIProvider();
    const providers = new AIProviderRegistry();

    providers.register(provider);
    return new AIRuntime({
      providers,
      defaultProviderId: provider.id,
      tracing,
    });
  };
  const setupSink = new InMemoryAITraceSink();
  const setupFailureRuntime = createRuntime({
    sink: setupSink,
    createTraceId() {
      throw new Error("Synthetic trace ID failure.");
    },
    clock: new DeterministicTraceClock([], []),
  });
  const completionSink = new InMemoryAITraceSink();
  let wallClockCalls = 0;
  const completionFailureRuntime = createRuntime({
    sink: completionSink,
    createTraceId: () => "completion-failure",
    clock: {
      now() {
        wallClockCalls += 1;

        if (wallClockCalls > 1) {
          throw new Error("Synthetic trace completion failure.");
        }

        return new Date("2026-08-07T10:00:00.000Z");
      },
      monotonicNow: () => 0,
    },
  });

  const setupResult = await setupFailureRuntime.generate({
    messages: [{ role: "user", content: "Private setup request." }],
  });
  const completionResult = await completionFailureRuntime.generate({
    messages: [{ role: "user", content: "Private completion request." }],
  });

  assert.equal(setupResult.providerId, "fake");
  assert.equal(completionResult.providerId, "fake");
  assert.equal(setupSink.recordAttempts, 0);
  assert.equal(completionSink.recordAttempts, 0);
});
