export const READER_THEMES = ["system", "light", "dark"] as const;
export const READING_MOODS = ["printed-ink", "warm-paper", "night-study"] as const;
export const READER_MODES = ["pdf", "reading"] as const;
export const PDF_FIT_MODES = ["fit-width", "fit-page", "custom"] as const;
export const READING_FONT_FAMILIES = ["serif", "sans"] as const;
export const MIN_PDF_ZOOM = 50;
export const MAX_PDF_ZOOM = 200;
export const MIN_READING_FONT_SIZE = 16;
export const MAX_READING_FONT_SIZE = 24;
export const MIN_READING_LINE_HEIGHT = 1.5;
export const MAX_READING_LINE_HEIGHT = 1.9;
export const MIN_READING_CONTENT_WIDTH = 640;
export const MAX_READING_CONTENT_WIDTH = 800;

export type ReaderTheme = (typeof READER_THEMES)[number];
export type ReadingMood = (typeof READING_MOODS)[number];
export type ReaderMode = (typeof READER_MODES)[number];
export type PdfFitMode = (typeof PDF_FIT_MODES)[number];
export type ReadingFontFamily = (typeof READING_FONT_FAMILIES)[number];

export type ReaderPreferences = {
  readerTheme: ReaderTheme;
  readingMood: ReadingMood;
  readerMode: ReaderMode;
  pdfFitMode: PdfFitMode;
  pdfZoom: number;
  readerSidebarOpen: boolean;
  readingFontSize: number;
  readingFontFamily: ReadingFontFamily;
  readingLineHeight: number;
  readingContentWidth: number;
};

export type ReaderPreferencesUpdate = Partial<ReaderPreferences>;

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  readerTheme: "system",
  readingMood: "warm-paper",
  readerMode: "pdf",
  pdfFitMode: "fit-width",
  pdfZoom: 100,
  readerSidebarOpen: false,
  readingFontSize: 18,
  readingFontFamily: "serif",
  readingLineHeight: 1.6,
  readingContentWidth: 720,
};
