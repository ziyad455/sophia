export const themes = [
  {
    id: 'printed-ink',
    label: 'Printed Ink',
    highlightColors: [
      {
        id: 'printed-ink-v2-1',
        label: 'Printed Ink color 1',
        value: 'rgba(214, 177, 106, 0.82)',
        foreground: '#071019',
      },
      {
        id: 'printed-ink-v2-2',
        label: 'Printed Ink color 2',
        value: 'rgba(145, 181, 139, 0.80)',
        foreground: '#071019',
      },
      {
        id: 'printed-ink-v2-3',
        label: 'Printed Ink color 3',
        value: 'rgba(135, 174, 196, 0.78)',
        foreground: '#071019',
      },
    ],
  },
  {
    id: 'warm-paper',
    label: 'Warm Paper',
    highlightColors: [
      {
        id: 'warm-paper-v2-1',
        label: 'Warm Paper color 1',
        value: 'rgba(205, 148, 64, 0.68)',
        foreground: '#2b2118',
      },
      {
        id: 'warm-paper-v2-2',
        label: 'Warm Paper color 2',
        value: 'rgba(116, 164, 105, 0.64)',
        foreground: '#2b2118',
      },
      {
        id: 'warm-paper-v2-3',
        label: 'Warm Paper color 3',
        value: 'rgba(190, 111, 105, 0.62)',
        foreground: '#2b2118',
      },
    ],
  },
  {
    id: 'night-study',
    label: 'Night Study',
    highlightColors: [
      {
        id: 'night-study-v2-1',
        label: 'Night Study color 1',
        value: 'rgba(117, 83, 32, 0.82)',
        foreground: '#fffaf2',
      },
      {
        id: 'night-study-v2-2',
        label: 'Night Study color 2',
        value: 'rgba(34, 91, 84, 0.82)',
        foreground: '#fffaf2',
      },
      {
        id: 'night-study-v2-3',
        label: 'Night Study color 3',
        value: 'rgba(91, 51, 79, 0.82)',
        foreground: '#fffaf2',
      },
    ],
  },
] as const

const legacyHighlightColors = [
  {
    id: 'printed-ink-1',
    label: 'Printed Ink color 1',
    value: 'rgba(214, 177, 106, 0.52)',
    foreground: 'inherit',
  },
  {
    id: 'printed-ink-2',
    label: 'Printed Ink color 2',
    value: 'rgba(145, 181, 139, 0.50)',
    foreground: 'inherit',
  },
  {
    id: 'printed-ink-3',
    label: 'Printed Ink color 3',
    value: 'rgba(135, 174, 196, 0.48)',
    foreground: 'inherit',
  },
  {
    id: 'warm-paper-1',
    label: 'Warm Paper color 1',
    value: 'rgba(230, 181, 102, 0.52)',
    foreground: 'inherit',
  },
  {
    id: 'warm-paper-2',
    label: 'Warm Paper color 2',
    value: 'rgba(159, 195, 148, 0.50)',
    foreground: 'inherit',
  },
  {
    id: 'warm-paper-3',
    label: 'Warm Paper color 3',
    value: 'rgba(214, 151, 145, 0.46)',
    foreground: 'inherit',
  },
  {
    id: 'night-study-1',
    label: 'Night Study color 1',
    value: 'rgba(215, 173, 96, 0.32)',
    foreground: 'inherit',
  },
  {
    id: 'night-study-2',
    label: 'Night Study color 2',
    value: 'rgba(88, 166, 155, 0.30)',
    foreground: 'inherit',
  },
  {
    id: 'night-study-3',
    label: 'Night Study color 3',
    value: 'rgba(170, 120, 154, 0.32)',
    foreground: 'inherit',
  },
  {
    id: 'gold',
    label: 'Gold',
    value: 'rgba(245, 190, 61, 0.34)',
    foreground: 'inherit',
  },
  {
    id: 'blue',
    label: 'Blue',
    value: 'rgba(56, 189, 248, 0.28)',
    foreground: 'inherit',
  },
  {
    id: 'green',
    label: 'Green',
    value: 'rgba(52, 211, 153, 0.28)',
    foreground: 'inherit',
  },
  {
    id: 'rose',
    label: 'Rose',
    value: 'rgba(251, 113, 133, 0.28)',
    foreground: 'inherit',
  },
] as const

export type ThemeId = (typeof themes)[number]['id']
export type ThemeHighlightColor = (typeof themes)[number]['highlightColors'][number]
export type ThemeHighlightColorId = ThemeHighlightColor['id']
export type LegacyHighlightColorId = (typeof legacyHighlightColors)[number]['id']
export type HighlightColorId = ThemeHighlightColorId | LegacyHighlightColorId
type ThemeDefinition = (typeof themes)[number]
type LegacyHighlightColor = (typeof legacyHighlightColors)[number]
type HighlightColorDefinition = ThemeHighlightColor | LegacyHighlightColor

const themeById = new Map<ThemeId, ThemeDefinition>()

themes.forEach((theme) => themeById.set(theme.id, theme))

const themeHighlightColors = themes.reduce<ThemeHighlightColor[]>(
  (colors, theme) => {
    colors.push(...theme.highlightColors)
    return colors
  },
  [],
)
const allHighlightColors: HighlightColorDefinition[] = [
  ...themeHighlightColors,
  ...legacyHighlightColors,
]
const highlightColorById = new Map<HighlightColorId, HighlightColorDefinition>()

allHighlightColors.forEach((color) => highlightColorById.set(color.id, color))

export const HIGHLIGHT_COLOR_IDS: readonly HighlightColorId[] =
  allHighlightColors.map((color) => color.id)

const DEFAULT_THEME: ThemeId = 'printed-ink'
const THEME_STORAGE_KEY = 'sophia-theme'
const PDF_HIGHLIGHT_ALPHA_SCALE = 0.45
const rgbaPattern =
  /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/

function scaleRgbaAlpha(value: string, scale: number): string {
  const match = rgbaPattern.exec(value)

  if (!match) {
    return value
  }

  const alpha = Math.round(Number(match[4]) * scale * 1_000) / 1_000

  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`
}

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((themeOption) => themeOption.id === value)
}

export function readStoredTheme(): ThemeId {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  return isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME
}

export function getThemeHighlightColors(theme: ThemeId): readonly ThemeHighlightColor[] {
  return themeById.get(theme)?.highlightColors ?? themes[0].highlightColors
}

export function getDefaultHighlightColor(theme: ThemeId): ThemeHighlightColorId {
  return getThemeHighlightColors(theme)[0].id
}

export function isHighlightColorId(value: unknown): value is HighlightColorId {
  return typeof value === 'string' && highlightColorById.has(value as HighlightColorId)
}

export function getHighlightColorValue(color: HighlightColorId): string {
  return highlightColorById.get(color)?.value ?? legacyHighlightColors[0].value
}

export function getPdfHighlightColorValue(color: HighlightColorId): string {
  return scaleRgbaAlpha(getHighlightColorValue(color), PDF_HIGHLIGHT_ALPHA_SCALE)
}

export function getHighlightColorForeground(color: HighlightColorId): string {
  return highlightColorById.get(color)?.foreground ?? 'inherit'
}

export function getHighlightColorLabel(color: HighlightColorId): string {
  return highlightColorById.get(color)?.label ?? legacyHighlightColors[0].label
}

export function applyTheme(theme: ThemeId) {
  const root = document.documentElement
  const definition = themeById.get(theme) ?? themes[0]

  root.dataset.theme = theme
  definition.highlightColors.forEach((color, index) => {
    root.style.setProperty(`--sophia-highlight-${index + 1}`, color.value)
    root.style.setProperty(
      `--sophia-pdf-highlight-${index + 1}`,
      getPdfHighlightColorValue(color.id),
    )
  })
  root.style.setProperty(
    '--sophia-selection-text',
    definition.highlightColors[0].foreground,
  )
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export function applyStoredTheme() {
  applyTheme(readStoredTheme())
}
