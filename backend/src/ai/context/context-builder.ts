import {
  CONTEXT_KINDS,
  CONTEXT_TRUNCATION_POLICIES,
  type ContextBlock,
  type ContextBuildRequest,
  type ContextKind,
  type ContextPackage,
  type ContextSource,
  type IncludedContextBlock,
} from "./contracts";
import { ContextError } from "./errors";

const MAX_CONTEXT_BLOCKS = 100;
const MAX_CONTEXT_BUDGET = 100_000;
const MAX_CONTEXT_BLOCK_CONTENT = 100_000;
const MAX_CONTEXT_PRIORITY = 1_000;
const TRUNCATION_MARKER = "\n[context truncated]";
const stableIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PlainDataRecord = Record<string, unknown>;

function invalidRequest(): ContextError {
  return new ContextError(
    "invalid_context_request",
    "The context build request is invalid.",
  );
}

function invalidBlock(
  blockId?: string,
  kind?: ContextKind,
): ContextError {
  return new ContextError(
    "invalid_context_block",
    "A context block is invalid.",
    { blockId, kind },
  );
}

function toPlainDataRecord(value: unknown): PlainDataRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const keys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const record: PlainDataRecord = {};

  for (const key of keys) {
    if (typeof key !== "string") {
      return null;
    }

    const descriptor = descriptors[key];

    if (!descriptor || !("value" in descriptor)) {
      return null;
    }

    record[key] = descriptor.value;
  }

  return record;
}

function hasOnlyFields(
  record: PlainDataRecord,
  allowedFields: readonly string[],
): boolean {
  return Object.keys(record).every((field) => allowedFields.includes(field));
}

function isContextKind(value: unknown): value is ContextKind {
  return typeof value === "string" &&
    CONTEXT_KINDS.includes(value as ContextKind);
}

function isStableId(value: unknown): value is string {
  return typeof value === "string" && stableIdPattern.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isPositivePage(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function sourceFields(kind: ContextKind): readonly string[] {
  const common = ["bookId", "userBookId"];

  switch (kind) {
    case "selected_passage":
      return [...common, "chapterId", "pageId", "pageStart", "pageEnd"];
    case "current_page":
    case "surrounding_page":
      return [...common, "chapterId", "pageId", "pageStart", "pageEnd"];
    case "current_chapter":
      return [...common, "chapterId", "pageStart", "pageEnd"];
    case "book_metadata":
      return common;
    case "highlight":
      return [...common, "highlightId", "chapterId", "pageStart", "pageEnd"];
    case "note":
      return [
        ...common,
        "noteId",
        "highlightId",
        "chapterId",
        "pageStart",
        "pageEnd",
      ];
  }
}

function normalizeSource(
  value: unknown,
  blockId: string,
  kind: ContextKind,
): ContextSource {
  const source = toPlainDataRecord(value);

  if (
    !source ||
    !hasOnlyFields(source, sourceFields(kind)) ||
    !isUuid(source.bookId) ||
    !isUuid(source.userBookId)
  ) {
    throw invalidBlock(blockId, kind);
  }

  for (const field of [
    "chapterId",
    "pageId",
    "highlightId",
    "noteId",
  ] as const) {
    if (source[field] !== undefined && !isUuid(source[field])) {
      throw invalidBlock(blockId, kind);
    }
  }

  const hasPageStart = source.pageStart !== undefined;
  const hasPageEnd = source.pageEnd !== undefined;

  if (
    hasPageStart !== hasPageEnd ||
    (hasPageStart && !isPositivePage(source.pageStart)) ||
    (hasPageEnd && !isPositivePage(source.pageEnd)) ||
    (
      hasPageStart &&
      hasPageEnd &&
      (source.pageStart as number) > (source.pageEnd as number)
    )
  ) {
    throw invalidBlock(blockId, kind);
  }

  if (
    (kind === "selected_passage" && !hasPageStart) ||
    (
      (kind === "current_page" || kind === "surrounding_page") &&
      (
        !isUuid(source.pageId) ||
        !hasPageStart ||
        source.pageStart !== source.pageEnd
      )
    ) ||
    (kind === "current_chapter" && !isUuid(source.chapterId)) ||
    (kind === "highlight" && (!isUuid(source.highlightId) || !hasPageStart)) ||
    (kind === "note" && !isUuid(source.noteId))
  ) {
    throw invalidBlock(blockId, kind);
  }

  return {
    bookId: source.bookId,
    userBookId: source.userBookId,
    ...(source.chapterId === undefined
      ? {}
      : { chapterId: source.chapterId as string }),
    ...(source.pageId === undefined
      ? {}
      : { pageId: source.pageId as string }),
    ...(source.pageStart === undefined
      ? {}
      : { pageStart: source.pageStart as number }),
    ...(source.pageEnd === undefined
      ? {}
      : { pageEnd: source.pageEnd as number }),
    ...(source.highlightId === undefined
      ? {}
      : { highlightId: source.highlightId as string }),
    ...(source.noteId === undefined
      ? {}
      : { noteId: source.noteId as string }),
  };
}

function canTruncate(kind: ContextKind): boolean {
  return kind === "current_page" ||
    kind === "surrounding_page" ||
    kind === "current_chapter";
}

function normalizeBlock(value: unknown): ContextBlock {
  const block = toPlainDataRecord(value);

  if (
    !block ||
    !hasOnlyFields(
      block,
      ["id", "kind", "content", "priority", "truncation", "source"],
    ) ||
    !isStableId(block.id)
  ) {
    throw invalidBlock();
  }

  const blockId = block.id;

  if (!isContextKind(block.kind)) {
    throw invalidBlock(blockId);
  }

  const kind = block.kind;

  if (
    typeof block.content !== "string" ||
    block.content.trim().length === 0 ||
    countCodePoints(block.content) > MAX_CONTEXT_BLOCK_CONTENT ||
    !Number.isSafeInteger(block.priority) ||
    (block.priority as number) < 0 ||
    (block.priority as number) > MAX_CONTEXT_PRIORITY ||
    typeof block.truncation !== "string" ||
    !CONTEXT_TRUNCATION_POLICIES.includes(
      block.truncation as ContextBlock["truncation"],
    ) ||
    (block.truncation === "preserve_start" && !canTruncate(kind))
  ) {
    throw invalidBlock(blockId, kind);
  }

  return {
    id: blockId,
    kind,
    content: block.content,
    priority: block.priority as number,
    truncation: block.truncation as ContextBlock["truncation"],
    source: normalizeSource(block.source, blockId, kind),
  };
}

function normalizeStringArray(
  value: unknown,
  isValid: (candidate: unknown) => candidate is string,
  maximumLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > maximumLength) {
    return null;
  }

  const normalized: string[] = [];

  for (const candidate of value) {
    if (!isValid(candidate) || normalized.includes(candidate)) {
      return null;
    }

    normalized.push(candidate);
  }

  return normalized;
}

function normalizeRequest(value: unknown): ContextBuildRequest {
  const request = toPlainDataRecord(value);

  if (
    !request ||
    !hasOnlyFields(
      request,
      ["blocks", "allowedKinds", "requiredBlockIds", "maxBudget"],
    ) ||
    !Array.isArray(request.blocks) ||
    request.blocks.length > MAX_CONTEXT_BLOCKS ||
    !Number.isSafeInteger(request.maxBudget) ||
    (request.maxBudget as number) < 1 ||
    (request.maxBudget as number) > MAX_CONTEXT_BUDGET
  ) {
    throw invalidRequest();
  }

  const allowedKinds = normalizeStringArray(
    request.allowedKinds,
    isContextKind,
    CONTEXT_KINDS.length,
  );
  const requiredBlockIds = request.requiredBlockIds === undefined
    ? []
    : normalizeStringArray(
        request.requiredBlockIds,
        isStableId,
        MAX_CONTEXT_BLOCKS,
      );

  if (!allowedKinds || allowedKinds.length === 0 || !requiredBlockIds) {
    throw invalidRequest();
  }

  const blocks: ContextBlock[] = [];

  for (const block of request.blocks) {
    blocks.push(normalizeBlock(block));
  }

  return {
    blocks,
    allowedKinds: allowedKinds as ContextKind[],
    requiredBlockIds,
    maxBudget: request.maxBudget as number,
  };
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function sortBlocks(
  blocks: readonly ContextBlock[],
  requiredBlockIds: ReadonlySet<string>,
): ContextBlock[] {
  return [...blocks].sort((left, right) => {
    const requiredDifference = Number(requiredBlockIds.has(right.id)) -
      Number(requiredBlockIds.has(left.id));

    return requiredDifference ||
      right.priority - left.priority ||
      CONTEXT_KINDS.indexOf(left.kind) - CONTEXT_KINDS.indexOf(right.kind) ||
      compareStrings(left.id, right.id);
  });
}

function assertUniqueBlockIds(blocks: readonly ContextBlock[]): void {
  const blockIds = new Set<string>();

  for (const block of blocks) {
    if (blockIds.has(block.id)) {
      throw new ContextError(
        "duplicate_context_block",
        "A context block ID is duplicated.",
        { blockId: block.id, kind: block.kind },
      );
    }

    blockIds.add(block.id);
  }
}

function assertRequiredContext(
  request: ContextBuildRequest,
  requiredBlockIds: ReadonlySet<string>,
): void {
  const blocksById = new Map(
    request.blocks.map((block) => [block.id, block] as const),
  );
  let requiredUsage = 0;

  for (const blockId of [...requiredBlockIds].sort(compareStrings)) {
    const block = blocksById.get(blockId);

    if (!block || !request.allowedKinds.includes(block.kind)) {
      throw new ContextError(
        "missing_required_context",
        "Required context is unavailable.",
        {
          blockId,
          ...(block ? { kind: block.kind } : {}),
        },
      );
    }

    requiredUsage += countCodePoints(block.content);
  }

  if (requiredUsage > request.maxBudget) {
    throw new ContextError(
      "context_budget_exceeded",
      "Required context exceeds the context budget.",
    );
  }
}

function countCodePoints(value: string): number {
  return [...value].length;
}

function truncatePreservingStart(
  content: string,
  availableBudget: number,
): string | null {
  const marker = [...TRUNCATION_MARKER];

  if (availableBudget <= marker.length) {
    return null;
  }

  const prefix = [...content]
    .slice(0, availableBudget - marker.length)
    .join("");

  return prefix + TRUNCATION_MARKER;
}

function freezeContextPackage(
  blocks: readonly IncludedContextBlock[],
  budget: ContextPackage["budget"],
  exclusions: ContextPackage["exclusions"],
): ContextPackage {
  const frozenBlocks = blocks.map((block) =>
    Object.freeze({
      ...block,
      source: Object.freeze({ ...block.source }),
      usage: Object.freeze({ ...block.usage }),
    })
  );
  const frozenExclusions = exclusions.map((exclusion) =>
    Object.freeze({ ...exclusion })
  );

  return Object.freeze({
    blocks: Object.freeze(frozenBlocks),
    budget: Object.freeze({ ...budget }),
    exclusions: Object.freeze(frozenExclusions),
  });
}

export class ContextBuilder {
  build(value: unknown): ContextPackage {
    try {
      const request = normalizeRequest(value);
      const requiredBlockIds = new Set(request.requiredBlockIds ?? []);
      assertUniqueBlockIds(request.blocks);
      assertRequiredContext(request, requiredBlockIds);

      const orderedBlocks = sortBlocks(request.blocks, requiredBlockIds);
      const blocks: IncludedContextBlock[] = [];
      const exclusions: ContextPackage["exclusions"][number][] = [];
      let consumed = 0;

      for (const block of orderedBlocks) {
        if (!request.allowedKinds.includes(block.kind)) {
          exclusions.push({
            blockId: block.id,
            kind: block.kind,
            reason: "kind_not_allowed",
          });
          continue;
        }

        const usage = countCodePoints(block.content);

        if (consumed + usage > request.maxBudget) {
          const availableBudget = request.maxBudget - consumed;
          const truncatedContent =
            !requiredBlockIds.has(block.id) &&
              block.truncation === "preserve_start"
              ? truncatePreservingStart(block.content, availableBudget)
              : null;

          if (truncatedContent) {
            const includedUsage = countCodePoints(truncatedContent);

            blocks.push({
              id: block.id,
              kind: block.kind,
              content: truncatedContent,
              priority: block.priority,
              required: false,
              source: { ...block.source },
              usage: {
                original: usage,
                included: includedUsage,
                truncated: true,
              },
            });
            consumed += includedUsage;
            continue;
          }

          exclusions.push({
            blockId: block.id,
            kind: block.kind,
            reason: "budget_exceeded",
          });
          continue;
        }

        blocks.push({
          id: block.id,
          kind: block.kind,
          content: block.content,
          priority: block.priority,
          required: requiredBlockIds.has(block.id),
          source: { ...block.source },
          usage: {
            original: usage,
            included: usage,
            truncated: false,
          },
        });
        consumed += usage;
      }

      return freezeContextPackage(blocks, {
        unit: "unicode_code_points",
        limit: request.maxBudget,
        consumed,
        remaining: request.maxBudget - consumed,
      }, exclusions);
    } catch (error) {
      if (error instanceof ContextError) {
        throw error;
      }

      throw new ContextError(
        "context_build_failed",
        "The context package could not be built.",
        { cause: error },
      );
    }
  }
}
