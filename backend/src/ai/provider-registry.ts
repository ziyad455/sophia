import type { AIProvider } from "./contracts";
import { AIError } from "./errors";

const providerIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export class AIProviderRegistry {
  readonly #providers = new Map<string, AIProvider>();

  register(provider: AIProvider): void {
    if (!providerIdPattern.test(provider.id)) {
      throw new AIError(
        "invalid_request",
        "AI provider IDs must be stable lowercase configuration identifiers.",
        {
          retryable: false,
        },
      );
    }

    if (this.#providers.has(provider.id)) {
      throw new AIError(
        "provider_already_registered",
        `AI provider "${provider.id}" is already registered.`,
        {
          providerId: provider.id,
          retryable: false,
        },
      );
    }

    this.#providers.set(provider.id, provider);
  }

  get(providerId: string): AIProvider {
    const provider = this.#providers.get(providerId);

    if (!provider) {
      throw new AIError(
        "provider_not_found",
        `AI provider "${providerId}" is not registered.`,
        {
          providerId,
          retryable: false,
        },
      );
    }

    return provider;
  }

  listProviderIds(): string[] {
    return [...this.#providers.keys()];
  }
}
