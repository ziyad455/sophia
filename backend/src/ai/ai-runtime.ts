import {
  AI_FINISH_REASONS,
  AI_MESSAGE_ROLES,
  type AIProviderResponse,
  type AIRequest,
  type AIResponse,
  type AIUsage,
} from "./contracts";
import { AIError, normalizeAIError } from "./errors";
import type { AIProviderRegistry } from "./provider-registry";
import { validateStructuredOutput } from "./structured-output";

export type AIRuntimeOptions = {
  providers: AIProviderRegistry;
  defaultProviderId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidRequest(message: string): AIError {
  return new AIError("invalid_request", message, {
    retryable: false,
  });
}

function invalidResponse(providerId: string, message: string): AIError {
  return new AIError("invalid_response", message, {
    providerId,
    retryable: false,
  });
}

function validateRequest<T>(request: AIRequest<T>): void {
  if (!isRecord(request) || !Array.isArray(request.messages)) {
    throw invalidRequest("The AI request must include a messages array.");
  }

  if (request.messages.length === 0) {
    throw invalidRequest("The AI request must include at least one message.");
  }

  for (const message of request.messages) {
    if (
      !isRecord(message) ||
      typeof message.role !== "string" ||
      !AI_MESSAGE_ROLES.includes(message.role as (typeof AI_MESSAGE_ROLES)[number]) ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0
    ) {
      throw invalidRequest("Each AI message must have a supported role and non-empty content.");
    }
  }

  if (
    request.model !== undefined &&
    (typeof request.model !== "string" || request.model.trim().length === 0)
  ) {
    throw invalidRequest("The AI model must be a non-empty string when provided.");
  }

  if (
    request.temperature !== undefined &&
    (
      typeof request.temperature !== "number" ||
      !Number.isFinite(request.temperature) ||
      request.temperature < 0 ||
      request.temperature > 2
    )
  ) {
    throw invalidRequest("AI temperature must be a finite number from 0 to 2.");
  }

  if (
    request.maxOutputTokens !== undefined &&
    (
      !Number.isSafeInteger(request.maxOutputTokens) ||
      request.maxOutputTokens < 1
    )
  ) {
    throw invalidRequest("AI maxOutputTokens must be a positive integer.");
  }

  if (
    request.signal !== undefined &&
    !(request.signal instanceof AbortSignal)
  ) {
    throw invalidRequest("AI signal must be an AbortSignal when provided.");
  }

  if (request.output === undefined || request.output.type === "text") {
    return;
  }

  if (
    request.output.type !== "structured" ||
    !isRecord(request.output.schema) ||
    typeof request.output.schema.name !== "string" ||
    request.output.schema.name.trim().length === 0 ||
    typeof request.output.schema.validate !== "function"
  ) {
    throw invalidRequest("Structured AI output requires a named schema validator.");
  }
}

function isValidUsage(value: unknown): value is AIUsage {
  if (!isRecord(value)) {
    return false;
  }

  return ["inputTokens", "outputTokens", "totalTokens"].every((field) =>
    Number.isSafeInteger(value[field]) && (value[field] as number) >= 0
  );
}

function validateProviderResponse(
  value: unknown,
  providerId: string,
): AIProviderResponse {
  if (!isRecord(value)) {
    throw invalidResponse(providerId, "The AI provider returned a malformed response.");
  }

  if (value.providerId !== providerId) {
    throw invalidResponse(providerId, "The AI provider response identity did not match.");
  }

  if (typeof value.model !== "string" || value.model.trim().length === 0) {
    throw invalidResponse(providerId, "The AI provider response did not identify a model.");
  }

  if (
    typeof value.finishReason !== "string" ||
    !AI_FINISH_REASONS.includes(
      value.finishReason as (typeof AI_FINISH_REASONS)[number],
    )
  ) {
    throw invalidResponse(providerId, "The AI provider returned an invalid finish reason.");
  }

  if (value.usage !== undefined && !isValidUsage(value.usage)) {
    throw invalidResponse(providerId, "The AI provider returned invalid token usage.");
  }

  if (!isRecord(value.output)) {
    throw invalidResponse(providerId, "The AI provider returned malformed output.");
  }

  if (
    value.output.type !== "structured" &&
    (
      value.output.type !== "text" ||
      typeof value.output.text !== "string"
    )
  ) {
    throw invalidResponse(providerId, "The AI provider returned malformed output.");
  }

  const output = value.output.type === "text"
    ? {
        type: "text" as const,
        text: value.output.text as string,
      }
    : {
        type: "structured" as const,
        value: value.output.value,
      };
  const response: AIProviderResponse = {
    providerId,
    model: value.model,
    output,
    finishReason: value.finishReason as AIProviderResponse["finishReason"],
  };

  if (value.usage !== undefined) {
    response.usage = {
      inputTokens: value.usage.inputTokens,
      outputTokens: value.usage.outputTokens,
      totalTokens: value.usage.totalTokens,
    };
  }

  return response;
}

export class AIRuntime {
  readonly #providers: AIProviderRegistry;
  readonly #defaultProviderId: string;

  constructor(options: AIRuntimeOptions) {
    this.#providers = options.providers;
    this.#defaultProviderId = options.defaultProviderId;
  }

  async generate<T = string>(request: AIRequest<T>): Promise<AIResponse<T>> {
    validateRequest(request);

    if (request.signal?.aborted) {
      throw new AIError("cancelled", "The AI request was cancelled.", {
        retryable: false,
      });
    }

    const provider = this.#providers.get(this.#defaultProviderId);
    let providerResponse: AIProviderResponse;

    try {
      providerResponse = await provider.generate(request);
    } catch (error) {
      throw normalizeAIError(error, provider.id);
    }

    const response = validateProviderResponse(providerResponse, provider.id);
    const outputRequirement = request.output ?? { type: "text" as const };

    if (outputRequirement.type === "structured") {
      if (response.output.type !== "structured") {
        throw invalidResponse(
          provider.id,
          "The AI provider did not return the requested structured output.",
        );
      }

      const value = validateStructuredOutput(
        outputRequirement.schema,
        response.output.value,
        provider.id,
      );

      return {
        ...response,
        output: {
          type: "structured",
          value,
        },
      };
    }

    if (response.output.type !== "text") {
      throw invalidResponse(
        provider.id,
        "The AI provider did not return the requested text output.",
      );
    }

    return {
      ...response,
      output: response.output,
    };
  }
}
