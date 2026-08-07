import type {
  AITrace,
  AITraceSink,
} from "./contracts";

export type InMemoryAITraceSinkOptions = Readonly<{
  recordError?: unknown;
}>;

export class InMemoryAITraceSink implements AITraceSink {
  readonly #traces: AITrace[] = [];
  readonly #recordError?: unknown;
  #recordAttempts = 0;

  constructor(options: InMemoryAITraceSinkOptions = {}) {
    this.#recordError = options.recordError;
  }

  get traces(): readonly AITrace[] {
    return [...this.#traces];
  }

  get recordAttempts(): number {
    return this.#recordAttempts;
  }

  record(trace: AITrace): void {
    this.#recordAttempts += 1;

    if (this.#recordError !== undefined) {
      throw this.#recordError;
    }

    this.#traces.push(trace);
  }

  reset(): void {
    this.#traces.length = 0;
    this.#recordAttempts = 0;
  }
}
