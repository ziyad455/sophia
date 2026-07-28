import type { StructuredOutputSchema } from "./contracts";
import { AIError } from "./errors";

export function validateStructuredOutput<T>(
  schema: StructuredOutputSchema<T>,
  value: unknown,
  providerId: string,
): T {
  let result;

  try {
    result = schema.validate(value);
  } catch (error) {
    throw new AIError(
      "invalid_response",
      "The structured output validator failed.",
      {
        providerId,
        retryable: false,
        cause: error,
        details: {
          schemaName: schema.name,
        },
      },
    );
  }

  if (!result.success) {
    throw new AIError(
      "invalid_response",
      "The AI provider returned invalid structured output.",
      {
        providerId,
        retryable: false,
        details: {
          schemaName: schema.name,
          issues: [...result.issues],
        },
      },
    );
  }

  return result.value;
}
