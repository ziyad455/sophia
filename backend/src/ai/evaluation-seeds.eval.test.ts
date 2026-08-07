import assert from "node:assert/strict";
import test from "node:test";
import {
  AIRuntime,
  AIError,
  AIProviderRegistry,
  type AITraceClock,
  ContextBuilder,
  createAITraceContextMetadata,
  InMemoryAITraceSink,
  type PromptDefinition,
  PromptRegistry,
  type StructuredOutputDefinition,
  type StructuredOutputValidationResult,
} from "./index";
import { createGeminiAIRuntime } from "./composition";
import {
  GeminiConfigurationError,
  parseGeminiConfig,
} from "./providers/gemini/gemini-config";
import type { GeminiSDKClient } from "./providers/gemini/gemini-sdk-client";
import { FakeAIProvider } from "./testing";

type SeedPromptInput = {
  question: string;
};

type SeedOutput = {
  status: "accepted";
  response: string;
};

const seedPromptV1: PromptDefinition<SeedPromptInput> = {
  id: "s7-evaluation-flow",
  version: "1",
  description: "A deterministic prompt used only by Sprint 7 evaluations.",
  inputSchema: {
    validate(value) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof (value as Record<string, unknown>).question === "string" &&
        (value as Record<string, string>).question.trim().length > 0
      ) {
        return {
          success: true,
          value: {
            question: (value as Record<string, string>).question,
          },
        };
      }

      return { success: false, issues: ["A question is required."] };
    },
  },
  render(input) {
    return [
      {
        role: "system",
        content: "Return only the synthetic evaluation contract.",
      },
      {
        role: "user",
        content: input.question,
      },
    ];
  },
};

function invalidSeedOutput(): StructuredOutputValidationResult<SeedOutput> {
  return {
    success: false,
    issues: ["The synthetic evaluation output is invalid."],
  };
}

const seedOutputV1: StructuredOutputDefinition<SeedOutput> = {
  id: "s7-evaluation-result",
  version: "1",
  description: "A bounded result used only by Sprint 7 evaluations.",
  schema: {
    validate(value) {
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        Object.keys(value).sort().join(",") !== "response,status"
      ) {
        return invalidSeedOutput();
      }

      const candidate = value as Record<string, unknown>;

      if (
        candidate.status !== "accepted" ||
        typeof candidate.response !== "string" ||
        candidate.response.length < 1 ||
        candidate.response.length > 100
      ) {
        return invalidSeedOutput();
      }

      return {
        success: true,
        value: {
          status: "accepted",
          response: candidate.response,
        },
      };
    },
  },
  jsonSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["accepted"] },
      response: { type: "string" },
    },
    required: ["status", "response"],
    additionalProperties: false,
  },
};

class SeedClock implements AITraceClock {
  readonly #wallTimes = [
    new Date("2026-08-07T14:00:00.000Z"),
    new Date("2026-08-07T14:00:00.025Z"),
  ];
  readonly #monotonicTimes = [10, 35];

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

function createSeedHarness(options: {
  provider: FakeAIProvider;
  passage?: string;
  note?: string;
}) {
  const promptRegistry = new PromptRegistry();

  promptRegistry.register(seedPromptV1);

  const prompt = promptRegistry.render("s7-evaluation-flow", "1", {
    question: "Process the supplied synthetic context.",
  });
  const context = new ContextBuilder().build({
    blocks: [
      {
        id: "selected-passage",
        kind: "selected_passage",
        content: options.passage ?? "Synthetic selected passage.",
        priority: 10,
        truncation: "none",
        source: {
          bookId: "11111111-1111-4111-8111-111111111111",
          userBookId: "22222222-2222-4222-8222-222222222222",
          pageStart: 1,
          pageEnd: 1,
        },
      },
      {
        id: "reader-note",
        kind: "note",
        content: options.note ?? "Synthetic reader note.",
        priority: 5,
        truncation: "none",
        source: {
          bookId: "11111111-1111-4111-8111-111111111111",
          userBookId: "22222222-2222-4222-8222-222222222222",
          noteId: "33333333-3333-4333-8333-333333333333",
        },
      },
    ],
    allowedKinds: ["selected_passage", "note"],
    requiredBlockIds: ["selected-passage"],
    maxBudget: 100,
  });
  const contextMessage = {
    role: "user" as const,
    content: context.blocks
      .map((block) => `[${block.kind}]\n${block.content}`)
      .join("\n\n"),
  };
  const messages = [...prompt.messages, contextMessage];
  const providers = new AIProviderRegistry();
  const sink = new InMemoryAITraceSink();

  providers.register(options.provider);

  return {
    context,
    messages,
    prompt,
    provider: options.provider,
    sink,
    runtime: new AIRuntime({
      providers,
      defaultProviderId: options.provider.id,
      tracing: {
        sink,
        createTraceId: () => `${options.provider.id}-evaluation-trace`,
        clock: new SeedClock(),
      },
    }),
  };
}

async function runSeedHarness(harness: ReturnType<typeof createSeedHarness>) {
  return harness.runtime.generateStructured(
    {
      messages: harness.messages,
      output: seedOutputV1,
    },
    {
      operationName: "s7-evaluation-flow",
      prompt: {
        id: harness.prompt.promptId,
        version: harness.prompt.promptVersion,
      },
      context: createAITraceContextMetadata(harness.context),
    },
  );
}

function createRuntime(provider = new FakeAIProvider()): {
  provider: FakeAIProvider;
  runtime: AIRuntime;
} {
  const providers = new AIProviderRegistry();

  providers.register(provider);

  return {
    provider,
    runtime: new AIRuntime({
      providers,
      defaultProviderId: provider.id,
    }),
  };
}

test("S7-RUNTIME-001 [runtime]: valid text generation stays normalized", async () => {
  const { runtime } = createRuntime();

  const result = await runtime.generate({
    messages: [{ role: "user", content: "Synthetic evaluation input." }],
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
});

test("S7-RUNTIME-002 [runtime]: unknown provider errors normalize safely", async () => {
  const privateFailure = "PRIVATE_PROVIDER_FAILURE";
  const { provider, runtime } = createRuntime();

  provider.enqueueError(new Error(privateFailure));

  await assert.rejects(
    runtime.generate({
      messages: [{ role: "user", content: "Synthetic evaluation input." }],
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "provider_failure" &&
      error.providerId === "fake" &&
      error.retryable === false &&
      error.message === "The AI provider request failed." &&
      error.message.includes(privateFailure) === false &&
      JSON.stringify(error).includes(privateFailure) === false,
  );
});

test("S7-RUNTIME-003 [runtime]: preflight cancellation skips the provider", async () => {
  const controller = new AbortController();
  const { provider, runtime } = createRuntime();

  controller.abort();

  await assert.rejects(
    runtime.generate({
      messages: [{ role: "user", content: "Synthetic evaluation input." }],
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "cancelled" &&
      error.retryable === false,
  );
  assert.equal(provider.requests.length, 0);
});

test("S7-RUNTIME-004 [runtime]: absent Gemini configuration fails without transport", () => {
  let transportCalls = 0;
  const client: GeminiSDKClient = {
    async generateContent() {
      transportCalls += 1;
      return { text: "This transport must not run." };
    },
  };
  const config = parseGeminiConfig({});

  assert.equal(config, undefined);
  assert.throws(
    () => createGeminiAIRuntime({ config, client }),
    GeminiConfigurationError,
  );
  assert.equal(transportCalls, 0);
});

test("S7-HARNESS-001 [cross-layer]: the complete AI harness preserves metadata", async () => {
  const provider = new FakeAIProvider({
    id: "cross-layer-fake",
    defaultModel: "cross-layer-model",
  });
  const harness = createSeedHarness({ provider });

  provider.enqueueResponse({
    providerId: provider.id,
    model: "cross-layer-model",
    output: {
      type: "structured",
      value: { status: "accepted", response: "Synthetic response." },
    },
    finishReason: "stop",
    usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
  });

  const result = await runSeedHarness(harness);
  const trace = harness.sink.traces[0];

  assert.deepEqual(harness.provider.requests[0]?.messages, harness.messages);
  assert.deepEqual(harness.context.blocks.map((block) => block.id), [
    "selected-passage",
    "reader-note",
  ]);
  assert.deepEqual(result, {
    outputId: "s7-evaluation-result",
    outputVersion: "1",
    data: { status: "accepted", response: "Synthetic response." },
    providerId: "cross-layer-fake",
    model: "cross-layer-model",
    finishReason: "stop",
    usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
  });
  assert.equal(trace?.status, "success");
  assert.equal(trace?.providerId, result.providerId);
  assert.equal(trace?.modelId, result.model);
  assert.deepEqual(trace?.prompt, {
    id: harness.prompt.promptId,
    version: harness.prompt.promptVersion,
  });
  assert.deepEqual(
    trace?.context,
    createAITraceContextMetadata(harness.context),
  );
  assert.deepEqual(trace?.structuredOutput, {
    id: result.outputId,
    version: result.outputVersion,
  });
});

test("S7-HARNESS-002 [provider-replacement]: fake providers preserve the product flow", async () => {
  const first = createSeedHarness({
    provider: new FakeAIProvider({
      id: "fake-provider-a",
      defaultModel: "fake-model-a",
    }),
  });
  const second = createSeedHarness({
    provider: new FakeAIProvider({
      id: "fake-provider-b",
      defaultModel: "fake-model-b",
    }),
  });

  for (const harness of [first, second]) {
    harness.provider.enqueueResponse({
      providerId: harness.provider.id,
      model: `${harness.provider.id}-model`,
      output: {
        type: "structured",
        value: { status: "accepted", response: "Equivalent result." },
      },
      finishReason: "stop",
    });
  }

  const [firstResult, secondResult] = await Promise.all([
    runSeedHarness(first),
    runSeedHarness(second),
  ]);

  assert.deepEqual(first.prompt, second.prompt);
  assert.deepEqual(first.context, second.context);
  assert.deepEqual(firstResult.data, secondResult.data);
  assert.equal(firstResult.outputId, secondResult.outputId);
  assert.equal(firstResult.outputVersion, secondResult.outputVersion);
  assert.deepEqual(Object.keys(firstResult), Object.keys(secondResult));
  assert.notEqual(firstResult.providerId, secondResult.providerId);
  assert.deepEqual(first.sink.traces[0]?.prompt, second.sink.traces[0]?.prompt);
  assert.deepEqual(first.sink.traces[0]?.context, second.sink.traces[0]?.context);
  assert.deepEqual(
    first.sink.traces[0]?.structuredOutput,
    second.sink.traces[0]?.structuredOutput,
  );
});

test("S7-PRIVACY-001 [privacy]: secrets stay out of operational evaluation artifacts", async () => {
  const secrets = [
    "PRIVATE_PASSAGE_ABC123",
    "PRIVATE_NOTE_XYZ789",
    "PRIVATE_RESPONSE_SECRET",
  ];
  const successful = createSeedHarness({
    provider: new FakeAIProvider({ id: "privacy-success" }),
    passage: secrets[0],
    note: secrets[1],
  });

  successful.provider.enqueueResponse({
    providerId: successful.provider.id,
    model: "privacy-model",
    output: {
      type: "structured",
      value: { status: "accepted", response: secrets[2] },
    },
    finishReason: "stop",
  });

  const result = await runSeedHarness(successful);
  const failed = createSeedHarness({
    provider: new FakeAIProvider({ id: "privacy-failure" }),
    passage: secrets[0],
    note: secrets[1],
  });

  failed.provider.enqueueError(new Error(secrets[2]));

  let safeError: AIError | undefined;

  try {
    await runSeedHarness(failed);
  } catch (error) {
    assert.ok(error instanceof AIError);
    safeError = error;
  }

  assert.ok(safeError);
  assert.equal(safeError.code, "provider_failure");
  assert.equal(JSON.stringify(successful.provider.requests).includes(secrets[0]), true);
  assert.equal(JSON.stringify(successful.provider.requests).includes(secrets[1]), true);
  assert.equal(result.data.response, secrets[2]);

  const serializedEvaluationOutput = JSON.stringify({
    caseId: "S7-PRIVACY-001",
    category: "privacy",
    status: "passed",
    traces: [...successful.sink.traces, ...failed.sink.traces],
    error: {
      code: safeError.code,
      message: safeError.message,
      providerId: safeError.providerId,
      retryable: safeError.retryable,
      details: safeError.details,
    },
  });

  for (const secret of secrets) {
    assert.equal(JSON.stringify(successful.sink.traces).includes(secret), false);
    assert.equal(JSON.stringify(failed.sink.traces).includes(secret), false);
    assert.equal(safeError.message.includes(secret), false);
    assert.equal(JSON.stringify(safeError).includes(secret), false);
    assert.equal(serializedEvaluationOutput.includes(secret), false);
  }
});
