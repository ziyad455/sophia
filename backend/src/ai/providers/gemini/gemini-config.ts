const DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 30_000;
const MIN_GEMINI_REQUEST_TIMEOUT_MS = 1_000;
const MAX_GEMINI_REQUEST_TIMEOUT_MS = 120_000;

type GeminiEnvironment = Readonly<Record<string, string | undefined>>;

export type GeminiConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export class GeminiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigurationError";
  }
}

function readRequired(
  environment: GeminiEnvironment,
  name: "GEMINI_API_KEY" | "GEMINI_MODEL",
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new GeminiConfigurationError(
      `${name} is required when the Gemini provider is configured.`,
    );
  }

  return value;
}

function readTimeout(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
  }

  const normalized = value.trim();
  const timeout = Number(normalized);

  if (
    !/^\d+$/.test(normalized) ||
    !Number.isSafeInteger(timeout) ||
    timeout < MIN_GEMINI_REQUEST_TIMEOUT_MS ||
    timeout > MAX_GEMINI_REQUEST_TIMEOUT_MS
  ) {
    throw new GeminiConfigurationError(
      "GEMINI_REQUEST_TIMEOUT_MS must be an integer from 1000 to 120000.",
    );
  }

  return timeout;
}

export function parseGeminiConfig(
  environment: GeminiEnvironment,
): GeminiConfig | undefined {
  const hasGeminiSetting = [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "GEMINI_REQUEST_TIMEOUT_MS",
  ].some((name) => environment[name] !== undefined);

  if (!hasGeminiSetting) {
    return undefined;
  }

  return {
    apiKey: readRequired(environment, "GEMINI_API_KEY"),
    model: readRequired(environment, "GEMINI_MODEL"),
    timeoutMs: readTimeout(environment.GEMINI_REQUEST_TIMEOUT_MS),
  };
}
