export const AI_ERROR_CODES = [
  "invalid_request",
  "provider_already_registered",
  "provider_not_found",
  "provider_authentication",
  "rate_limited",
  "timeout",
  "provider_unavailable",
  "content_filtered",
  "invalid_response",
  "provider_failure",
] as const;

export type AIErrorCode = (typeof AI_ERROR_CODES)[number];

export type AIErrorOptions = {
  providerId?: string;
  retryable?: boolean;
  cause?: unknown;
  details?: Readonly<Record<string, unknown>>;
};

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly providerId?: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: AIErrorCode,
    message: string,
    options: AIErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AIError";
    this.code = code;
    this.providerId = options.providerId;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function normalizeAIError(
  error: unknown,
  providerId: string,
): AIError {
  if (error instanceof AIError) {
    return error;
  }

  return new AIError(
    "provider_failure",
    "The AI provider request failed.",
    {
      providerId,
      retryable: false,
      cause: error,
    },
  );
}
