import type {
  AIMessage,
  StructuredOutputSchema,
} from "../contracts";

export type PromptInputSchema<TInput> = Readonly<
  Pick<StructuredOutputSchema<TInput>, "validate">
>;

export type PromptDefinition<TInput> = Readonly<{
  id: string;
  version: string;
  description: string;
  inputSchema: PromptInputSchema<TInput>;
  render: (input: TInput) => readonly AIMessage[];
}>;

export type PromptRenderResult = Readonly<{
  promptId: string;
  promptVersion: string;
  messages: readonly Readonly<AIMessage>[];
}>;
