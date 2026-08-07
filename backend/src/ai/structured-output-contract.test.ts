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

type TestAnalysis = {
  title: string;
  mode: "brief" | "deep";
  ideas: string[];
  metadata: {
    confidence: number;
  };
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function invalidAnalysis(): StructuredOutputValidationResult<TestAnalysis> {
  return {
    success: false,
    issues: ["The test analysis result is invalid."],
  };
}

function validateAnalysis(
  value: unknown,
): StructuredOutputValidationResult<TestAnalysis> {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).sort().join(",") !== "ideas,metadata,mode,title" ||
    typeof value.title !== "string" ||
    value.title.length < 1 ||
    value.title.length > 80 ||
    (value.mode !== "brief" && value.mode !== "deep") ||
    !Array.isArray(value.ideas) ||
    value.ideas.length < 1 ||
    value.ideas.length > 3 ||
    !isPlainRecord(value.metadata) ||
    Object.keys(value.metadata).join(",") !== "confidence" ||
    typeof value.metadata.confidence !== "number" ||
    !Number.isFinite(value.metadata.confidence) ||
    value.metadata.confidence < 0 ||
    value.metadata.confidence > 1
  ) {
    return invalidAnalysis();
  }

  const ideas: string[] = [];

  for (const idea of value.ideas) {
    if (typeof idea !== "string" || idea.length < 1 || idea.length > 120) {
      return invalidAnalysis();
    }

    ideas.push(idea);
  }

  return {
    success: true,
    value: {
      title: value.title,
      mode: value.mode,
      ideas,
      metadata: {
        confidence: value.metadata.confidence,
      },
    },
  };
}

const analysisJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    mode: { type: "string", enum: ["brief", "deep"] },
    ideas: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
    },
    metadata: {
      type: "object",
      properties: {
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["confidence"],
      additionalProperties: false,
    },
  },
  required: ["title", "mode", "ideas", "metadata"],
  additionalProperties: false,
} as const;

const analysisOutputV1: StructuredOutputDefinition<TestAnalysis> = {
  id: "test-analysis-result",
  version: "1",
  description: "A bounded synthetic analysis result used only by tests.",
  schema: {
    validate: validateAnalysis,
  },
  jsonSchema: analysisJsonSchema,
};

function createRuntime(): {
  provider: FakeAIProvider;
  runtime: AIRuntime;
} {
  const provider = new FakeAIProvider();
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

function enqueueStructured(provider: FakeAIProvider, value: unknown): void {
  provider.enqueueResponse({
    providerId: provider.id,
    model: "fake-structured-model",
    output: {
      type: "structured",
      value,
    },
    finishReason: "stop",
    usage: {
      inputTokens: 10,
      outputTokens: 12,
      totalTokens: 22,
    },
  });
}

function validAnalysis(title = "A bounded result"): TestAnalysis {
  return {
    title,
    mode: "brief",
    ideas: ["Examine the premise."],
    metadata: {
      confidence: 0.75,
    },
  };
}

test("returns trusted typed data with exact output identity and metadata", async () => {
  const { provider, runtime } = createRuntime();

  enqueueStructured(provider, validAnalysis());

  const result = await runtime.generateStructured({
    messages: [{ role: "user", content: "Return a synthetic analysis." }],
    output: analysisOutputV1,
  });
  const typedTitle: string = result.data.title;
  const typedMode: "brief" | "deep" = result.data.mode;

  assert.equal(typedTitle, "A bounded result");
  assert.equal(typedMode, "brief");
  assert.deepEqual(result, {
    outputId: "test-analysis-result",
    outputVersion: "1",
    data: validAnalysis(),
    providerId: "fake",
    model: "fake-structured-model",
    finishReason: "stop",
    usage: {
      inputTokens: 10,
      outputTokens: 12,
      totalTokens: 22,
    },
  });
});

test("passes provider-neutral JSON Schema metadata only as generation guidance", async () => {
  const { provider, runtime } = createRuntime();

  enqueueStructured(provider, validAnalysis());
  await runtime.generateStructured({
    messages: [{ role: "user", content: "Return a synthetic analysis." }],
    output: analysisOutputV1,
  });

  const requirement = provider.requests[0]?.output;

  assert.equal(requirement?.type, "structured");
  assert.deepEqual(
    requirement?.type === "structured"
      ? requirement.schema.jsonSchema
      : undefined,
    analysisJsonSchema,
  );
});

test("rejects primitives, missing fields, wrong property types, and null", async () => {
  const invalidValues: unknown[] = [
    "not-an-object",
    null,
    {},
    { ...validAnalysis(), title: 42 },
    { ...validAnalysis(), metadata: null },
  ];

  for (const value of invalidValues) {
    const { provider, runtime } = createRuntime();

    enqueueStructured(provider, value);

    await assert.rejects(
      runtime.generateStructured({
        messages: [{ role: "user", content: "Return a synthetic analysis." }],
        output: analysisOutputV1,
      }),
      (error: unknown) =>
        error instanceof AIError &&
        error.code === "invalid_output" &&
        error.retryable === false,
    );
  }
});

test("rejects unsupported enums, malformed nesting, and extra properties", async () => {
  const invalidValues = [
    { ...validAnalysis(), mode: "unsupported" },
    { ...validAnalysis(), metadata: { confidence: "high" } },
    { ...validAnalysis(), metadata: { confidence: 0.75, private: true } },
    { ...validAnalysis(), unexpected: "field" },
  ];

  for (const value of invalidValues) {
    const { provider, runtime } = createRuntime();

    enqueueStructured(provider, value);

    await assert.rejects(
      runtime.generateStructured({
        messages: [{ role: "user", content: "Return a synthetic analysis." }],
        output: analysisOutputV1,
      }),
      (error: unknown) =>
        error instanceof AIError && error.code === "invalid_output",
    );
  }
});

test("enforces bounded strings, arrays, and finite numeric ranges", async () => {
  const invalidValues = [
    validAnalysis("x".repeat(81)),
    { ...validAnalysis(), ideas: [] },
    { ...validAnalysis(), ideas: ["1", "2", "3", "4"] },
    { ...validAnalysis(), ideas: ["x".repeat(121)] },
    { ...validAnalysis(), metadata: { confidence: Number.POSITIVE_INFINITY } },
    { ...validAnalysis(), metadata: { confidence: 1.1 } },
  ];

  for (const value of invalidValues) {
    const { provider, runtime } = createRuntime();

    enqueueStructured(provider, value);

    await assert.rejects(
      runtime.generateStructured({
        messages: [{ role: "user", content: "Return a synthetic analysis." }],
        output: analysisOutputV1,
      }),
      (error: unknown) =>
        error instanceof AIError && error.code === "invalid_output",
    );
  }
});

test("keeps raw generated content and validator issues out of safe errors", async () => {
  const privateOutput = "private generated passage must not escape";
  const privateDefinition: StructuredOutputDefinition<TestAnalysis> = {
    ...analysisOutputV1,
    schema: {
      validate: () => ({
        success: false,
        issues: [privateOutput],
      }),
    },
  };
  const { provider, runtime } = createRuntime();

  enqueueStructured(provider, { title: privateOutput });

  await assert.rejects(
    runtime.generateStructured({
      messages: [{ role: "user", content: "Return private output." }],
      output: privateDefinition,
    }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_output" &&
      error.message.includes(privateOutput) === false &&
      JSON.stringify(error).includes(privateOutput) === false,
  );
});

test("keeps directly imported v1 and v2 definitions isolated", async () => {
  type TestAnalysisV2 = {
    summary: string;
  };
  const analysisOutputV2: StructuredOutputDefinition<TestAnalysisV2> = {
    id: "test-analysis-result",
    version: "2",
    description: "A distinct synthetic v2 result used only by tests.",
    schema: {
      validate(value) {
        if (
          isPlainRecord(value) &&
          Object.keys(value).join(",") === "summary" &&
          typeof value.summary === "string" &&
          value.summary.length <= 120
        ) {
          return {
            success: true,
            value: { summary: value.summary },
          };
        }

        return {
          success: false,
          issues: ["The v2 test result is invalid."],
        };
      },
    },
  };
  const { provider, runtime } = createRuntime();

  enqueueStructured(provider, validAnalysis("Version one"));
  enqueueStructured(provider, { summary: "Version two" });

  const v1 = await runtime.generateStructured({
    messages: [{ role: "user", content: "Return version one." }],
    output: analysisOutputV1,
  });
  const v2 = await runtime.generateStructured({
    messages: [{ role: "user", content: "Return version two." }],
    output: analysisOutputV2,
  });

  assert.equal(v1.outputVersion, "1");
  assert.equal(v1.data.title, "Version one");
  assert.equal(v2.outputVersion, "2");
  assert.equal(v2.data.summary, "Version two");
});

test("rejects malformed definitions before invoking the provider", async () => {
  const invalidDefinitions = [
    { ...analysisOutputV1, id: "Invalid Output" },
    { ...analysisOutputV1, id: 42 },
    { ...analysisOutputV1, version: "latest" },
    { ...analysisOutputV1, version: 2 },
    { ...analysisOutputV1, description: "   " },
    { ...analysisOutputV1, schema: {} },
    { ...analysisOutputV1, jsonSchema: [] },
    { ...analysisOutputV1, provider: "gemini" },
  ];
  const { provider, runtime } = createRuntime();

  for (const output of invalidDefinitions) {
    await assert.rejects(
      runtime.generateStructured({
        messages: [{ role: "user", content: "Do not call the provider." }],
        output: output as StructuredOutputDefinition<unknown>,
      }),
      (error: unknown) =>
        error instanceof AIError && error.code === "invalid_request",
    );
  }

  assert.equal(provider.requests.length, 0);
});

test("uses the existing fake queue for malformed output-mode responses", async () => {
  const { provider, runtime } = createRuntime();

  provider.enqueueResponse({
    providerId: provider.id,
    model: "fake-structured-model",
    output: {
      type: "text",
      text: "This is not the requested structured mode.",
    },
    finishReason: "stop",
  });

  await assert.rejects(
    runtime.generateStructured({
      messages: [{ role: "user", content: "Return a synthetic analysis." }],
      output: analysisOutputV1,
    }),
    (error: unknown) =>
      error instanceof AIError && error.code === "invalid_output",
  );
});

test("preserves normalized provider failures without treating them as invalid output", async () => {
  const failure = new AIError(
    "rate_limited",
    "The AI provider rate limit was reached.",
    {
      providerId: "fake",
      retryable: true,
    },
  );
  const { provider, runtime } = createRuntime();

  provider.enqueueError(failure);

  await assert.rejects(
    runtime.generateStructured({
      messages: [{ role: "user", content: "Return a synthetic analysis." }],
      output: analysisOutputV1,
    }),
    (error: unknown) => error === failure,
  );
});
