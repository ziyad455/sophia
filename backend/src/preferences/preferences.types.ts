export const READER_THEMES = ["system", "light", "dark"] as const;
export const PDF_FIT_MODES = ["fit-width", "fit-page", "custom"] as const;
export const MIN_PDF_ZOOM = 50;
export const MAX_PDF_ZOOM = 200;

export type ReaderTheme = (typeof READER_THEMES)[number];
export type PdfFitMode = (typeof PDF_FIT_MODES)[number];

export type ReaderPreferences = {
  readerTheme: ReaderTheme;
  pdfFitMode: PdfFitMode;
  pdfZoom: number;
  readerSidebarOpen: boolean;
};

export type ReaderPreferencesUpdate = Partial<ReaderPreferences>;

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  readerTheme: "system",
  pdfFitMode: "fit-width",
  pdfZoom: 100,
  readerSidebarOpen: false,
};
