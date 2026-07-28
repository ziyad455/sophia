import assert from "node:assert/strict";
import test from "node:test";
import type { AIProvider } from "./contracts";
import { AIError } from "./errors";
import { AIProviderRegistry } from "./provider-registry";
import {
  GeminiConfigurationError,
  type GeminiConfig,
} from "./providers/gemini/gemini-config";
import type { GeminiSDKClient } from "./providers/gemini/gemini-sdk-client";
import { createGeminiAIRuntime } from "./composition";

const geminiConfig: GeminiConfig = {
  apiKey: "server-secret",
  model: "configured-model",
  timeoutMs: 30_000,
};

function createClient(): GeminiSDKClient {
  return {
    async generateContent() {
      return {
        text: "Composed response.",
        candidates: [{ finishReason: "STOP" }],
      };
    },
  };
}

test("explicitly registers one Gemini provider in an instance-owned runtime", async () => {
  const composition = createGeminiAIRuntime({
    config: geminiConfig,
    client: createClient(),
  });

  assert.deepEqual(composition.providers.listProviderIds(), ["gemini"]);
  assert.equal(composition.providers.get("gemini").id, "gemini");

  const response = await composition.runtime.generate({
    messages: [{ role: "user", content: "Question." }],
  });

  assert.equal(response.providerId, "gemini");
  assert.equal(response.output.type, "text");
});

test("fails clearly when Gemini composition is requested without configuration", () => {
  assert.throws(
    () =>
      createGeminiAIRuntime({
        config: undefined,
        client: createClient(),
      }),
    GeminiConfigurationError,
  );
});

test("preserves provider registry duplicate protection during composition", () => {
  const providers = new AIProviderRegistry();
  const existingProvider: AIProvider = {
    id: "gemini",
    async generate() {
      throw new Error("Not called.");
    },
  };

  providers.register(existingProvider);

  assert.throws(
    () =>
      createGeminiAIRuntime({
        config: geminiConfig,
        client: createClient(),
        providers,
      }),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "provider_already_registered" &&
      error.providerId === "gemini",
  );
});
