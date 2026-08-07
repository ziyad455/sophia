import type {
  AIFinishReason,
  AIProvider,
  AIProviderResponse,
  AIRequest,
  AIUsage,
} from "../../contracts";
import { AIError } from "../../errors";
import type {
  GeminiContent,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiSDKClient,
} from "./gemini-sdk-client";

export const GEMINI_PROVIDER_ID = "gemini";

export type GeminiProviderOptions = {
  client: GeminiSDKClient;
  model: string;
  timeoutMs: number;
};

function mapFinishReason(reason: string | undefined): AIFinishReason {
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "content_filtered";
    default:
      return "unknown";
  }
}

function mapContents(request: AIRequest<unknown>): GeminiContent[] {
  return request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

function assertSystemInstructionOrder(request: AIRequest<unknown>): void {
  let conversationStarted = false;

  for (const message of request.messages) {
    if (message.role === "system") {
      if (conversationStarted) {
        throw new AIError(
          "invalid_request",
          "Gemini system instructions must precede conversation messages.",
          {
            providerId: GEMINI_PROVIDER_ID,
            retryable: false,
          },
        );
      }
    } else {
      conversationStarted = true;
    }
  }
}

function invalidResponse(message: string): AIError {
  return new AIError("invalid_response", message, {
    providerId: GEMINI_PROVIDER_ID,
    retryable: false,
  });
}

function invalidOutput(message: string, cause?: unknown): AIError {
  return new AIError("invalid_output", message, {
    providerId: GEMINI_PROVIDER_ID,
    retryable: false,
    ...(cause === undefined ? {} : { cause }),
  });
}

function invalidRequest(message: string): AIError {
  return new AIError("invalid_request", message, {
    providerId: GEMINI_PROVIDER_ID,
    retryable: false,
  });
}

const GEMINI_JSON_SCHEMA_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertSupportedJsonSchema(schema: unknown): void {
  if (!isRecord(schema)) {
    throw invalidRequest("Gemini structured output requires a JSON Schema object.");
  }

  if (
    "$ref" in schema &&
    Object.keys(schema).some((keyword) => !keyword.startsWith("$"))
  ) {
    throw invalidRequest(
      "The structured output schema uses a construct unsupported by Gemini.",
    );
  }

  for (const [keyword, value] of Object.entries(schema)) {
    if (!GEMINI_JSON_SCHEMA_KEYWORDS.has(keyword)) {
      throw invalidRequest(
        "The structured output schema uses a construct unsupported by Gemini.",
      );
    }

    if (keyword === "properties" || keyword === "$defs") {
      if (!isRecord(value)) {
        throw invalidRequest("The structured output schema is malformed.");
      }

      for (const child of Object.values(value)) {
        assertSupportedJsonSchema(child);
      }
    }

    if (keyword === "items" && value !== undefined) {
      assertSupportedJsonSchema(value);
    }

    if (
      keyword === "additionalProperties" &&
      typeof value !== "boolean"
    ) {
      assertSupportedJsonSchema(value);
    }

    if (
      keyword === "prefixItems" ||
      keyword === "anyOf" ||
      keyword === "oneOf"
    ) {
      if (!Array.isArray(value)) {
        throw invalidRequest("The structured output schema is malformed.");
      }

      for (const child of value) {
        assertSupportedJsonSchema(child);
      }
    }
  }
}

function isTokenCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function mapUsage(
  metadata: GeminiGenerateContentResponse["usageMetadata"],
): AIUsage | undefined {
  if (
    !metadata ||
    !isTokenCount(metadata.promptTokenCount) ||
    !isTokenCount(metadata.candidatesTokenCount) ||
    !isTokenCount(metadata.totalTokenCount)
  ) {
    return undefined;
  }

  return {
    inputTokens: metadata.promptTokenCount,
    outputTokens: metadata.candidatesTokenCount,
    totalTokens: metadata.totalTokenCount,
  };
}

function normalizedProviderError(
  code: AIError["code"],
  message: string,
  error: unknown,
  retryable: boolean,
  status?: number,
): AIError {
  return new AIError(code, message, {
    providerId: GEMINI_PROVIDER_ID,
    retryable,
    cause: error,
    ...(status === undefined ? {} : { details: { status } }),
  });
}

function readTransportCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.code === "string") {
    return error.code;
  }

  return isRecord(error.cause) && typeof error.cause.code === "string"
    ? error.cause.code
    : undefined;
}

function normalizeGeminiError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error;
  }

  const status = isRecord(error) && typeof error.status === "number"
    ? error.status
    : undefined;

  if (status === 400) {
    return normalizedProviderError(
      "invalid_request",
      "Gemini rejected the AI request.",
      error,
      false,
      status,
    );
  }

  if (status === 401 || status === 403) {
    return normalizedProviderError(
      "provider_authentication",
      "Gemini authentication failed.",
      error,
      false,
      status,
    );
  }

  if (status === 408) {
    return normalizedProviderError(
      "timeout",
      "The Gemini request timed out.",
      error,
      true,
      status,
    );
  }

  if (status === 429) {
    return normalizedProviderError(
      "rate_limited",
      "The Gemini rate limit was reached.",
      error,
      true,
      status,
    );
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return normalizedProviderError(
      "provider_unavailable",
      "Gemini is temporarily unavailable.",
      error,
      true,
      status,
    );
  }

  const transportCode = readTransportCode(error);

  if (
    transportCode === "ETIMEDOUT" ||
    transportCode === "UND_ERR_CONNECT_TIMEOUT"
  ) {
    return normalizedProviderError(
      "timeout",
      "The Gemini request timed out.",
      error,
      true,
    );
  }

  if (
    transportCode === "ECONNRESET" ||
    transportCode === "ECONNREFUSED" ||
    transportCode === "ENOTFOUND" ||
    transportCode === "EAI_AGAIN"
  ) {
    return normalizedProviderError(
      "provider_unavailable",
      "Gemini is temporarily unavailable.",
      error,
      true,
    );
  }

  return normalizedProviderError(
    "provider_failure",
    "The Gemini request failed.",
    error,
    false,
    status,
  );
}

function cancelledError(cause?: unknown): AIError {
  return new AIError("cancelled", "The Gemini request was cancelled.", {
    providerId: GEMINI_PROVIDER_ID,
    retryable: false,
    ...(cause === undefined ? {} : { cause }),
  });
}

function timeoutError(cause: unknown): AIError {
  return new AIError("timeout", "The Gemini request timed out.", {
    providerId: GEMINI_PROVIDER_ID,
    retryable: true,
    cause,
  });
}

export class GeminiProvider implements AIProvider {
  readonly id = GEMINI_PROVIDER_ID;
  readonly #client: GeminiSDKClient;
  readonly #model: string;
  readonly #timeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    this.#client = options.client;
    this.#model = options.model;
    this.#timeoutMs = options.timeoutMs;
  }

  async generate(request: AIRequest<unknown>): Promise<AIProviderResponse> {
    assertSystemInstructionOrder(request);

    if (request.signal?.aborted) {
      throw cancelledError();
    }

    const model = request.model ?? this.#model;
    const structuredOutput = request.output?.type === "structured"
      ? request.output
      : undefined;

    if (structuredOutput?.schema.jsonSchema) {
      assertSupportedJsonSchema(structuredOutput.schema.jsonSchema);
    }

    const contents = mapContents(request);

    if (contents.length === 0) {
      throw invalidRequest(
        "Gemini requests require at least one conversation message.",
      );
    }

    const systemInstruction = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const sdkRequest: GeminiGenerateContentRequest = {
      model,
      contents,
      config: {
        ...(systemInstruction
          ? {
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
            }
          : {}),
        ...(request.temperature === undefined
          ? {}
          : { temperature: request.temperature }),
        ...(request.maxOutputTokens === undefined
          ? {}
          : { maxOutputTokens: request.maxOutputTokens }),
        ...(structuredOutput
          ? {
              responseMimeType: "application/json" as const,
              ...(structuredOutput.schema.jsonSchema
                ? {
                    responseJsonSchema: structuredOutput.schema.jsonSchema,
                  }
                : {}),
            }
          : {}),
      },
    };
    const sdkController = new AbortController();
    const callerCancellationReason = new DOMException(
      "The caller cancelled the Gemini request.",
      "AbortError",
    );
    const timeoutReason = new DOMException(
      "The Gemini request deadline elapsed.",
      "TimeoutError",
    );
    const forwardCallerCancellation = () => {
      sdkController.abort(callerCancellationReason);
    };

    request.signal?.addEventListener("abort", forwardCallerCancellation, {
      once: true,
    });

    const timeout = setTimeout(() => {
      sdkController.abort(timeoutReason);
    }, this.#timeoutMs);

    sdkRequest.config = {
      ...sdkRequest.config,
      abortSignal: sdkController.signal,
    };

    let response: GeminiGenerateContentResponse;

    try {
      response = await this.#client.generateContent(sdkRequest);
    } catch (error) {
      if (sdkController.signal.reason === timeoutReason) {
        throw timeoutError(error);
      }

      if (sdkController.signal.reason === callerCancellationReason) {
        throw cancelledError(error);
      }

      throw normalizeGeminiError(error);
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener(
        "abort",
        forwardCallerCancellation,
      );
    }

    if (typeof response.text !== "string" || response.text.trim().length === 0) {
      if (
        mapFinishReason(response.candidates?.[0]?.finishReason) ===
          "content_filtered" ||
        response.promptFeedback?.blockReason
      ) {
        throw new AIError(
          "content_filtered",
          "Gemini blocked the requested content.",
          {
            providerId: this.id,
            retryable: false,
          },
        );
      }

      if (structuredOutput) {
        throw invalidOutput("Gemini returned empty structured output.");
      }

      throw invalidResponse("Gemini returned an empty response.");
    }

    let output: AIProviderResponse["output"];

    if (structuredOutput) {
      let value: unknown;

      try {
        value = JSON.parse(response.text);
      } catch (error) {
        throw invalidOutput(
          "Gemini returned malformed structured output.",
          error,
        );
      }

      output = {
        type: "structured",
        value,
      };
    } else {
      output = {
        type: "text",
        text: response.text,
      };
    }

    const usage = mapUsage(response.usageMetadata);

    return {
      providerId: this.id,
      model: response.modelVersion?.trim() || model,
      output,
      finishReason: mapFinishReason(response.candidates?.[0]?.finishReason),
      ...(usage ? { usage } : {}),
    };
  }
}
