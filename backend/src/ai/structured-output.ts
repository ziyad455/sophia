import type {
  StructuredOutputDefinition,
  StructuredOutputSchema,
} from "./contracts";
import { AIError } from "./errors";

const outputIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const outputVersionPattern = /^[1-9][0-9]{0,79}$/;
const outputDefinitionFields = new Set([
  "id",
  "version",
  "description",
  "schema",
  "jsonSchema",
]);
const outputSchemaFields = new Set(["validate"]);

export type PreparedStructuredOutput<T> = Readonly<{
  id: string;
  version: string;
  schema: StructuredOutputSchema<T>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function invalidDefinition(cause?: unknown): AIError {
  return new AIError(
    "invalid_request",
    "The structured output definition is invalid.",
    {
      retryable: false,
      ...(cause === undefined ? {} : { cause }),
    },
  );
}

function hasOnlyDataFields(
  value: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): boolean {
  const keys = Reflect.ownKeys(value);

  if (
    keys.some((key) => typeof key !== "string" || !allowedFields.has(key))
  ) {
    return false;
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);

  return keys.every((key) =>
    typeof key === "string" && Object.hasOwn(descriptors[key] ?? {}, "value")
  );
}

export function prepareStructuredOutput<T>(
  definition: StructuredOutputDefinition<T>,
): PreparedStructuredOutput<T> {
  try {
    if (
      !isPlainRecord(definition) ||
      !hasOnlyDataFields(definition, outputDefinitionFields) ||
      typeof definition.id !== "string" ||
      !outputIdPattern.test(definition.id) ||
      typeof definition.version !== "string" ||
      !outputVersionPattern.test(definition.version) ||
      typeof definition.description !== "string" ||
      definition.description.trim().length === 0 ||
      definition.description.length > 500 ||
      !isPlainRecord(definition.schema) ||
      !hasOnlyDataFields(definition.schema, outputSchemaFields) ||
      typeof definition.schema.validate !== "function" ||
      (
        definition.jsonSchema !== undefined &&
        !isPlainRecord(definition.jsonSchema)
      )
    ) {
      throw invalidDefinition();
    }

    const jsonSchema = definition.jsonSchema === undefined
      ? undefined
      : Object.freeze({ ...definition.jsonSchema });
    const schema = Object.freeze({
      name: definition.id,
      description: definition.description,
      ...(jsonSchema === undefined ? {} : { jsonSchema }),
      validate: definition.schema.validate,
    });

    return Object.freeze({
      id: definition.id,
      version: definition.version,
      schema,
    });
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }

    throw invalidDefinition(error);
  }
}

export function validateStructuredOutput<T>(
  schema: StructuredOutputSchema<T>,
  value: unknown,
  providerId: string,
): T {
  let result: ReturnType<StructuredOutputSchema<T>["validate"]>;

  try {
    result = schema.validate(value);

    if (
      !isRecord(result) ||
      typeof result.success !== "boolean" ||
      (
        result.success &&
        !Object.hasOwn(result, "value")
      ) ||
      (
        !result.success &&
        (
          !Array.isArray(result.issues) ||
          !result.issues.every((issue) => typeof issue === "string")
        )
      )
    ) {
      throw new Error("The structured output validator returned an invalid result.");
    }
  } catch (error) {
    throw new AIError(
      "invalid_output",
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
      "invalid_output",
      "The AI provider returned invalid structured output.",
      {
        providerId,
        retryable: false,
        details: {
          schemaName: schema.name,
        },
      },
    );
  }

  return result.value;
}
