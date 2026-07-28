import type {
  AIProvider,
  AIProviderResponse,
  AIRequest,
} from "../contracts";

export type FakeAIProviderOptions = {
  id?: string;
  defaultModel?: string;
};

type FakeProviderStep =
  | {
      type: "response";
      response: AIProviderResponse;
    }
  | {
      type: "error";
      error: unknown;
    };

export class FakeAIProvider implements AIProvider {
  readonly id: string;
  readonly #defaultModel: string;
  readonly #requests: AIRequest<unknown>[] = [];
  readonly #steps: FakeProviderStep[] = [];

  constructor(options: FakeAIProviderOptions = {}) {
    this.id = options.id ?? "fake";
    this.#defaultModel = options.defaultModel ?? "fake-model";
  }

  get requests(): readonly AIRequest<unknown>[] {
    return [...this.#requests];
  }

  enqueueResponse(response: AIProviderResponse): void {
    this.#steps.push({
      type: "response",
      response,
    });
  }

  enqueueError(error: unknown): void {
    this.#steps.push({
      type: "error",
      error,
    });
  }

  async generate(request: AIRequest<unknown>): Promise<AIProviderResponse> {
    this.#requests.push(request);

    const step = this.#steps.shift();

    if (step?.type === "error") {
      throw step.error;
    }

    if (step?.type === "response") {
      return step.response;
    }

    return {
      providerId: this.id,
      model: request.model ?? this.#defaultModel,
      output: {
        type: "text",
        text: "Deterministic fake AI response.",
      },
      finishReason: "stop",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    };
  }
}
