import type { Highlight } from "@prisma/client";
import type {
  HighlightAnchor,
  HighlightColor,
  HighlightMode,
  PdfHighlightRect,
  PublicHighlight,
} from "./highlights.types";
import { HIGHLIGHT_COLORS } from "./highlights.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNullableInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

function readPdfRects(value: unknown): PdfHighlightRect[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((rect) => {
    if (!isRecord(rect)) {
      return [];
    }

    const { pageNumber, x, y, width, height } = rect;
    const values = [x, y, width, height];

    if (
      !Number.isInteger(pageNumber) ||
      (pageNumber as number) < 1 ||
      values.some((coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate)) ||
      (width as number) <= 0 ||
      (height as number) <= 0
    ) {
      return [];
    }

    return [{
      pageNumber: pageNumber as number,
      x: x as number,
      y: y as number,
      width: width as number,
      height: height as number,
    }];
  });
}

export function parseStoredHighlightAnchor(value: unknown): HighlightAnchor {
  if (!isRecord(value)) {
    return {
      version: 1,
      source: "reader-selection-v1",
      mode: "reading",
      sourceBlockId: null,
      startOffset: null,
      endOffset: null,
      pdfRects: [],
    };
  }

  const mode: HighlightMode = value.mode === "pdf" ? "pdf" : "reading";

  return {
    version: 1,
    source: "reader-selection-v1",
    mode,
    sourceBlockId:
      mode === "reading" && typeof value.sourceBlockId === "string"
        ? value.sourceBlockId
        : null,
    startOffset: readNullableInteger(value.startOffset),
    endOffset: readNullableInteger(value.endOffset),
    pdfRects: mode === "pdf" ? readPdfRects(value.pdfRects) : [],
  };
}

export function mapHighlight(highlight: Highlight): PublicHighlight {
  const anchor = parseStoredHighlightAnchor(highlight.anchor);
  const color = HIGHLIGHT_COLORS.includes(highlight.color as HighlightColor)
    ? (highlight.color as HighlightColor)
    : "gold";

  return {
    id: highlight.id,
    userBookId: highlight.userBookId,
    bookId: highlight.bookId,
    text: highlight.selectedText,
    mode: anchor.mode,
    pageStart: highlight.pageStart,
    pageEnd: highlight.pageEnd,
    chapterId: highlight.chapterId,
    sourceBlockId: anchor.sourceBlockId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    color,
    pdfRects: anchor.pdfRects,
    createdAt: highlight.createdAt.toISOString(),
    updatedAt: highlight.updatedAt.toISOString(),
  };
}
