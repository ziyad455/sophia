import {
  CONTEXT_KINDS,
  type ContextPackage,
} from "../context";
import type { AITraceContextMetadata } from "./contracts";

export function createAITraceContextMetadata(
  context: ContextPackage,
): AITraceContextMetadata {
  const includedKinds = new Set(context.blocks.map((block) => block.kind));

  return Object.freeze({
    blockCount: context.blocks.length,
    kinds: Object.freeze(
      CONTEXT_KINDS.filter((kind) => includedKinds.has(kind)),
    ),
    budget: Object.freeze({
      unit: context.budget.unit,
      limit: context.budget.limit,
      consumed: context.budget.consumed,
      remaining: context.budget.remaining,
    }),
    truncatedBlockCount: context.blocks.filter(
      (block) => block.usage.truncated,
    ).length,
    excludedBlockCount: context.exclusions.length,
  });
}
