import { badRequest } from "../http/errors";
import {
  MAX_PDF_ZOOM,
  MIN_PDF_ZOOM,
  PDF_FIT_MODES,
  READER_THEMES,
  type PdfFitMode,
  type ReaderPreferencesUpdate,
  type ReaderTheme,
} from "./preferences.types";

const editableFields = new Set([
  "readerTheme",
  "pdfFitMode",
  "pdfZoom",
  "readerSidebarOpen",
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

  if (hasOwn(value, "pdfFitMode")) {
    update.pdfFitMode = parsePdfFitMode(value.pdfFitMode);
  }

  if (hasOwn(value, "pdfZoom")) {
    update.pdfZoom = parsePdfZoom(value.pdfZoom);
  }

  if (hasOwn(value, "readerSidebarOpen")) {
    update.readerSidebarOpen = parseReaderSidebarOpen(value.readerSidebarOpen);
  }

  if (Object.keys(update).length === 0) {
    throw badRequest("At least one reader preference field is required.");
  }

  return update;
}
