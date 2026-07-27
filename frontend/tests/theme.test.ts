import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyTheme,
  getDefaultHighlightColor,
  getHighlightColorForeground,
  getHighlightColorValue,
  getPdfHighlightColorValue,
  getThemeHighlightColors,
  isHighlightColorId,
  themes,
  type ThemeId,
} from '../src/theme.ts'

const expectedPalettes = {
  'printed-ink': [
    'rgba(214, 177, 106, 0.82)',
    'rgba(145, 181, 139, 0.80)',
    'rgba(135, 174, 196, 0.78)',
  ],
  'warm-paper': [
    'rgba(205, 148, 64, 0.68)',
    'rgba(116, 164, 105, 0.64)',
    'rgba(190, 111, 105, 0.62)',
  ],
  'night-study': [
    'rgba(117, 83, 32, 0.82)',
    'rgba(34, 91, 84, 0.82)',
    'rgba(91, 51, 79, 0.82)',
  ],
} satisfies Record<ThemeId, readonly string[]>
const themeSurfaces = {
  'printed-ink': '#071019',
  'warm-paper': '#f4ebdd',
  'night-study': '#111111',
} satisfies Record<ThemeId, string>

function readHexColor(value: string): [number, number, number] {
  return [1, 3, 5].map((index) =>
    Number.parseInt(value.slice(index, index + 2), 16),
  ) as [number, number, number]
}

function readRgbaColor(value: string): [number, number, number, number] {
  const channels = value.match(/[\d.]+/g)?.map(Number)

  assert.equal(channels?.length, 4)
  return channels as [number, number, number, number]
}

function relativeLuminance(color: readonly number[]): number {
  const [red, green, blue] = color.map((channel) => {
    const normalized = channel / 255

    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(
  foreground: readonly number[],
  background: readonly number[],
): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

test('each reading theme exposes exactly three ordered highlight colors', () => {
  for (const theme of themes) {
    const colors = getThemeHighlightColors(theme.id)

    assert.equal(colors.length, 3)
    assert.deepEqual(
      colors.map((color) => color.value),
      expectedPalettes[theme.id],
    )
    assert.equal(getDefaultHighlightColor(theme.id), colors[0].id)
  }
})

test('theme highlight identifiers are unique and recognized', () => {
  const ids = themes.flatMap((theme) =>
    theme.highlightColors.map((color) => color.id),
  )

  assert.equal(new Set(ids).size, 9)
  ids.forEach((id) => assert.equal(isHighlightColorId(id), true))
  assert.equal(isHighlightColorId('printed-ink-4'), false)
  assert.equal(isHighlightColorId('rgba(1, 2, 3, 0.5)'), false)
})

test('new highlight text maintains accessible contrast on every reading surface', () => {
  for (const theme of themes) {
    const surface = readHexColor(themeSurfaces[theme.id])

    for (const color of theme.highlightColors) {
      const [red, green, blue, alpha] = readRgbaColor(color.value)
      const composite = [red, green, blue].map((channel, index) =>
        Math.round(channel * alpha + surface[index] * (1 - alpha)),
      )
      const foreground = readHexColor(getHighlightColorForeground(color.id))

      assert.ok(
        contrastRatio(foreground, composite) >= 4.5,
        `${color.id} does not meet a 4.5:1 contrast ratio`,
      )
    }
  }
})

test('PDF highlights preserve hue while using a softer background alpha', () => {
  for (const theme of themes) {
    for (const color of theme.highlightColors) {
      const [red, green, blue, alpha] = readRgbaColor(color.value)
      const [pdfRed, pdfGreen, pdfBlue, pdfAlpha] = readRgbaColor(
        getPdfHighlightColorValue(color.id),
      )

      assert.deepEqual([pdfRed, pdfGreen, pdfBlue], [red, green, blue])
      assert.equal(pdfAlpha, Math.round(alpha * 0.45 * 1_000) / 1_000)
      assert.ok(pdfAlpha < alpha)
    }
  }
})

test('saved theme color tokens resolve independently of the active palette', () => {
  const savedColor = getDefaultHighlightColor('printed-ink')
  const storedValue = getHighlightColorValue(savedColor)

  getThemeHighlightColors('warm-paper')
  getThemeHighlightColors('night-study')

  assert.equal(storedValue, 'rgba(214, 177, 106, 0.82)')
  assert.equal(getHighlightColorValue(savedColor), storedValue)
})

test('applying a theme immediately updates selection CSS variables', () => {
  const properties = new Map<string, string>()
  const storage = new Map<string, string>()
  const documentStub = {
    documentElement: {
      dataset: {} as Record<string, string>,
      style: {
        setProperty(name: string, value: string) {
          properties.set(name, value)
        },
      },
    },
  }
  const windowStub = {
    localStorage: {
      setItem(name: string, value: string) {
        storage.set(name, value)
      },
    },
  }

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: documentStub,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: windowStub,
  })

  try {
    applyTheme('night-study')

    assert.equal(documentStub.documentElement.dataset.theme, 'night-study')
    assert.equal(properties.get('--sophia-highlight-1'), expectedPalettes['night-study'][0])
    assert.equal(properties.get('--sophia-highlight-2'), expectedPalettes['night-study'][1])
    assert.equal(properties.get('--sophia-highlight-3'), expectedPalettes['night-study'][2])
    assert.equal(
      properties.get('--sophia-pdf-highlight-1'),
      getPdfHighlightColorValue('night-study-v2-1'),
    )
    assert.equal(properties.get('--sophia-selection-text'), '#fffaf2')
    assert.equal(storage.get('sophia-theme'), 'night-study')
  } finally {
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'window')
  }
})

test('legacy saved highlight tokens keep their previous colors', () => {
  assert.equal(
    getHighlightColorValue('printed-ink-1'),
    'rgba(214, 177, 106, 0.52)',
  )
  assert.equal(
    getHighlightColorValue('warm-paper-2'),
    'rgba(159, 195, 148, 0.50)',
  )
  assert.equal(
    getHighlightColorValue('night-study-3'),
    'rgba(170, 120, 154, 0.32)',
  )
  assert.equal(getHighlightColorValue('gold'), 'rgba(245, 190, 61, 0.34)')
  assert.equal(getHighlightColorValue('blue'), 'rgba(56, 189, 248, 0.28)')
  assert.equal(getHighlightColorValue('green'), 'rgba(52, 211, 153, 0.28)')
  assert.equal(getHighlightColorValue('rose'), 'rgba(251, 113, 133, 0.28)')
})
