import { AIRuntime } from "./ai-runtime";
import { AIProviderRegistry } from "./provider-registry";
import {
  GeminiConfigurationError,
  type GeminiConfig,
} from "./providers/gemini/gemini-config";
import { GeminiProvider } from "./providers/gemini/gemini-provider";
import {
  createGeminiSDKClient,
  type GeminiSDKClient,
} from "./providers/gemini/gemini-sdk-client";

export type GeminiAIRuntimeComposition = {
  providers: AIProviderRegistry;
  runtime: AIRuntime;
};

export type CreateGeminiAIRuntimeOptions = {
  config: GeminiConfig | undefined;
  client?: GeminiSDKClient;
  providers?: AIProviderRegistry;
};

export function createGeminiAIRuntime(
  options: CreateGeminiAIRuntimeOptions,
): GeminiAIRuntimeComposition {
  if (!options.config) {
    throw new GeminiConfigurationError(
      "Gemini configuration is required to compose the Gemini AI runtime.",
    );
  }

  const providers = options.providers ?? new AIProviderRegistry();
  const client = options.client ??
    createGeminiSDKClient(options.config.apiKey);

  providers.register(
    new GeminiProvider({
      client,
      model: options.config.model,
      timeoutMs: options.config.timeoutMs,
    }),
  );

  return {
    providers,
    runtime: new AIRuntime({
      providers,
      defaultProviderId: "gemini",
    }),
  };
}
