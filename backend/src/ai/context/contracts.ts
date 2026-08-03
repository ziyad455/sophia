export const CONTEXT_KINDS = Object.freeze([
  "selected_passage",
  "current_page",
  "surrounding_page",
  "current_chapter",
  "book_metadata",
  "highlight",
  "note",
] as const);

export type ContextKind = (typeof CONTEXT_KINDS)[number];

export const CONTEXT_TRUNCATION_POLICIES = Object.freeze([
  "none",
  "preserve_start",
] as const);

export type ContextTruncationPolicy =
  (typeof CONTEXT_TRUNCATION_POLICIES)[number];

export type ContextSource = Readonly<{
  bookId: string;
  userBookId: string;
  chapterId?: string;
  pageId?: string;
  pageStart?: number;
  pageEnd?: number;
  highlightId?: string;
  noteId?: string;
}>;

export type ContextBlock = Readonly<{
  id: string;
  kind: ContextKind;
  content: string;
  priority: number;
  truncation: ContextTruncationPolicy;
  source: ContextSource;
}>;

export type ContextBuildRequest = Readonly<{
  blocks: readonly ContextBlock[];
  allowedKinds: readonly ContextKind[];
  requiredBlockIds?: readonly string[];
  maxBudget: number;
}>;

export type ContextBlockUsage = Readonly<{
  original: number;
  included: number;
  truncated: boolean;
}>;

export type IncludedContextBlock = Readonly<{
  id: string;
  kind: ContextKind;
  content: string;
  priority: number;
  required: boolean;
  source: ContextSource;
  usage: ContextBlockUsage;
}>;

export const CONTEXT_EXCLUSION_REASONS = Object.freeze([
  "kind_not_allowed",
  "budget_exceeded",
] as const);

export type ContextExclusionReason =
  (typeof CONTEXT_EXCLUSION_REASONS)[number];

export type ContextExclusion = Readonly<{
  blockId: string;
  kind: ContextKind;
  reason: ContextExclusionReason;
}>;

export type ContextBudget = Readonly<{
  unit: "unicode_code_points";
  limit: number;
  consumed: number;
  remaining: number;
}>;

export type ContextPackage = Readonly<{
  blocks: readonly IncludedContextBlock[];
  budget: ContextBudget;
  exclusions: readonly ContextExclusion[];
}>;
