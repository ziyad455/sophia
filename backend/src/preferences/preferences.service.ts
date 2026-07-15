import { prisma } from "../db/prisma";
import {
  DEFAULT_READER_PREFERENCES,
  MAX_PDF_ZOOM,
  MIN_PDF_ZOOM,
  PDF_FIT_MODES,
  READER_THEMES,
  type PdfFitMode,
  type ReaderPreferences,
  type ReaderPreferencesUpdate,
  type ReaderTheme,
} from "./preferences.types";

const readerPreferenceSelect = {
  theme: true,
  pdfFitMode: true,
  pdfZoom: true,
  readerSidebarOpen: true,
} as const;

type StoredReaderPreferences = {
  theme: string;
  pdfFitMode: string;
  pdfZoom: number;
  readerSidebarOpen: boolean;
};

function normalizeReaderTheme(value: string): ReaderTheme {
  return READER_THEMES.includes(value as ReaderTheme)
    ? (value as ReaderTheme)
    : DEFAULT_READER_PREFERENCES.readerTheme;
}

function normalizePdfFitMode(value: string): PdfFitMode {
  return PDF_FIT_MODES.includes(value as PdfFitMode)
    ? (value as PdfFitMode)
    : DEFAULT_READER_PREFERENCES.pdfFitMode;
}

function normalizePdfZoom(value: number): number {
  return Number.isInteger(value) && value >= MIN_PDF_ZOOM && value <= MAX_PDF_ZOOM
    ? value
    : DEFAULT_READER_PREFERENCES.pdfZoom;
}

function serializeReaderPreferences(value: StoredReaderPreferences): ReaderPreferences {
  return {
    readerTheme: normalizeReaderTheme(value.theme),
    pdfFitMode: normalizePdfFitMode(value.pdfFitMode),
    pdfZoom: normalizePdfZoom(value.pdfZoom),
    readerSidebarOpen: value.readerSidebarOpen,
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
    ...(update.pdfFitMode === undefined ? {} : { pdfFitMode: update.pdfFitMode }),
    ...(update.pdfZoom === undefined ? {} : { pdfZoom: update.pdfZoom }),
    ...(update.readerSidebarOpen === undefined
      ? {}
      : { readerSidebarOpen: update.readerSidebarOpen }),
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
