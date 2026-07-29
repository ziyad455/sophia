export const PROMPT_ERROR_CODES = [
  "invalid_prompt_id",
  "invalid_prompt_version",
  "invalid_prompt_definition",
  "duplicate_prompt",
  "prompt_not_found",
  "invalid_prompt_input",
  "invalid_rendered_prompt",
  "prompt_render_failed",
] as const;

export type PromptErrorCode = (typeof PROMPT_ERROR_CODES)[number];

export type PromptErrorOptions = {
  promptId?: string;
  promptVersion?: string;
  cause?: unknown;
};

export class PromptError extends Error {
  readonly code: PromptErrorCode;
  readonly promptId?: string;
  readonly promptVersion?: string;

  constructor(
    code: PromptErrorCode,
    message: string,
    options: PromptErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "PromptError";
    this.code = code;
    this.promptId = options.promptId;
    this.promptVersion = options.promptVersion;
  }
}

