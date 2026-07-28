import assert from "node:assert/strict";
import test from "node:test";
import {
  GeminiConfigurationError,
  parseGeminiConfig,
} from "./gemini-config";

test("keeps Gemini disabled when no Gemini environment values are present", () => {
  assert.equal(parseGeminiConfig({}), undefined);
});

test("trims required Gemini values and applies the bounded default timeout", () => {
  assert.deepEqual(
    parseGeminiConfig({
      GEMINI_API_KEY: "  server-secret  ",
      GEMINI_MODEL: "  configured-model  ",
    }),
    {
      apiKey: "server-secret",
      model: "configured-model",
      timeoutMs: 30_000,
    },
  );
});

test("rejects partial or empty Gemini configuration without exposing values", () => {
  const invalidConfigurations = [
    {
      GEMINI_API_KEY: "",
      GEMINI_MODEL: "configured-model",
    },
    {
      GEMINI_API_KEY: "server-secret",
    },
    {
      GEMINI_MODEL: "configured-model",
    },
  ];

  for (const environment of invalidConfigurations) {
    assert.throws(
      () => parseGeminiConfig(environment),
      (error: unknown) =>
        error instanceof GeminiConfigurationError &&
        error.message.includes("server-secret") === false,
    );
  }
});

test("accepts only integer Gemini request timeouts within safe bounds", () => {
  const baseEnvironment = {
    GEMINI_API_KEY: "server-secret",
    GEMINI_MODEL: "configured-model",
  };

  assert.equal(
    parseGeminiConfig({
      ...baseEnvironment,
      GEMINI_REQUEST_TIMEOUT_MS: "1000",
    })?.timeoutMs,
    1_000,
  );
  assert.equal(
    parseGeminiConfig({
      ...baseEnvironment,
      GEMINI_REQUEST_TIMEOUT_MS: "120000",
    })?.timeoutMs,
    120_000,
  );

  for (const timeout of ["999", "120001", "1.5", "not-a-number"]) {
    assert.throws(
      () =>
        parseGeminiConfig({
          ...baseEnvironment,
          GEMINI_REQUEST_TIMEOUT_MS: timeout,
        }),
      GeminiConfigurationError,
    );
  }
});
