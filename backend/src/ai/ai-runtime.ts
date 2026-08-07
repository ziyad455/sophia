import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  AI_FINISH_REASONS,
  AI_MESSAGE_ROLES,
  type AIProviderResponse,
  type AIRequest,
  type AIResponse,
  type AIUsage,
  type StructuredOutputRequest,
  type StructuredOutputResult,
} from "./contracts";
import { AIError, normalizeAIError } from "./errors";
import {
  normalizeAITraceMetadata,
  type NormalizedAITraceMetadata,
} from "./tracing/trace-metadata";
import type { AIProviderRegistry } from "./provider-registry";
import {
  prepareStructuredOutput,
  type PreparedStructuredOutput,
  validateStructuredOutput,
} from "./structured-output";
import type {
  AITrace,
  AITraceClock,
  AITraceMetadata,
  AITracingOptions,
} from "./tracing";

export type AIRuntimeOptions = {
  providers: AIProviderRegistry;
  defaultProviderId: string;
  tracing?: AITracingOptions;
};

const systemTraceClock: AITraceClock = {
  now: () => new Date(),
  monotonicNow: () => performance.now(),
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
  readonly #tracing?: Required<AITracingOptions>;

  constructor(options: AIRuntimeOptions) {
    this.#providers = options.providers;
    this.#defaultProviderId = options.defaultProviderId;
    this.#tracing = options.tracing
      ? {
          sink: options.tracing.sink,
          createTraceId: options.tracing.createTraceId ?? randomUUID,
          clock: options.tracing.clock ?? systemTraceClock,
        }
      : undefined;
  }

  async generateStructured<T>(
    request: StructuredOutputRequest<T>,
    traceMetadata?: AITraceMetadata,
  ): Promise<StructuredOutputResult<T>> {
    if (!isRecord(request)) {
      throw invalidRequest("The structured AI request is invalid.");
    }

    let output: PreparedStructuredOutput<T>;

    try {
      output = prepareStructuredOutput(request.output);
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      throw invalidRequest("The structured AI request is invalid.");
    }

    const response = await this.#executeWithTrace<T>(
      {
        messages: request.messages,
        ...(request.model === undefined ? {} : { model: request.model }),
        ...(request.temperature === undefined
          ? {}
          : { temperature: request.temperature }),
        ...(request.maxOutputTokens === undefined
          ? {}
          : { maxOutputTokens: request.maxOutputTokens }),
        ...(request.signal === undefined ? {} : { signal: request.signal }),
        output: {
          type: "structured",
          schema: output.schema,
        },
      },
      normalizeAITraceMetadata(
        traceMetadata,
        "ai.generate-structured",
        Object.freeze({ id: output.id, version: output.version }),
      ),
    );

    if (response.output.type !== "structured") {
      throw new AIError(
        "invalid_output",
        "The AI provider did not return the requested structured output.",
        {
          providerId: response.providerId,
          retryable: false,
        },
      );
    }

    return {
      outputId: output.id,
      outputVersion: output.version,
      data: response.output.value,
      providerId: response.providerId,
      model: response.model,
      finishReason: response.finishReason,
      ...(response.usage === undefined
        ? {}
        : {
            usage: {
              inputTokens: response.usage.inputTokens,
              outputTokens: response.usage.outputTokens,
              totalTokens: response.usage.totalTokens,
            },
          }),
    };
  }

  async generate<T = string>(
    request: AIRequest<T>,
    traceMetadata?: AITraceMetadata,
  ): Promise<AIResponse<T>> {
    return this.#executeWithTrace(
      request,
      normalizeAITraceMetadata(traceMetadata, "ai.generate"),
    );
  }

  async #executeWithTrace<T>(
    request: AIRequest<T>,
    metadata: NormalizedAITraceMetadata,
  ): Promise<AIResponse<T>> {
    const tracing = this.#tracing;

    if (!tracing) {
      return this.#generate(request);
    }

    let traceId: string;
    let startedAt: Date;
    let startedMonotonic: number;

    try {
      traceId = tracing.createTraceId();
      startedAt = tracing.clock.now();
      startedMonotonic = tracing.clock.monotonicNow();
    } catch {
      return this.#generate(request);
    }

    let response: AIResponse<T>;

    try {
      response = await this.#generate(request);
    } catch (error) {
      const normalizedError = error instanceof AIError
        ? error
        : normalizeAIError(error, this.#defaultProviderId);
      try {
        const completedAt = tracing.clock.now();
        const completedMonotonic = tracing.clock.monotonicNow();
        const trace: AITrace = Object.freeze({
          traceId,
          operationName: metadata.operationName,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: Math.max(0, completedMonotonic - startedMonotonic),
          status: normalizedError.code === "cancelled" ? "cancelled" : "failure",
          providerId: normalizedError.providerId ?? this.#defaultProviderId,
          ...(metadata.prompt === undefined ? {} : { prompt: metadata.prompt }),
          ...(metadata.context === undefined ? {} : { context: metadata.context }),
          ...(metadata.structuredOutput === undefined
            ? {}
            : { structuredOutput: metadata.structuredOutput }),
          errorCode: normalizedError.code,
          retryable: normalizedError.retryable,
        });

        await this.#recordTrace(trace);
      } catch {
        // Trace completion is best-effort and cannot replace the AI error.
      }

      throw error;
    }

    try {
      const completedAt = tracing.clock.now();
      const completedMonotonic = tracing.clock.monotonicNow();
      const trace: AITrace = Object.freeze({
        traceId,
        operationName: metadata.operationName,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(0, completedMonotonic - startedMonotonic),
        status: "success",
        providerId: response.providerId,
        ...(metadata.prompt === undefined ? {} : { prompt: metadata.prompt }),
        ...(metadata.context === undefined ? {} : { context: metadata.context }),
        ...(metadata.structuredOutput === undefined
          ? {}
          : { structuredOutput: metadata.structuredOutput }),
        modelId: response.model,
        finishReason: response.finishReason,
        ...(response.usage === undefined
          ? {}
          : {
              usage: Object.freeze({
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
                totalTokens: response.usage.totalTokens,
              }),
            }),
      });

      await this.#recordTrace(trace);
    } catch {
      // Trace completion is best-effort and cannot replace the AI result.
    }

    return response;
  }

  async #recordTrace(trace: AITrace): Promise<void> {
    try {
      await this.#tracing?.sink.record(trace);
    } catch {
      // Tracing is best-effort and must not replace the AI result or error.
    }
  }

  async #generate<T = string>(request: AIRequest<T>): Promise<AIResponse<T>> {
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
        throw new AIError(
          "invalid_output",
          "The AI provider did not return the requested structured output.",
          {
            providerId: provider.id,
            retryable: false,
          },
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
