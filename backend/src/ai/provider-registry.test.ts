import assert from "node:assert/strict";
import test from "node:test";
import type { AIProvider, AIProviderResponse } from "./contracts";
import { AIError, normalizeAIError } from "./errors";
import { AIProviderRegistry } from "./provider-registry";

function createProvider(id: string): AIProvider {
  return {
    id,
    async generate(request): Promise<AIProviderResponse> {
      return {
        providerId: id,
        model: request.model ?? "fake-model",
        output: {
          type: "text",
          text: "A deterministic response.",
        },
        finishReason: "stop",
      };
    },
  };
}

test("registers providers and resolves them by stable ID", () => {
  const registry = new AIProviderRegistry();
  const provider = createProvider("fake");

  registry.register(provider);

  assert.equal(registry.get("fake"), provider);
  assert.deepEqual(registry.listProviderIds(), ["fake"]);
});

test("rejects duplicate provider registration instead of silently replacing it", () => {
  const registry = new AIProviderRegistry();

  registry.register(createProvider("fake"));

  assert.throws(
    () => registry.register(createProvider("fake")),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "provider_already_registered" &&
      error.providerId === "fake" &&
      error.retryable === false,
  );
});

test("rejects provider IDs that are not stable configuration identifiers", () => {
  const registry = new AIProviderRegistry();

  for (const providerId of ["", "Fake Provider", "fake/provider", ".fake"]) {
    assert.throws(
      () => registry.register(createProvider(providerId)),
      (error: unknown) =>
        error instanceof AIError &&
        error.code === "invalid_request" &&
        error.retryable === false,
    );
  }
});

test("reports an unknown configured provider with a normalized AI error", () => {
  const registry = new AIProviderRegistry();

  assert.throws(
    () => registry.get("missing"),
    (error: unknown) =>
      error instanceof AIError &&
      error.code === "provider_not_found" &&
      error.providerId === "missing" &&
      error.retryable === false,
  );
});

test("normalizes unknown failures without leaking the provider error message", () => {
  const providerFailure = new Error("secret-key=do-not-expose");
  const error = normalizeAIError(providerFailure, "fake");

  assert.equal(error.code, "provider_failure");
  assert.equal(error.providerId, "fake");
  assert.equal(error.retryable, false);
  assert.equal(error.message, "The AI provider request failed.");
  assert.equal(error.cause, providerFailure);
  assert.equal(error.message.includes("secret-key"), false);
});

test("preserves errors already normalized by a provider adapter", () => {
  const providerError = new AIError(
    "rate_limited",
    "The AI provider rate limit was reached.",
    {
      providerId: "fake",
      retryable: true,
    },
  );

  assert.equal(normalizeAIError(providerError, "fake"), providerError);
});
