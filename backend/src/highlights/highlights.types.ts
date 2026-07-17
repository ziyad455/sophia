export const HIGHLIGHT_COLORS = ["gold", "blue", "green", "rose"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
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
