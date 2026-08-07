import {
  CONTEXT_KINDS,
  type ContextKind,
} from "../context";
import type {
  AITraceContextMetadata,
  AITraceMetadata,
  AITraceStructuredOutputMetadata,
} from "./contracts";

const traceOperationPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const traceVersionPattern = /^[1-9][0-9]{0,79}$/;

export type NormalizedAITraceMetadata = AITraceMetadata & Readonly<{
  structuredOutput?: AITraceStructuredOutputMetadata;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function normalizeContextMetadata(
  value: unknown,
): AITraceContextMetadata | undefined {
  if (
    !isRecord(value) ||
    !isSafeCount(value.blockCount) ||
    !Array.isArray(value.kinds) ||
    value.kinds.length > CONTEXT_KINDS.length ||
    !value.kinds.every(
      (kind) => typeof kind === "string" &&
        CONTEXT_KINDS.includes(kind as ContextKind),
    ) ||
    new Set(value.kinds).size !== value.kinds.length ||
    !isRecord(value.budget) ||
    value.budget.unit !== "unicode_code_points" ||
    !isSafeCount(value.budget.limit) ||
    !isSafeCount(value.budget.consumed) ||
    !isSafeCount(value.budget.remaining) ||
    value.budget.consumed + value.budget.remaining !== value.budget.limit ||
    !isSafeCount(value.truncatedBlockCount) ||
    value.truncatedBlockCount > value.blockCount ||
    !isSafeCount(value.excludedBlockCount)
  ) {
    return undefined;
  }

  return Object.freeze({
    blockCount: value.blockCount,
    kinds: Object.freeze([...(value.kinds as ContextKind[])]),
    budget: Object.freeze({
      unit: "unicode_code_points",
      limit: value.budget.limit,
      consumed: value.budget.consumed,
      remaining: value.budget.remaining,
    }),
    truncatedBlockCount: value.truncatedBlockCount,
    excludedBlockCount: value.excludedBlockCount,
  });
}

export function normalizeAITraceMetadata(
  value: AITraceMetadata | undefined,
  defaultOperationName: string,
  structuredOutput?: AITraceStructuredOutputMetadata,
): NormalizedAITraceMetadata {
  try {
    if (!isRecord(value)) {
      return Object.freeze({
        operationName: defaultOperationName,
        ...(structuredOutput === undefined ? {} : { structuredOutput }),
      });
    }

    const operationName = typeof value.operationName === "string" &&
        traceOperationPattern.test(value.operationName)
      ? value.operationName
      : defaultOperationName;
    const prompt = isRecord(value.prompt) &&
        typeof value.prompt.id === "string" &&
        traceOperationPattern.test(value.prompt.id) &&
        typeof value.prompt.version === "string" &&
        traceVersionPattern.test(value.prompt.version)
      ? Object.freeze({
          id: value.prompt.id,
          version: value.prompt.version,
        })
      : undefined;
    const context = normalizeContextMetadata(value.context);

    return Object.freeze({
      operationName,
      ...(prompt === undefined ? {} : { prompt }),
      ...(context === undefined ? {} : { context }),
      ...(structuredOutput === undefined ? {} : { structuredOutput }),
    });
  } catch {
    return Object.freeze({
      operationName: defaultOperationName,
      ...(structuredOutput === undefined ? {} : { structuredOutput }),
    });
  }
}
