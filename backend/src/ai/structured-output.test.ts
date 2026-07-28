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
  assert.throws(
    () => validateStructuredOutput(reflectionSchema, { question: 42 }, "fake"),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "invalid_response" &&
      error.providerId === "fake" &&
      error.retryable === false &&
      error.message === "The AI provider returned invalid structured output." &&
      error.details?.schemaName === "reflection" &&
      Array.isArray(error.details.issues) &&
      error.details.issues[0] === "question must be a string",
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
      error.code === "invalid_response" &&
      error.providerId === "fake" &&
      error.message === "The structured output validator failed." &&
      error.details?.schemaName === "throwing-reflection" &&
      error.cause === validatorFailure &&
      error.message.includes("private") === false,
  );
});
