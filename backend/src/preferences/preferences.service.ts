import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import {
  DEFAULT_READER_PREFERENCES,
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
  READING_MOODS,
  READING_FONT_FAMILIES,
  type PdfFitMode,
  type ReaderMode,
  type ReaderPreferences,
  type ReaderPreferencesUpdate,
  type ReaderTheme,
  type ReadingMood,
  type ReadingFontFamily,
} from "./preferences.types";

const readerPreferenceSelect = {
  theme: true,
  readingMood: true,
  readerMode: true,
  pdfFitMode: true,
  pdfZoom: true,
  readerSidebarOpen: true,
  fontSize: true,
  fontFamily: true,
  lineHeight: true,
  readingContentWidth: true,
} as const;

type StoredReaderPreferences = {
  theme: string;
  readingMood: string;
  readerMode: string;
  pdfFitMode: string;
  pdfZoom: number;
  readerSidebarOpen: boolean;
  fontSize: number;
  fontFamily: string;
  lineHeight: Prisma.Decimal;
  readingContentWidth: number;
};

function normalizeReaderTheme(value: string): ReaderTheme {
  return READER_THEMES.includes(value as ReaderTheme)
    ? (value as ReaderTheme)
    : DEFAULT_READER_PREFERENCES.readerTheme;
}

function normalizeReadingMood(value: string): ReadingMood {
  return READING_MOODS.includes(value as ReadingMood)
    ? (value as ReadingMood)
    : DEFAULT_READER_PREFERENCES.readingMood;
}

function normalizePdfFitMode(value: string): PdfFitMode {
  return PDF_FIT_MODES.includes(value as PdfFitMode)
    ? (value as PdfFitMode)
    : DEFAULT_READER_PREFERENCES.pdfFitMode;
}

function normalizeReaderMode(value: string): ReaderMode {
  return READER_MODES.includes(value as ReaderMode)
    ? (value as ReaderMode)
    : DEFAULT_READER_PREFERENCES.readerMode;
}

function normalizePdfZoom(value: number): number {
  return Number.isInteger(value) && value >= MIN_PDF_ZOOM && value <= MAX_PDF_ZOOM
    ? value
    : DEFAULT_READER_PREFERENCES.pdfZoom;
}

function normalizeReadingFontSize(value: number): number {
  return Number.isInteger(value) &&
    value >= MIN_READING_FONT_SIZE &&
    value <= MAX_READING_FONT_SIZE
    ? value
    : DEFAULT_READER_PREFERENCES.readingFontSize;
}

function normalizeReadingFontFamily(value: string): ReadingFontFamily {
  return READING_FONT_FAMILIES.includes(value as ReadingFontFamily)
    ? (value as ReadingFontFamily)
    : DEFAULT_READER_PREFERENCES.readingFontFamily;
}

function normalizeReadingLineHeight(value: Prisma.Decimal): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) &&
    numericValue >= MIN_READING_LINE_HEIGHT &&
    numericValue <= MAX_READING_LINE_HEIGHT
    ? numericValue
    : DEFAULT_READER_PREFERENCES.readingLineHeight;
}

function normalizeReadingContentWidth(value: number): number {
  return Number.isInteger(value) &&
    value >= MIN_READING_CONTENT_WIDTH &&
    value <= MAX_READING_CONTENT_WIDTH
    ? value
    : DEFAULT_READER_PREFERENCES.readingContentWidth;
}

function serializeReaderPreferences(value: StoredReaderPreferences): ReaderPreferences {
  return {
    readerTheme: normalizeReaderTheme(value.theme),
    readingMood: normalizeReadingMood(value.readingMood),
    readerMode: normalizeReaderMode(value.readerMode),
    pdfFitMode: normalizePdfFitMode(value.pdfFitMode),
    pdfZoom: normalizePdfZoom(value.pdfZoom),
    readerSidebarOpen: value.readerSidebarOpen,
    readingFontSize: normalizeReadingFontSize(value.fontSize),
    readingFontFamily: normalizeReadingFontFamily(value.fontFamily),
    readingLineHeight: normalizeReadingLineHeight(value.lineHeight),
    readingContentWidth: normalizeReadingContentWidth(value.readingContentWidth),
  };
}

export async function getReaderPreferences(userId: string): Promise<ReaderPreferences> {
  const preferences = await prisma.userPreference.findUnique({
    where: { userId },
    select: readerPreferenceSelect,
  });

  return preferences
    ? serializeReaderPreferences(preferences)
    : { ...DEFAULT_READER_PREFERENCES };
}

export async function updateReaderPreferences(
  userId: string,
  update: ReaderPreferencesUpdate,
): Promise<ReaderPreferences> {
  const data = {
    ...(update.readerTheme === undefined ? {} : { theme: update.readerTheme }),
    ...(update.readingMood === undefined ? {} : { readingMood: update.readingMood }),
    ...(update.readerMode === undefined ? {} : { readerMode: update.readerMode }),
    ...(update.pdfFitMode === undefined ? {} : { pdfFitMode: update.pdfFitMode }),
    ...(update.pdfZoom === undefined ? {} : { pdfZoom: update.pdfZoom }),
    ...(update.readerSidebarOpen === undefined
      ? {}
      : { readerSidebarOpen: update.readerSidebarOpen }),
    ...(update.readingFontSize === undefined ? {} : { fontSize: update.readingFontSize }),
    ...(update.readingFontFamily === undefined
      ? {}
      : { fontFamily: update.readingFontFamily }),
    ...(update.readingLineHeight === undefined ? {} : { lineHeight: update.readingLineHeight }),
    ...(update.readingContentWidth === undefined
      ? {}
      : { readingContentWidth: update.readingContentWidth }),
  };

  const preferences = await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
    select: readerPreferenceSelect,
  });

  return serializeReaderPreferences(preferences);
}
