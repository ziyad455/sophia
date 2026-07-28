export const AI_MESSAGE_ROLES = [
  "system",
  "user",
  "assistant",
] as const;

export type AIMessageRole = (typeof AI_MESSAGE_ROLES)[number];

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type StructuredOutputValidationResult<T> =
  | {
      success: true;
      value: T;
    }
  | {
      success: false;
      issues: readonly string[];
    };

export type StructuredOutputSchema<T> = {
  name: string;
  description?: string;
  jsonSchema?: Readonly<Record<string, unknown>>;
  validate: (value: unknown) => StructuredOutputValidationResult<T>;
};

export type AIOutputRequirement<T> =
  | {
      type: "text";
    }
  | {
      type: "structured";
      schema: StructuredOutputSchema<T>;
    };

export type AIRequest<T = string> = {
  messages: readonly AIMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  output?: AIOutputRequirement<T>;
};

export const AI_FINISH_REASONS = [
  "stop",
  "length",
  "content_filtered",
  "unknown",
] as const;

export type AIFinishReason = (typeof AI_FINISH_REASONS)[number];

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AITextOutput = {
  type: "text";
  text: string;
};

export type AIStructuredOutput<T> = {
  type: "structured";
  value: T;
};

export type AIResponse<T = string> = {
  providerId: string;
  model: string;
  output: AITextOutput | AIStructuredOutput<T>;
  finishReason: AIFinishReason;
  usage?: AIUsage;
};

export type AIProviderResponse = AIResponse<unknown>;

export interface AIProvider {
  readonly id: string;
  generate(request: AIRequest<unknown>): Promise<AIProviderResponse>;
}
