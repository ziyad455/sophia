import { badRequest } from "../http/errors";
import type {
  NoteAnchor,
  NoteContext,
  NotePdfRect,
  PublicNoteType,
} from "./notes.types";
import { SUPPORTED_NOTE_TYPES } from "./notes.types";

export const MAX_NOTE_CONTENT_LENGTH = 10_000;
export const MAX_NOTE_QUOTE_LENGTH = 5_000;

const MAX_PDF_RECTS = 500;
const MAX_OFFSET = 10_000_000;
const createFields = new Set([
  "type",
  "content",
  "quote",
  "pageStart",
  "pageEnd",
  "chapterId",
  "highlightId",
  "anchor",
]);
const updateFields = new Set(["content"]);
const anchorFields = new Set([
  "mode",
  "sourceBlockId",
  "startOffset",
  "endOffset",
  "pdfRects",
]);
const pdfRectFields = new Set(["pageNumber", "x", "y", "width", "height"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sourceBlockPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:paragraph:(?:0|[1-9]\d{0,5})$/i;
const htmlMarkupPattern = /<\s*\/?\s*[a-z][^>]*>/i;

export type CreateNoteDto = {
  type: PublicNoteType;
  context: NoteContext;
  content: string;
  quote: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  chapterId: string | null;
  highlightId: string | null;
  anchor: NoteAnchor | null;
};

export type UpdateNoteDto = {
  content: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
  message: string,
): void {
  const unknownFields = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownFields.length > 0) {
    throw badRequest(message, { fields: unknownFields });
  }
}

function parsePlainText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw badRequest(field + " must be a string.");
  }

  const text = value.trim();

  if (!text) {
    throw badRequest(field + " cannot be empty.");
  }

  if (text.length > maxLength) {
    throw badRequest(
      field + " must be " + maxLength.toLocaleString("en-US") + " characters or fewer.",
    );
  }

  if (text.includes("\u0000") || htmlMarkupPattern.test(text)) {
    throw badRequest(field + " must be plain text without HTML markup.");
  }

  return text;
}

function parseType(value: unknown): PublicNoteType {
  const type = value === undefined ? "margin_note" : value;

  if (
    typeof type !== "string" ||
    !SUPPORTED_NOTE_TYPES.includes(type as PublicNoteType)
  ) {
    throw badRequest("type must be margin_note.");
  }

  return type as PublicNoteType;
}

function parseNullableUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw badRequest(field + " must be a valid UUID or null.");
  }

  return value;
}

function parseNullablePage(value: unknown, field: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isInteger(value) || (value as number) < 1) {
    throw badRequest(field + " must be an integer greater than or equal to 1.");
  }

  return value as number;
}

function parseNullableOffset(value: unknown, field: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > MAX_OFFSET
  ) {
    throw badRequest(field + " must be a non-negative integer or null.");
  }

  return value as number;
}

function parseCoordinate(value: unknown, field: string, allowZero: boolean): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (!allowZero && value === 0) ||
    value > 100_000
  ) {
    throw badRequest(field + " must be a valid PDF page coordinate.");
  }

  return value;
}

function parsePdfRects(
  value: unknown,
  pageStart: number,
  pageEnd: number,
): NotePdfRect[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_PDF_RECTS) {
    throw badRequest(
      "anchor.pdfRects must be an array with at most " + MAX_PDF_RECTS + " entries.",
    );
  }

  return value.map((rect, index) => {
    if (!isRecord(rect)) {
      throw badRequest("anchor.pdfRects[" + index + "] must be an object.");
    }

    rejectUnknownFields(
      rect,
      pdfRectFields,
      "anchor.pdfRects[" + index + "] contains unsupported fields.",
    );
    const pageNumber = parseNullablePage(
      rect.pageNumber,
      "anchor.pdfRects[" + index + "].pageNumber",
    );

    if (
      pageNumber === null ||
      pageNumber < pageStart ||
      pageNumber > pageEnd
    ) {
      throw badRequest(
        "anchor.pdfRects[" + index + "].pageNumber must be inside the note page range.",
      );
    }

    return {
      pageNumber,
      x: parseCoordinate(rect.x, "anchor.pdfRects[" + index + "].x", true),
      y: parseCoordinate(rect.y, "anchor.pdfRects[" + index + "].y", true),
      width: parseCoordinate(rect.width, "anchor.pdfRects[" + index + "].width", false),
      height: parseCoordinate(rect.height, "anchor.pdfRects[" + index + "].height", false),
    };
  });
}

function parseAnchor(
  value: unknown,
  pageStart: number,
  pageEnd: number,
): NoteAnchor | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw badRequest("anchor must be an object or null.");
  }

  rejectUnknownFields(value, anchorFields, "anchor contains unsupported fields.");

  if (value.mode !== "pdf" && value.mode !== "reading") {
    throw badRequest("anchor.mode must be either pdf or reading.");
  }

  const sourceBlockId = value.sourceBlockId === undefined || value.sourceBlockId === null
    ? null
    : value.sourceBlockId;

  if (
    sourceBlockId !== null &&
    (typeof sourceBlockId !== "string" || !sourceBlockPattern.test(sourceBlockId))
  ) {
    throw badRequest(
      "anchor.sourceBlockId must identify a valid Reading Mode source block or be null.",
    );
  }

  const startOffset = parseNullableOffset(value.startOffset, "anchor.startOffset");
  const endOffset = parseNullableOffset(value.endOffset, "anchor.endOffset");

  if ((startOffset === null) !== (endOffset === null)) {
    throw badRequest(
      "anchor.startOffset and anchor.endOffset must both be supplied or both be null.",
    );
  }

  if (
    startOffset !== null &&
    endOffset !== null &&
    endOffset < startOffset
  ) {
    throw badRequest("anchor.endOffset cannot be smaller than anchor.startOffset.");
  }

  const pdfRects = parsePdfRects(value.pdfRects, pageStart, pageEnd);

  if (value.mode === "pdf" && sourceBlockId !== null) {
    throw badRequest("A PDF note anchor cannot include a Reading Mode source block.");
  }

  if (value.mode === "reading" && pdfRects.length > 0) {
    throw badRequest("A Reading Mode note anchor cannot include PDF rectangles.");
  }

  if (value.mode === "reading" && sourceBlockId !== null && startOffset === null) {
    throw badRequest("A Reading Mode source block requires reliable offsets.");
  }

  return {
    version: 1,
    source: "reader-selection-v1",
    mode: value.mode,
    sourceBlockId: sourceBlockId as string | null,
    startOffset,
    endOffset,
    pdfRects,
  };
}

export function parseCreateNoteDto(value: unknown): CreateNoteDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  rejectUnknownFields(
    value,
    createFields,
    "Request body contains unsupported note fields.",
  );

  const type = parseType(value.type);
  const content = parsePlainText(
    value.content,
    "content",
    MAX_NOTE_CONTENT_LENGTH,
  );
  const highlightId = parseNullableUuid(value.highlightId, "highlightId");

  if (highlightId) {
    const clientSourceFields = ["quote", "pageStart", "pageEnd", "chapterId", "anchor"]
      .filter((field) => hasOwn(value, field));

    if (clientSourceFields.length > 0) {
      throw badRequest(
        "Source context for a highlight note is derived from the saved highlight.",
        { fields: clientSourceFields },
      );
    }

    return {
      type,
      context: "highlight",
      content,
      quote: null,
      pageStart: null,
      pageEnd: null,
      chapterId: null,
      highlightId,
      anchor: null,
    };
  }

  const quote = value.quote === undefined || value.quote === null
    ? null
    : parsePlainText(value.quote, "quote", MAX_NOTE_QUOTE_LENGTH)
        .replace(/\s+/g, " ");
  const pageStart = parseNullablePage(value.pageStart, "pageStart");
  const pageEnd = parseNullablePage(value.pageEnd, "pageEnd");
  const chapterId = parseNullableUuid(value.chapterId, "chapterId");

  if ((pageStart === null) !== (pageEnd === null)) {
    throw badRequest("pageStart and pageEnd must both be supplied or both be null.");
  }

  if (pageStart !== null && pageEnd !== null && pageStart > pageEnd) {
    throw badRequest("pageStart cannot be greater than pageEnd.");
  }

  if (quote) {
    if (pageStart === null || pageEnd === null) {
      throw badRequest("A passage note requires a reliable page range.");
    }

    return {
      type,
      context: "passage",
      content,
      quote,
      pageStart,
      pageEnd,
      chapterId,
      highlightId: null,
      anchor: parseAnchor(value.anchor, pageStart, pageEnd),
    };
  }

  if (hasOwn(value, "anchor") && value.anchor !== null) {
    throw badRequest("anchor is only supported for passage notes.");
  }

  if (pageStart !== null && pageEnd !== null) {
    if (chapterId) {
      throw badRequest("A page note cannot include chapterId.");
    }

    if (pageStart !== pageEnd) {
      throw badRequest("A page note must refer to one page.");
    }

    return {
      type,
      context: "page",
      content,
      quote: null,
      pageStart,
      pageEnd,
      chapterId: null,
      highlightId: null,
      anchor: null,
    };
  }

  if (chapterId) {
    return {
      type,
      context: "chapter",
      content,
      quote: null,
      pageStart: null,
      pageEnd: null,
      chapterId,
      highlightId: null,
      anchor: null,
    };
  }

  return {
    type,
    context: "book",
    content,
    quote: null,
    pageStart: null,
    pageEnd: null,
    chapterId: null,
    highlightId: null,
    anchor: null,
  };
}

export function parseUpdateNoteDto(value: unknown): UpdateNoteDto {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  rejectUnknownFields(
    value,
    updateFields,
    "Request body contains unsupported note fields.",
  );

  return {
    content: parsePlainText(
      value.content,
      "content",
      MAX_NOTE_CONTENT_LENGTH,
    ),
  };
}

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}
