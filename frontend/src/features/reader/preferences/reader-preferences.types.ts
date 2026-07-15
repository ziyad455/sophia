export type ReaderTheme = 'system' | 'light' | 'dark'
export type PdfFitMode = 'fit-width' | 'fit-page' | 'custom'

export type ReaderPreferences = {
  readerTheme: ReaderTheme
  pdfFitMode: PdfFitMode
  pdfZoom: number
  readerSidebarOpen: boolean
}

export type ReaderPreferencesUpdate = Partial<ReaderPreferences>

export type ReaderPreferencesResponse = {
  preferences: ReaderPreferences
}
