export type ThemeId = 'printed-ink' | 'warm-paper' | 'night-study'

export const themes: Array<{ id: ThemeId; label: string }> = [
  { id: 'printed-ink', label: 'Printed Ink' },
  { id: 'warm-paper', label: 'Warm Paper' },
  { id: 'night-study', label: 'Night Study' },
]

const DEFAULT_THEME: ThemeId = 'printed-ink'
const THEME_STORAGE_KEY = 'sophia-theme'

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((themeOption) => themeOption.id === value)
}

export function readStoredTheme(): ThemeId {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  return isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME
}

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export function applyStoredTheme() {
  applyTheme(readStoredTheme())
}
