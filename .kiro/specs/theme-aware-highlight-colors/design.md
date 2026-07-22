# Design Document — Theme-Aware Highlight Colors

## Overview

Sophia's three reading moods (Printed Ink, Warm Paper, Night Study) each carry a curated atmosphere. This feature extends that atmosphere to highlight colors and native text selection by replacing the fixed four-color semantic palette (`gold`, `blue`, `green`, `rose`) with three RGBA colors per theme. The first color of the active theme is applied to the browser's `::selection` pseudo-element site-wide, including inside the PDF text layer.

The change has three layers:
1. **Color definitions** — authoritative RGBA values added to the existing CSS theme classes in `index.css` and mirrored as a TypeScript lookup table in `theme.ts`.
2. **Type migration** — `HighlightColor` changes from semantic names to positional identifiers (`highlight-1 | highlight-2 | highlight-3`) on both frontend and backend, with backward-compat mapping for old values.
3. **Dynamic selection styling** — a small JavaScript function writes a `<style>` tag into `<head>` when the theme changes, overriding `::selection` / `::-moz-selection` globally and targeting the PDF text layer specifically.

No new packages are required. No PDF layout, zoom, or typography code is touched.

---

## Architecture

```
theme.ts
  THEME_HIGHLIGHT_COLORS: Record<ReadingMood, [string, string, string]>
  applyTheme(mood) → sets data-theme + updates ::selection <style> tag

index.css
  .reader-mood-printed-ink  { --sophia-highlight-1: …; --sophia-highlight-2: …; --sophia-highlight-3: … }
  .reader-mood-warm-paper   { … }
  .reader-mood-night-study  { … }
  [data-theme="printed-ink"] ::selection  { background: var(--sophia-selection-color); }
  …

highlight.types.ts  (frontend)
  HighlightColor = 'highlight-1' | 'highlight-2' | 'highlight-3'

highlights.types.ts (backend)
  HIGHLIGHT_COLORS = ['highlight-1', 'highlight-2', 'highlight-3']

highlight.utils.ts
  resolveHighlightColor(color: HighlightColor, mood: ReadingMood): string
  migrateHighlightColor(legacy: string): HighlightColor

ReaderSelectionToolbar.tsx
  reads active mood → maps to THEME_HIGHLIGHT_COLORS[mood] → renders 3 swatches

PdfHighlightsOverlay.tsx / ReadingHighlightRenderer.tsx
  calls resolveHighlightColor(highlight.color, activeMood)

DB migration
  UPDATE highlights SET color = <mapped> WHERE color IN ('gold','blue','green','rose')
```

---

## Components and Interfaces

### `theme.ts` additions

```ts
export const THEME_HIGHLIGHT_COLORS: Record<ReadingMood, readonly [string, string, string]> = {
  'printed-ink':  ['rgba(214, 177, 106, 0.52)', 'rgba(145, 181, 139, 0.50)', 'rgba(135, 174, 196, 0.48)'],
  'warm-paper':   ['rgba(230, 181, 102, 0.52)', 'rgba(159, 195, 148, 0.50)', 'rgba(214, 151, 145, 0.46)'],
  'night-study':  ['rgba(215, 173, 96, 0.32)',  'rgba(88, 166, 155, 0.30)',  'rgba(170, 120, 154, 0.32)'],
}

// Called inside applyTheme and on mount.
export function applySelectionColor(mood: ReadingMood): void { … }
```

`applyTheme` already exists and is the single call-site for theme changes. It will call `applySelectionColor` so no other file needs to know about the `<style>` tag.

### `index.css` additions

Three CSS variables are added to each `.reader-mood-*` class block and to the `:root[data-theme="*"]` blocks:

```css
.reader-mood-printed-ink {
  --sophia-highlight-1: rgba(214, 177, 106, 0.52);
  --sophia-highlight-2: rgba(145, 181, 139, 0.50);
  --sophia-highlight-3: rgba(135, 174, 196, 0.48);
  --sophia-selection-color: rgba(214, 177, 106, 0.52);
  /* existing vars unchanged */
}
```

Global `::selection` rules per theme use the CSS variable, so they work even when JS is slow:

```css
:root[data-theme="printed-ink"] ::selection       { background-color: rgba(214, 177, 106, 0.52); color: inherit; }
:root[data-theme="printed-ink"] ::-moz-selection  { background-color: rgba(214, 177, 106, 0.52); color: inherit; }
```

The JS-injected `<style>` tag (written by `applySelectionColor`) is for _immediate_ updates during React-driven theme switches, working alongside the CSS rules.

### `highlight.types.ts` (frontend)

```ts
export const HIGHLIGHT_COLORS = ['highlight-1', 'highlight-2', 'highlight-3'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]
```

### `highlight.utils.ts` additions

```ts
// Maps a HighlightColor to its RGBA value for the given mood.
export function resolveHighlightColor(color: HighlightColor, mood: ReadingMood): string

// Maps legacy color names to the new positional identifiers.
export function migrateHighlightColor(legacy: string): HighlightColor
```

Migration table: `gold → highlight-1`, `green → highlight-2`, `blue → highlight-3`, `rose → highlight-1`.

### `ReaderSelectionToolbar.tsx` changes

- Accepts `activeMood: ReadingMood` as a new prop (sourced from `useReaderPreferences` in `ReaderPage`).
- Iterates over `HIGHLIGHT_COLORS` (positions 1–3), looks up RGBA via `THEME_HIGHLIGHT_COLORS[activeMood][index]`, and renders an inline-styled swatch instead of a Tailwind color class.
- Default color on new selection remains `highlight-1`.

### `PdfHighlightsOverlay.tsx` and `ReadingHighlightRenderer.tsx` changes

- Both accept `activeMood: ReadingMood` as a prop.
- Replace the static `highlightOverlayColor` / `highlightMarkClass` lookups with `resolveHighlightColor(highlight.color, activeMood)`.

### Backend `highlights.types.ts` and `highlights.dto.ts` changes

- `HIGHLIGHT_COLORS` becomes `['highlight-1', 'highlight-2', 'highlight-3']` (plus legacy names during transition).
- `parseCreateHighlightDto` accepts both old and new names; normalises legacy → new before persisting.

### Database migration

A Prisma migration updates the `color` column:
```sql
UPDATE "Highlight"
SET color = CASE color
  WHEN 'gold'  THEN 'highlight-1'
  WHEN 'green' THEN 'highlight-2'
  WHEN 'blue'  THEN 'highlight-3'
  WHEN 'rose'  THEN 'highlight-1'
  ELSE color
END
WHERE color IN ('gold','green','blue','rose');
```

---

## Data Models

### `HighlightColor` (shared concept, frontend + backend)

| Old value | New value     | Visual position |
|-----------|---------------|-----------------|
| `gold`    | `highlight-1` | First swatch    |
| `green`   | `highlight-2` | Second swatch   |
| `blue`    | `highlight-3` | Third swatch    |
| `rose`    | `highlight-1` | (merged)        |

The `color` column in the `Highlight` table stores the string verbatim. After the DB migration it will only contain `highlight-1 | highlight-2 | highlight-3`.

### Theme color tuple

```ts
// Indexed 0, 1, 2 → positions highlight-1, highlight-2, highlight-3
type ThemeHighlightColors = readonly [string, string, string]
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Theme highlight color tuple is complete
*For any* valid `ReadingMood`, `THEME_HIGHLIGHT_COLORS[mood]` SHALL return a tuple of exactly three non-empty strings.
**Validates: Requirements 1.1**

Property 2: resolveHighlightColor round-trip coverage
*For any* valid `HighlightColor` and any valid `ReadingMood`, `resolveHighlightColor(color, mood)` SHALL return a non-empty string that is the RGBA value at the corresponding index in `THEME_HIGHLIGHT_COLORS[mood]`.
**Validates: Requirements 1.4, 3.4**

Property 3: migrateHighlightColor maps to valid new identifiers
*For any* string value (old or new color name), `migrateHighlightColor(value)` SHALL return a member of `HIGHLIGHT_COLORS` (`highlight-1 | highlight-2 | highlight-3`).
**Validates: Requirements 7.1, 3.3**

Property 4: migrateHighlightColor is idempotent
*For any* already-migrated color identifier `c` in `['highlight-1', 'highlight-2', 'highlight-3']`, `migrateHighlightColor(c)` SHALL equal `c`.
**Validates: Requirements 7.1**

Property 5: Legacy gold/rose both map to highlight-1
*For any* call `migrateHighlightColor('gold')` and `migrateHighlightColor('rose')`, both SHALL return `'highlight-1'`.
**Validates: Requirements 7.1**

Property 6: Selection color equals first highlight color
*For any* valid `ReadingMood`, the RGBA value returned by `resolveHighlightColor('highlight-1', mood)` SHALL equal `THEME_HIGHLIGHT_COLORS[mood][0]`.
**Validates: Requirements 2.1**

Property 7: Color picker shows exactly three swatches per theme
*For any* `ReadingMood`, the array of colors rendered in `ReaderSelectionToolbar` SHALL have length exactly 3 and each entry SHALL match `THEME_HIGHLIGHT_COLORS[mood][index]`.
**Validates: Requirements 4.1**

---

## Error Handling

- **Unknown legacy color at render time**: `resolveHighlightColor` falls back to `THEME_HIGHLIGHT_COLORS[mood][0]` (first color) if the stored value is not a recognized identifier, preventing blank highlights.
- **`applySelectionColor` called before DOM ready**: guarded by a `typeof document !== 'undefined'` check; the CSS-variable fallback in `index.css` covers SSR-like contexts.
- **Backend receives unrecognized color**: `parseCreateHighlightDto` throws a 400 Bad Request for any value not in the allowed set (after normalising legacy values).

---

## Testing Strategy

### Unit tests (backend — Node.js built-in `node:test`)

- `highlights.dto.test.ts`: extend existing tests to verify that all three new color identifiers are accepted, old identifiers are normalised, and unrecognized identifiers are rejected.
- New test: `migrateHighlightColor` mapping table correctness (all four old names, all three new names, unknown string).

### Property-based tests (frontend — fast-check)

No property-based testing library currently exists in the frontend. The design uses **fast-check** (industry-standard for TypeScript/JavaScript PBT), added as a dev-dependency.

Each property-based test is tagged with a comment in the format:
`// Feature: theme-aware-highlight-colors, Property N: <property text>`

Minimum 100 iterations per property test (`numRuns: 100`).

**Properties to test with fast-check:**

- Property 1 — `fc.constantFrom(...ReadingMood values)` → assert tuple length 3 and all strings non-empty.
- Property 2 — `fc.tuple(fc.constantFrom(...HIGHLIGHT_COLORS), fc.constantFrom(...ReadingMood))` → assert resolveHighlightColor returns matching THEME_HIGHLIGHT_COLORS entry.
- Property 3 — `fc.string()` → assert migrateHighlightColor always returns a HIGHLIGHT_COLORS member.
- Property 4 — `fc.constantFrom('highlight-1','highlight-2','highlight-3')` → assert idempotence.
- Property 5 — constant inputs `'gold'` and `'rose'` → both equal `'highlight-1'`.
- Property 6 — `fc.constantFrom(...ReadingMood)` → first color in tuple equals resolveHighlightColor('highlight-1', mood).
- Property 7 — `fc.constantFrom(...ReadingMood)` → toolbar color array length 3 and entries match tuple.

### Unit tests (frontend)

- `highlight.utils.test.ts`: concrete examples for `migrateHighlightColor` (gold→highlight-1, blue→highlight-3, green→highlight-2, rose→highlight-1) and for `resolveHighlightColor` using all three moods.
- `applySelectionColor`: verify the injected `<style>` tag's text content contains the correct RGBA for each mood.

### Integration / smoke

- Run the full backend `npm test` suite and confirm no regressions.
- TypeScript compilation (`tsc --noEmit`) must pass on both frontend and backend after the type migration.
