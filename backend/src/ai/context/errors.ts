import type { ContextKind } from "./contracts";

export const CONTEXT_ERROR_CODES = Object.freeze([
  "invalid_context_request",
  "invalid_context_block",
  "duplicate_context_block",
  "missing_required_context",
  "context_budget_exceeded",
  "context_build_failed",
] as const);

export type ContextErrorCode = (typeof CONTEXT_ERROR_CODES)[number];

export type ContextErrorOptions = {
  blockId?: string;
  kind?: ContextKind;
  cause?: unknown;
};

export class ContextError extends Error {
  readonly code: ContextErrorCode;
  readonly blockId?: string;
  readonly kind?: ContextKind;

  constructor(
    code: ContextErrorCode,
    message: string,
    options: ContextErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ContextError";
    this.code = code;
    this.blockId = options.blockId;
    this.kind = options.kind;
  }
}
