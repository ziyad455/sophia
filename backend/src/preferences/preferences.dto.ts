import { badRequest } from "../http/errors";
import {
  MAX_PDF_ZOOM,
  MAX_READING_CONTENT_WIDTH,
  MAX_READING_FONT_SIZE,
  MAX_READING_LINE_HEIGHT,
  MIN_PDF_ZOOM,
  MIN_READING_CONTENT_WIDTH,
  MIN_READING_FONT_SIZE,
  MIN_READING_LINE_HEIGHT,
  PDF_FIT_MODES,
  READER_MODES,
  READER_THEMES,
  READING_FONT_FAMILIES,
  type PdfFitMode,
  type ReaderMode,
  type ReaderPreferencesUpdate,
  type ReaderTheme,
  type ReadingFontFamily,
} from "./preferences.types";

const editableFields = new Set([
  "readerTheme",
  "readerMode",
  "pdfFitMode",
  "pdfZoom",
  "readerSidebarOpen",
  "readingFontSize",
  "readingFontFamily",
  "readingLineHeight",
  "readingContentWidth",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function parseReaderTheme(value: unknown): ReaderTheme {
  if (typeof value !== "string" || !READER_THEMES.includes(value as ReaderTheme)) {
    throw badRequest("readerTheme must be system, light, or dark.");
  }

  return value as ReaderTheme;
}

function parsePdfFitMode(value: unknown): PdfFitMode {
  if (typeof value !== "string" || !PDF_FIT_MODES.includes(value as PdfFitMode)) {
    throw badRequest("pdfFitMode must be fit-width, fit-page, or custom.");
  }

  return value as PdfFitMode;
}

function parseReaderMode(value: unknown): ReaderMode {
  if (typeof value !== "string" || !READER_MODES.includes(value as ReaderMode)) {
    throw badRequest("readerMode must be pdf or reading.");
  }

  return value as ReaderMode;
}

function parsePdfZoom(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < MIN_PDF_ZOOM ||
    value > MAX_PDF_ZOOM
  ) {
    throw badRequest(`pdfZoom must be an integer from ${MIN_PDF_ZOOM} to ${MAX_PDF_ZOOM}.`);
  }

  return value;
}

function parseReaderSidebarOpen(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw badRequest("readerSidebarOpen must be a boolean.");
  }

  return value;
}

function parseReadingFontSize(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_READING_FONT_SIZE ||
    value > MAX_READING_FONT_SIZE
  ) {
    throw badRequest(
      `readingFontSize must be an integer from ${MIN_READING_FONT_SIZE} to ${MAX_READING_FONT_SIZE}.`,
    );
  }

  return value;
}

function parseReadingFontFamily(value: unknown): ReadingFontFamily {
  if (
    typeof value !== "string" ||
    !READING_FONT_FAMILIES.includes(value as ReadingFontFamily)
  ) {
    throw badRequest("readingFontFamily must be serif or sans.");
  }

  return value as ReadingFontFamily;
}

function parseReadingLineHeight(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < MIN_READING_LINE_HEIGHT ||
    value > MAX_READING_LINE_HEIGHT
  ) {
    throw badRequest(
      `readingLineHeight must be from ${MIN_READING_LINE_HEIGHT} to ${MAX_READING_LINE_HEIGHT}.`,
    );
  }

  return Math.round(value * 10) / 10;
}

function parseReadingContentWidth(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_READING_CONTENT_WIDTH ||
    value > MAX_READING_CONTENT_WIDTH
  ) {
    throw badRequest(
      `readingContentWidth must be an integer from ${MIN_READING_CONTENT_WIDTH} to ${MAX_READING_CONTENT_WIDTH}.`,
    );
  }

  return value;
}

export function parseReaderPreferencesUpdate(value: unknown): ReaderPreferencesUpdate {
  if (!isRecord(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  const unknownFields = Object.keys(value).filter((key) => !editableFields.has(key));

  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported reader preference fields.", {
      fields: unknownFields,
    });
  }

  const update: ReaderPreferencesUpdate = {};

  if (hasOwn(value, "readerTheme")) {
    update.readerTheme = parseReaderTheme(value.readerTheme);
  }

  if (hasOwn(value, "readerMode")) {
    update.readerMode = parseReaderMode(value.readerMode);
  }

  if (hasOwn(value, "pdfFitMode")) {
    update.pdfFitMode = parsePdfFitMode(value.pdfFitMode);
  }

  if (hasOwn(value, "pdfZoom")) {
    update.pdfZoom = parsePdfZoom(value.pdfZoom);
  }

  if (hasOwn(value, "readerSidebarOpen")) {
    update.readerSidebarOpen = parseReaderSidebarOpen(value.readerSidebarOpen);
  }

  if (hasOwn(value, "readingFontSize")) {
    update.readingFontSize = parseReadingFontSize(value.readingFontSize);
  }

  if (hasOwn(value, "readingFontFamily")) {
    update.readingFontFamily = parseReadingFontFamily(value.readingFontFamily);
  }

  if (hasOwn(value, "readingLineHeight")) {
    update.readingLineHeight = parseReadingLineHeight(value.readingLineHeight);
  }

  if (hasOwn(value, "readingContentWidth")) {
    update.readingContentWidth = parseReadingContentWidth(value.readingContentWidth);
  }

  if (Object.keys(update).length === 0) {
    throw badRequest("At least one reader preference field is required.");
  }

  return update;
}
