import { badRequest } from "../http/errors";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  THEME_HIGHLIGHT_COLORS,
  type ThemeHighlightColor,
  type HighlightMode,
  type PdfHighlightRect,
} from "./highlights.types";

export type CreateHighlightDto = {
  text: string;
  mode: HighlightMode;
  pageStart: number;
  pageEnd: number;
  chapterId: string | null;
  sourceBlockId: string | null;
  startOffset: number | null;
  endOffset: number | null;
  color: ThemeHighlightColor;
  pdfRects: PdfHighlightRect[];
};

export const MAX_HIGHLIGHT_TEXT_LENGTH = 5_000;

const MAX_SOURCE_BLOCK_ID_LENGTH = 200;
const MAX_PDF_RECTS = 500;
const MAX_OFFSET = 10_000_000;
const createFields = new Set([
  "text",
  "mode",
  "pageStart",
  "pageEnd",
  "chapterId",
  "sourceBlockId",
  "startOffset",
  "endOffset",
  "color",
  "pdfRects",
]);
const pdfRectFields = new Set(["pageNumber", "x", "y", "width", "height"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sourceBlockPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:paragraph:(?:0|[1-9]\d{0,5})$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function parseRequiredPage(value: unknown, field: "pageStart" | "pageEnd"): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw badRequest(`${field} must be an integer greater than or equal to 1.`);
  }

  return value as number;
}

function parseNullableUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw badRequest(`${field} must be a valid UUID or null.`);
  }

  return value;
}

function parseNullableOffset(value: unknown, field: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_OFFSET) {
    throw badRequest(`${field} must be a non-negative integer or null.`);
  }

  return value as number;
}

function parseFiniteCoordinate(value: unknown, field: string, allowZero: boolean): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (!allowZero && value === 0) ||
    value > 100_000
  ) {
    throw badRequest(`${field} must be a valid PDF page coordinate.`);
  }

  return value;
}

function parsePdfRects(value: unknown, pageStart: number, pageEnd: number): PdfHighlightRect[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_PDF_RECTS) {
    throw badRequest(`pdfRects must be an array with at most ${MAX_PDF_RECTS} entries.`);
  }

  return value.map((rect, index) => {
    if (!isRecord(rect)) {
      throw badRequest(`pdfRects[${index}] must be an object.`);
    }

    const unknownFields = Object.keys(rect).filter((key) => !pdfRectFields.has(key));

    if (unknownFields.length > 0) {
      throw badRequest(`pdfRects[${index}] contains unsupported fields.`, {
        fields: unknownFields,
      });
    }

    const pageNumber = parseRequiredPage(rect.pageNumber, "pageStart");

    if (pageNumber < pageStart || pageNumber > pageEnd) {
      throw badRequest(`pdfRects[${index}].pageNumber must be inside the highlight page range.`);
    }

    return {
      pageNumber,
      x: parseFiniteCoordinate(rect.x, `pdfRects[${index}].x`, true),
      y: parseFiniteCoordinate(rect.y, `pdfRects[${index}].y`, true),
      width: parseFiniteCoordinate(rect.width, `pdfRects[${index}].width`, false),
      height: parseFiniteCoordinate(rect.height, `pdfRects[${index}].height`, false),
    };
  });
}

export function parseCreateHighlightDto(value: unknown): CreateHighlightDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  const unknownFields = Object.keys(value).filter((key) => !createFields.has(key));

  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported highlight fields.", {
      fields: unknownFields,
    });
  }

  if (typeof value.text !== "string") {
    throw badRequest("text must be a string.");
  }

  const text = value.text.replace(/\s+/g, " ").trim();

  if (!text) {
    throw badRequest("text cannot be empty.");
  }

  if (text.length > MAX_HIGHLIGHT_TEXT_LENGTH) {
    throw badRequest(`text must be ${MAX_HIGHLIGHT_TEXT_LENGTH} characters or fewer.`);
  }

  if (value.mode !== "pdf" && value.mode !== "reading") {
    throw badRequest("mode must be either pdf or reading.");
  }

  const mode = value.mode;
  const pageStart = parseRequiredPage(value.pageStart, "pageStart");
  const pageEnd = parseRequiredPage(value.pageEnd, "pageEnd");

  if (pageStart > pageEnd) {
    throw badRequest("pageStart cannot be greater than pageEnd.");
  }

  const chapterId = parseNullableUuid(value.chapterId, "chapterId");
  const sourceBlockId = value.sourceBlockId === undefined || value.sourceBlockId === null
    ? null
    : value.sourceBlockId;

  if (
    sourceBlockId !== null &&
    (typeof sourceBlockId !== "string" ||
      sourceBlockId.length > MAX_SOURCE_BLOCK_ID_LENGTH ||
      !sourceBlockPattern.test(sourceBlockId))
  ) {
    throw badRequest("sourceBlockId must identify a valid Reading Mode source block or be null.");
  }

  const startOffset = parseNullableOffset(value.startOffset, "startOffset");
  const endOffset = parseNullableOffset(value.endOffset, "endOffset");

  if ((startOffset === null) !== (endOffset === null)) {
    throw badRequest("startOffset and endOffset must either both be supplied or both be null.");
  }

  if (startOffset !== null && endOffset !== null && endOffset < startOffset) {
    throw badRequest("endOffset cannot be smaller than startOffset.");
  }

  if (mode === "reading" && sourceBlockId !== null && startOffset === endOffset) {
    throw badRequest("A Reading Mode highlight range cannot be empty.");
  }

  if (mode === "reading" && sourceBlockId !== null && startOffset === null) {
    throw badRequest("A sourceBlockId requires reliable startOffset and endOffset values.");
  }

  if (mode === "reading" && sourceBlockId === null && startOffset !== null) {
    throw badRequest("Reading Mode offsets require a sourceBlockId.");
  }

  if (mode === "pdf" && sourceBlockId !== null) {
    throw badRequest("PDF highlights cannot include a Reading Mode sourceBlockId.");
  }

  const color = hasOwn(value, "color") ? value.color : DEFAULT_HIGHLIGHT_COLOR;

  if (
    typeof color !== "string" ||
    !THEME_HIGHLIGHT_COLORS.includes(color as ThemeHighlightColor)
  ) {
    throw badRequest(`color must be one of: ${THEME_HIGHLIGHT_COLORS.join(", ")}.`);
  }

  const pdfRects = parsePdfRects(value.pdfRects, pageStart, pageEnd);

  if (mode === "reading" && pdfRects.length > 0) {
    throw badRequest("Reading Mode highlights cannot include PDF rectangles.");
  }

  return {
    text,
    mode,
    pageStart,
    pageEnd,
    chapterId,
    sourceBlockId: sourceBlockId as string | null,
    startOffset,
    endOffset,
    color: color as ThemeHighlightColor,
    pdfRects,
  };
}

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}
