import assert from "node:assert/strict";
import test from "node:test";
import type { StructuredOutputSchema } from "./contracts";
import { AIError } from "./errors";
import { validateStructuredOutput } from "./structured-output";

type Reflection = {
  question: string;
};

const reflectionSchema: StructuredOutputSchema<Reflection> = {
  name: "reflection",
  description: "A single reflection question.",
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
      !Array.isArray(value) &&
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

test("returns typed structured data after schema validation", () => {
  const result = validateStructuredOutput(
    reflectionSchema,
    { question: "What does freedom require?" },
    "fake",
  );

  assert.deepEqual(result, {
    question: "What does freedom require?",
  });
});

test("rejects invalid structured data with normalized validation details", () => {
  const privateIssue = "question contained private generated text";
  const unsafeIssueSchema: StructuredOutputSchema<Reflection> = {
    ...reflectionSchema,
    validate: () => ({
      success: false,
      issues: [privateIssue],
    }),
  };

  assert.throws(
    () => validateStructuredOutput(unsafeIssueSchema, { question: 42 }, "fake"),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_output" &&
      error.providerId === "fake" &&
      error.retryable === false &&
      error.message === "The AI provider returned invalid structured output." &&
      error.details?.schemaName === "reflection" &&
      Object.hasOwn(error.details, "issues") === false &&
      JSON.stringify(error).includes(privateIssue) === false,
  );
});

test("normalizes schema validator exceptions without exposing output contents", () => {
  const validatorFailure = new Error("payload contained private text");
  const throwingSchema: StructuredOutputSchema<Reflection> = {
    name: "throwing-reflection",
    validate() {
      throw validatorFailure;
    },
  };

  assert.throws(
    () =>
      validateStructuredOutput(
        throwingSchema,
        { private: "do not expose" },
        "fake",
      ),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_output" &&
      error.providerId === "fake" &&
      error.message === "The structured output validator failed." &&
      error.details?.schemaName === "throwing-reflection" &&
      error.cause === validatorFailure &&
      error.message.includes("private") === false,
  );
});

test("normalizes malformed validator results as private invalid output", () => {
  const privateFailure = "malformed validator included private output";
  const invalidValidators: StructuredOutputSchema<Reflection>[] = [
    {
      name: "missing-result",
      validate: () => undefined as never,
    },
    {
      name: "invalid-success",
      validate: () => ({ success: "yes", value: privateFailure }) as never,
    },
    {
      name: "hostile-result",
      validate: () =>
        new Proxy(
          {},
          {
            get() {
              throw new Error(privateFailure);
            },
          },
        ) as never,
    },
  ];

  for (const schema of invalidValidators) {
    assert.throws(
      () => validateStructuredOutput(schema, { privateFailure }, "fake"),
      (error: unknown) =>
        error instanceof AIError &&
        error.code === "invalid_output" &&
        error.message === "The structured output validator failed." &&
        error.message.includes(privateFailure) === false &&
        JSON.stringify(error).includes(privateFailure) === false,
    );
  }
});
