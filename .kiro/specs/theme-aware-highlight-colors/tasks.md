# Implementation Plan

- [-] 1. Add theme highlight color definitions to the theme system
  - Add `THEME_HIGHLIGHT_COLORS` constant to `frontend/src/theme.ts` with the exact RGBA tuples for all three moods
  - Add `ReadingMood` import/type to `theme.ts` so the lookup table is typed correctly
  - Add `applySelectionColor(mood: ReadingMood): void` function to `theme.ts` that injects/updates a `<style id="sophia-selection-style">` tag in `<head>` with `::selection` and `::-moz-selection` rules using the first highlight color
  - Update `applyTheme(mood)` to call `applySelectionColor` so every theme change updates the selection color
  - Add `--sophia-highlight-1`, `--sophia-highlight-2`, `--sophia-highlight-3` CSS custom properties to each `.reader-mood-*` block in `frontend/src/index.css`
  - Add static `::selection` / `::-moz-selection` rules per `[data-theme="*"]` selector in `index.css` as a CSS-only fallback
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ] 1.1 Write property tests for theme color tuple completeness and selection color correctness
  - Install `fast-check` as a dev-dependency in `frontend/`
  - Create `frontend/src/theme.test.ts`
  - **Property 1: Theme highlight color tuple is complete** — `fc.constantFrom(...moods)` → tuple length 3 and all entries non-empty strings
  - **Property 6: Selection color equals first highlight color** — `fc.constantFrom(...moods)` → `resolveHighlightColor('highlight-1', mood)` equals `THEME_HIGHLIGHT_COLORS[mood][0]`
  - Tag each test: `// Feature: theme-aware-highlight-colors, Property N: <text>`
  - **Validates: Requirements 1.1, 2.1**

- [ ] 2. Migrate the HighlightColor type and add color resolution utilities
  - In `frontend/src/features/reader/highlights/highlight.types.ts`, replace `HIGHLIGHT_COLORS = ['gold','blue','green','rose']` with `['highlight-1','highlight-2','highlight-3']` and update the `HighlightColor` type
  - In `frontend/src/features/reader/highlights/highlight.utils.ts`, add `resolveHighlightColor(color: HighlightColor, mood: ReadingMood): string` that returns `THEME_HIGHLIGHT_COLORS[mood][index]` where index is derived from the color identifier
  - Add `migrateHighlightColor(legacy: string): HighlightColor` to `highlight.utils.ts` with the mapping `gold→highlight-1`, `green→highlight-2`, `blue→highlight-3`, `rose→highlight-1`; unknown strings fall back to `highlight-1`
  - Remove the now-unused `highlightMarkClass` and `highlightOverlayColor` static maps from `highlight.utils.ts`
  - Export the new functions from `frontend/src/features/reader/highlights/index.ts`
  - _Requirements: 3.1, 3.3, 3.4, 7.1_

- [ ] 2.1 Write property tests for migrateHighlightColor and resolveHighlightColor
  - Create `frontend/src/features/reader/highlights/highlight.utils.test.ts`
  - **Property 3: migrateHighlightColor maps any string to a valid identifier** — `fc.string()` → result is member of `HIGHLIGHT_COLORS`
  - **Property 4: migrateHighlightColor is idempotent** — `fc.constantFrom('highlight-1','highlight-2','highlight-3')` → `migrate(migrate(c)) === migrate(c)`
  - **Property 2: resolveHighlightColor returns the correct RGBA for any (color, mood) pair** — `fc.tuple(fc.constantFrom(...HIGHLIGHT_COLORS), fc.constantFrom(...moods))` → result matches `THEME_HIGHLIGHT_COLORS[mood][index]`
  - **Validates: Requirements 3.4, 7.1**

- [ ] 2.2 Write unit tests for legacy color edge cases
  - In `highlight.utils.test.ts`, add concrete assertions:
  - **Property 5: gold and rose both map to highlight-1** — `migrateHighlightColor('gold') === 'highlight-1'` and `migrateHighlightColor('rose') === 'highlight-1'`
  - Assert `migrateHighlightColor('blue') === 'highlight-3'` and `migrateHighlightColor('green') === 'highlight-2'`
  - **Validates: Requirements 7.1**

- [ ] 3. Migrate the backend HighlightColor type and DTO validation
  - In `backend/src/highlights/highlights.types.ts`, update `HIGHLIGHT_COLORS` to `['highlight-1','highlight-2','highlight-3']`
  - In `backend/src/highlights/highlights.dto.ts`, add legacy-name normalization before validation: if `color` is one of `gold/green/blue/rose`, map it to the positional identifier; then validate against the new set
  - Update the error message in `parseCreateHighlightDto` to list the new accepted values
  - _Requirements: 3.2, 7.1, 7.2_

- [ ] 3.1 Update backend DTO tests for new color identifiers
  - In `backend/src/highlights/highlights.dto.test.ts`, replace `color: 'gold'` with `color: 'highlight-1'` in `validReadingHighlight()`
  - Add test: all three new identifiers are accepted
  - Add test: all four legacy names are accepted and normalized
  - Add test: unknown strings are still rejected with 400
  - **Validates: Requirements 3.2, 7.2**

- [ ] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add database migration for existing highlight color values
  - Create a new Prisma migration file under `backend/prisma/migrations/` that runs the SQL UPDATE mapping `gold→highlight-1`, `green→highlight-2`, `blue→highlight-3`, `rose→highlight-1` for all rows in the `Highlight` table
  - Run `npx prisma migrate dev --name migrate_highlight_colors` locally to generate and apply the migration
  - _Requirements: 7.3_

- [ ] 6. Update highlight rendering components to use theme-aware colors
  - Update `PdfHighlightsOverlay.tsx` to accept `activeMood: ReadingMood` prop and call `resolveHighlightColor(highlight.color, activeMood)` instead of `highlightOverlayColor[highlight.color]`; do the same for the preview rect
  - Update `ReadingHighlightRenderer.tsx` to accept `activeMood: ReadingMood` prop and call `resolveHighlightColor` instead of `highlightMarkClass`; use inline `style` with `backgroundColor` instead of a Tailwind class
  - Update `ReaderPage.tsx` to pass `activeMood={preferences.readingMood}` to both `PdfHighlightsOverlay` (via `renderPdfHighlights` callback) and to `ReflowedReadingMode` / `ReadingHighlightRenderer`
  - _Requirements: 5.2, 5.3, 6.2_

- [ ] 7. Update the selection toolbar color picker to show theme-aware swatches
  - Add `activeMood: ReadingMood` prop to `ReaderSelectionToolbar`
  - Replace the `HIGHLIGHT_COLORS.map(...)` swatch rendering with iteration over `HIGHLIGHT_COLORS` and use `THEME_HIGHLIGHT_COLORS[activeMood][index]` as the inline `backgroundColor` of the swatch span
  - Remove the `option === 'gold' ? 'bg-amber-300' : ...` Tailwind class branches
  - Change the default `previewColor` initialization in `ReaderPage.tsx` from `'gold'` to `'highlight-1'`; update all `setPreviewColor('gold')` call sites to use `'highlight-1'`
  - Pass `activeMood={preferences.readingMood}` to `ReaderSelectionToolbar` in `ReaderPage.tsx`
  - _Requirements: 4.1, 4.2, 4.4, 5.1_

- [ ] 7.1 Write property test for color picker swatch count and values
  - In `highlight.utils.test.ts` or a dedicated toolbar test file, add:
  - **Property 7: Color picker shows exactly three swatches matching the active theme** — `fc.constantFrom(...moods)` → map `HIGHLIGHT_COLORS` to `THEME_HIGHLIGHT_COLORS[mood]` and assert length 3, each entry matches the tuple
  - **Validates: Requirements 4.1**

- [ ] 8. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.
