export const THEME_HIGHLIGHT_COLORS = [
  "printed-ink-v2-1",
  "printed-ink-v2-2",
  "printed-ink-v2-3",
  "warm-paper-v2-1",
  "warm-paper-v2-2",
  "warm-paper-v2-3",
  "night-study-v2-1",
  "night-study-v2-2",
  "night-study-v2-3",
] as const;
export const LEGACY_HIGHLIGHT_COLORS = [
  "printed-ink-1",
  "printed-ink-2",
  "printed-ink-3",
  "warm-paper-1",
  "warm-paper-2",
  "warm-paper-3",
  "night-study-1",
  "night-study-2",
  "night-study-3",
  "gold",
  "blue",
  "green",
  "rose",
] as const;
export const HIGHLIGHT_COLORS = [
  ...THEME_HIGHLIGHT_COLORS,
  ...LEGACY_HIGHLIGHT_COLORS,
] as const;
export const DEFAULT_HIGHLIGHT_COLOR = THEME_HIGHLIGHT_COLORS[0];

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export type ThemeHighlightColor = (typeof THEME_HIGHLIGHT_COLORS)[number];
export type HighlightMode = "pdf" | "reading";

export type PdfHighlightRect = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HighlightAnchor = {
  version: 1;
  source: "reader-selection-v1";
  mode: HighlightMode;
  sourceBlockId: string | null;
  startOffset: number | null;
  endOffset: number | null;
  pdfRects: PdfHighlightRect[];
};

export type PublicHighlight = {
  id: string;
  userBookId: string;
  bookId: string;
  text: string;
  mode: HighlightMode;
  pageStart: number;
  pageEnd: number;
  chapterId: string | null;
  sourceBlockId: string | null;
  startOffset: number | null;
  endOffset: number | null;
  color: HighlightColor;
  pdfRects: PdfHighlightRect[];
  createdAt: string;
  updatedAt: string;
};
