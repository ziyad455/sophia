import assert from "node:assert/strict";
import test from "node:test";
import {
  AIRuntime,
  AIError,
  AIProviderRegistry,
  type StructuredOutputDefinition,
  type StructuredOutputValidationResult,
} from "./index";
import { FakeAIProvider } from "./testing";

type SummaryResult = {
  title: string;
  mode: "short" | "detailed";
  ideas: Array<{
    text: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidSummary(): StructuredOutputValidationResult<SummaryResult> {
  return {
    success: false,
    issues: ["The synthetic summary is invalid."],
  };
}

function validateSummary(
  value: unknown,
): StructuredOutputValidationResult<SummaryResult> {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "ideas,mode,title" ||
    typeof value.title !== "string" ||
    value.title.length < 1 ||
    value.title.length > 60 ||
    (value.mode !== "short" && value.mode !== "detailed") ||
    !Array.isArray(value.ideas) ||
    value.ideas.length < 1 ||
    value.ideas.length > 3
  ) {
    return invalidSummary();
  }

  const ideas: Array<{ text: string }> = [];

  for (const idea of value.ideas) {
    if (
      !isRecord(idea) ||
      Object.keys(idea).join(",") !== "text" ||
      typeof idea.text !== "string" ||
      idea.text.length < 1 ||
      idea.text.length > 100
    ) {
      return invalidSummary();
    }

    ideas.push({ text: idea.text });
  }

  return {
    success: true,
    value: {
      title: value.title,
      mode: value.mode,
      ideas,
    },
  };
}

const summaryOutputV1: StructuredOutputDefinition<SummaryResult> = {
  id: "simple-summary-result",
  version: "1",
  description: "A bounded synthetic summary contract for deterministic evals.",
  schema: {
    validate: validateSummary,
  },
  jsonSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      mode: { type: "string", enum: ["short", "detailed"] },
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 3,
      },
    },
    required: ["title", "mode", "ideas"],
    additionalProperties: false,
  },
};

function validSummary(): SummaryResult {
  return {
    title: "Synthetic summary",
    mode: "short",
    ideas: [{ text: "A bounded test idea." }],
  };
}

function createRuntime(
  provider = new FakeAIProvider(),
): { provider: FakeAIProvider; runtime: AIRuntime } {
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

function enqueue(provider: FakeAIProvider, value: unknown): void {
  provider.enqueueResponse({
    providerId: provider.id,
    model: "eval-model",
    output: { type: "structured", value },
    finishReason: "stop",
  });
}

async function generate(
  runtime: AIRuntime,
  output: StructuredOutputDefinition<SummaryResult> = summaryOutputV1,
) {
  return runtime.generateStructured({
    messages: [{ role: "user", content: "Return synthetic eval data." }],
    output,
  });
}

test("structured output eval 01: valid output becomes trusted typed data", async () => {
  const { provider, runtime } = createRuntime();

  enqueue(provider, validSummary());

  const result = await generate(runtime);
  const title: string = result.data.title;

  assert.equal(title, "Synthetic summary");
  assert.equal(result.outputId, "simple-summary-result");
  assert.equal(result.outputVersion, "1");
});

test("structured output eval 02: incorrect object shape is rejected", async () => {
  const { provider, runtime } = createRuntime();

  enqueue(provider, { title: "Missing fields" });

  await assert.rejects(
    generate(runtime),
    (error: unknown) =>
      error instanceof AIError && error.code === "invalid_output",
  );
});

test("structured output eval 03: malformed nesting is rejected", async () => {
  const { provider, runtime } = createRuntime();

  enqueue(provider, { ...validSummary(), ideas: [{ text: 42 }] });

  await assert.rejects(
    generate(runtime),
    (error: unknown) =>
      error instanceof AIError && error.code === "invalid_output",
  );
});

test("structured output eval 04: string and array bounds are enforced", async () => {
  for (const value of [
    { ...validSummary(), title: "x".repeat(61) },
    { ...validSummary(), ideas: [] },
    {
      ...validSummary(),
      ideas: [{ text: "1" }, { text: "2" }, { text: "3" }, { text: "4" }],
    },
  ]) {
    const { provider, runtime } = createRuntime();

    enqueue(provider, value);

    await assert.rejects(
      generate(runtime),
      (error: unknown) =>
        error instanceof AIError && error.code === "invalid_output",
    );
  }
});

test("structured output eval 05: unsupported enum values are rejected", async () => {
  const { provider, runtime } = createRuntime();

  enqueue(provider, { ...validSummary(), mode: "verbose" });

  await assert.rejects(
    generate(runtime),
    (error: unknown) =>
      error instanceof AIError && error.code === "invalid_output",
  );
});

test("structured output eval 06: raw output and validator issues stay private", async () => {
  const privateText = "private generated eval output";
  const output: StructuredOutputDefinition<SummaryResult> = {
    ...summaryOutputV1,
    schema: {
      validate: () => ({ success: false, issues: [privateText] }),
    },
  };
  const { provider, runtime } = createRuntime();

  enqueue(provider, { privateText });

  await assert.rejects(
    generate(runtime, output),
    (error: unknown) =>
      error instanceof AIError &&
      error.message.includes(privateText) === false &&
      JSON.stringify(error).includes(privateText) === false,
  );
});

test("structured output eval 07: exact versions remain isolated", async () => {
  const outputV2: StructuredOutputDefinition<SummaryResult> = {
    ...summaryOutputV1,
    version: "2",
    description: "A separate synthetic v2 contract for version isolation.",
  };
  const { provider, runtime } = createRuntime();

  enqueue(provider, validSummary());
  enqueue(provider, validSummary());

  const v1 = await generate(runtime, summaryOutputV1);
  const v2 = await generate(runtime, outputV2);

  assert.equal(v1.outputVersion, "1");
  assert.equal(v2.outputVersion, "2");
});

test("structured output eval 08: provider replacement preserves domain data", async () => {
  const first = createRuntime(new FakeAIProvider({ id: "first-provider" }));
  const second = createRuntime(new FakeAIProvider({ id: "second-provider" }));

  enqueue(first.provider, validSummary());
  enqueue(second.provider, validSummary());

  const [firstResult, secondResult] = await Promise.all([
    generate(first.runtime),
    generate(second.runtime),
  ]);

  assert.deepEqual(firstResult.data, secondResult.data);
  assert.equal(firstResult.outputId, secondResult.outputId);
  assert.notEqual(firstResult.providerId, secondResult.providerId);
});

test("structured output eval 09: provider errors keep their own category", async () => {
  const { provider, runtime } = createRuntime();

  provider.enqueueError(
    new AIError("provider_unavailable", "Provider unavailable.", {
      providerId: provider.id,
      retryable: true,
    }),
  );

  await assert.rejects(
    generate(runtime),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "provider_unavailable" &&
      error.retryable === true,
  );
});

test("structured output eval 10: result exposes no raw provider response", async () => {
  const { provider, runtime } = createRuntime();

  enqueue(provider, validSummary());

  const result = await generate(runtime);

  assert.deepEqual(Object.keys(result), [
    "outputId",
    "outputVersion",
    "data",
    "providerId",
    "model",
    "finishReason",
  ]);
  assert.equal(Object.hasOwn(result, "output"), false);
  assert.equal(Object.hasOwn(result, "rawResponse"), false);
});
