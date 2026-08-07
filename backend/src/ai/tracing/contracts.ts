import type {
  AIErrorCode,
} from "../errors";
import type {
  AIFinishReason,
  AIUsage,
} from "../contracts";
import type { ContextKind } from "../context";

export const AI_TRACE_STATUSES = Object.freeze([
  "success",
  "failure",
  "cancelled",
] as const);

export type AITraceStatus = (typeof AI_TRACE_STATUSES)[number];

export type AITracePromptMetadata = Readonly<{
  id: string;
  version: string;
}>;

export type AITraceStructuredOutputMetadata = Readonly<{
  id: string;
  version: string;
}>;

export type AITraceContextMetadata = Readonly<{
  blockCount: number;
  kinds: readonly ContextKind[];
  budget: Readonly<{
    unit: "unicode_code_points";
    limit: number;
    consumed: number;
    remaining: number;
  }>;
  truncatedBlockCount: number;
  excludedBlockCount: number;
}>;

export type AITraceMetadata = Readonly<{
  operationName: string;
  prompt?: AITracePromptMetadata;
  context?: AITraceContextMetadata;
}>;

export type AITrace = Readonly<{
  traceId: string;
  operationName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: AITraceStatus;
  providerId: string;
  prompt?: AITracePromptMetadata;
  context?: AITraceContextMetadata;
  structuredOutput?: AITraceStructuredOutputMetadata;
  modelId?: string;
  finishReason?: AIFinishReason;
  usage?: Readonly<AIUsage>;
  errorCode?: AIErrorCode;
  retryable?: boolean;
}>;

export interface AITraceSink {
  record(trace: AITrace): void | Promise<void>;
}

export interface AITraceClock {
  now(): Date;
  monotonicNow(): number;
}

export type AITracingOptions = Readonly<{
  sink: AITraceSink;
  createTraceId?: () => string;
  clock?: AITraceClock;
}>;
