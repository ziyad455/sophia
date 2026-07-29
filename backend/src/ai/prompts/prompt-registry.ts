import {
  AI_MESSAGE_ROLES,
  type AIMessage,
  type AIMessageRole,
} from "../contracts";
import type {
  PromptDefinition,
  PromptRenderResult,
} from "./contracts";
import { PromptError } from "./errors";

type RegisteredPrompt = {
  validateAndRender(input: unknown): readonly AIMessage[];
};

const promptIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const promptVersionPattern = /^[1-9][0-9]{0,79}$/;

function assertPromptId(promptId: string): void {
  if (
    typeof promptId !== "string" ||
    !promptIdPattern.test(promptId)
  ) {
    throw new PromptError(
      "invalid_prompt_id",
      "Prompt IDs must be stable lowercase configuration identifiers.",
    );
  }
}

function assertPromptVersion(promptId: string, promptVersion: string): void {
  if (
    typeof promptVersion !== "string" ||
    !promptVersionPattern.test(promptVersion)
  ) {
    throw new PromptError(
      "invalid_prompt_version",
      "Prompt versions must be canonical positive integer strings.",
      {
        promptId,
      },
    );
  }
}

function assertPromptIdentity(promptId: string, promptVersion: string): void {
  assertPromptId(promptId);
  assertPromptVersion(promptId, promptVersion);
}

function invalidRenderedPrompt(
  promptId: string,
  promptVersion: string,
): PromptError {
  return new PromptError(
    "invalid_rendered_prompt",
    "The prompt renderer returned invalid messages.",
    {
      promptId,
      promptVersion,
    },
  );
}

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

function validateRenderedMessages(
  value: unknown,
  promptId: string,
  promptVersion: string,
): readonly AIMessage[] {
  try {
    if (!Array.isArray(value) || value.length === 0) {
      throw invalidRenderedPrompt(promptId, promptVersion);
    }

    const messages = value.map((message) => {
      if (!isPlainRecord(message)) {
        throw invalidRenderedPrompt(promptId, promptVersion);
      }

      const keys = Reflect.ownKeys(message);

      if (
        keys.length !== 2 ||
        !keys.includes("role") ||
        !keys.includes("content")
      ) {
        throw invalidRenderedPrompt(promptId, promptVersion);
      }

      const descriptors = Object.getOwnPropertyDescriptors(message);
      const role = descriptors.role?.value;
      const content = descriptors.content?.value;

      if (
        typeof role !== "string" ||
        !AI_MESSAGE_ROLES.includes(role as AIMessageRole) ||
        typeof content !== "string" ||
        content.trim().length === 0
      ) {
        throw invalidRenderedPrompt(promptId, promptVersion);
      }

      return Object.freeze({
        role: role as AIMessageRole,
        content,
      });
    });

    return Object.freeze(messages);
  } catch (error) {
    if (error instanceof PromptError) {
      throw error;
    }

    throw invalidRenderedPrompt(promptId, promptVersion);
  }
}

function invalidPromptDefinition(
  promptId?: string,
  promptVersion?: string,
): PromptError {
  return new PromptError(
    "invalid_prompt_definition",
    "The prompt definition is invalid.",
    {
      promptId,
      promptVersion,
    },
  );
}

function assertPromptDefinition<TInput>(
  definition: PromptDefinition<TInput>,
): void {
  if (!isRecord(definition)) {
    throw invalidPromptDefinition();
  }

  if (
    typeof definition.id !== "string" ||
    typeof definition.version !== "string"
  ) {
    throw invalidPromptDefinition();
  }

  assertPromptIdentity(definition.id, definition.version);

  if (
    typeof definition.description !== "string" ||
    definition.description.trim().length === 0 ||
    !isRecord(definition.inputSchema) ||
    typeof definition.inputSchema.validate !== "function" ||
    typeof definition.render !== "function"
  ) {
    throw invalidPromptDefinition(definition.id, definition.version);
  }
}

function captureDefinition<TInput>(
  definition: PromptDefinition<TInput>,
): RegisteredPrompt {
  const promptId = definition.id;
  const promptVersion = definition.version;
  const validate = definition.inputSchema.validate;
  const render = definition.render;

  return {
    validateAndRender(input) {
      let validation: ReturnType<typeof validate>;

      try {
        validation = validate(input);

        if (
          !isRecord(validation) ||
          typeof validation.success !== "boolean"
        ) {
          throw new Error("The validator returned an invalid result.");
        }
      } catch (error) {
        throw new PromptError(
          "prompt_render_failed",
          "The prompt input validator failed.",
          {
            promptId,
            promptVersion,
            cause: error,
          },
        );
      }

      if (!validation.success) {
        throw new PromptError(
          "invalid_prompt_input",
          "The prompt input is invalid.",
          {
            promptId,
            promptVersion,
          },
        );
      }

      try {
        return render(validation.value);
      } catch (error) {
        throw new PromptError(
          "prompt_render_failed",
          "The prompt renderer failed.",
          {
            promptId,
            promptVersion,
            cause: error,
          },
        );
      }
    },
  };
}

export class PromptRegistry {
  readonly #prompts = new Map<string, Map<string, RegisteredPrompt>>();

  register<TInput>(definition: PromptDefinition<TInput>): void {
    assertPromptDefinition(definition);

    const versions = this.#prompts.get(definition.id) ??
      new Map<string, RegisteredPrompt>();

    if (versions.has(definition.version)) {
      throw new PromptError(
        "duplicate_prompt",
        "The prompt ID and version are already registered.",
        {
          promptId: definition.id,
          promptVersion: definition.version,
        },
      );
    }

    versions.set(definition.version, captureDefinition(definition));
    this.#prompts.set(definition.id, versions);
  }

  render(
    promptId: string,
    promptVersion: string,
    input: unknown,
  ): PromptRenderResult {
    assertPromptIdentity(promptId, promptVersion);

    const prompt = this.#prompts.get(promptId)?.get(promptVersion);

    if (!prompt) {
      throw new PromptError(
        "prompt_not_found",
        "The requested prompt definition is not registered.",
        {
          promptId,
          promptVersion,
        },
      );
    }

    const messages = validateRenderedMessages(
      prompt.validateAndRender(input),
      promptId,
      promptVersion,
    );

    return Object.freeze({
      promptId,
      promptVersion,
      messages,
    });
  }
}
