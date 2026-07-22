# Requirements Document

## Introduction

Sophia has three reading themes — Printed Ink, Warm Paper, and Night Study — each reflecting a distinct mood for philosophical reading. Today, highlight colors are fixed semantic labels (gold, blue, green, rose) that do not respond to the active theme. Text selection uses the browser's default blue highlight, which clashes with Sophia's carefully designed atmosphere.

This feature replaces the fixed four-color system with three theme-scoped RGBA colors per theme, wires the first color of each theme to the browser's native `::selection` pseudo-element, and ensures the color picker in the selection toolbar always shows the three colors for the active theme in the correct order.

## Glossary

- **Reading Theme / Mood**: One of `printed-ink`, `warm-paper`, or `night-study`, stored as `readingMood` in `ReaderPreferences` and applied as a CSS class (`reader-mood-*`) and a `data-theme` attribute on `<html>`.
- **Theme Highlight Colors**: An ordered tuple of three RGBA color values associated with a reading theme, used for both the native text selection and for rendering highlight overlays.
- **Selection Color**: The background color applied by the browser to natively selected text, controlled via the `::selection` and `::-moz-selection` CSS pseudo-elements.
- **Highlight Preview**: A transient visual overlay shown on currently selected text when a user picks a color before confirming the highlight, backed by `HighlightPreview` in the frontend code.
- **Saved Highlight**: A `ReaderHighlight` record persisted to the database with an immutable `color` value.
- **Color Token / CSS Variable**: A CSS custom property declared on a theme-scoped selector (e.g., `.reader-mood-printed-ink`) that exposes a named color value for use by components.
- **PDF Text Layer**: The transparent HTML layer rendered on top of PDF pages by the `@embedpdf` viewer that allows text selection.
- **HighlightColor**: The discriminated union type used in both the frontend (`highlight.types.ts`) and backend (`highlights.types.ts`) to identify which color a highlight uses.
- **Color Picker**: The row of color swatches inside `ReaderSelectionToolbar` that lets the user choose a highlight color before saving.

---

## Requirements

### Requirement 1 — Theme Highlight Color Definitions

**User Story:** As a reader, I want each reading theme to have its own set of three coordinated highlight colors, so that highlights feel intentional and atmosphere-matched rather than jarring.

#### Acceptance Criteria

1. THE Theme System SHALL define exactly three ordered RGBA highlight colors for each of the three reading themes with the following values:
   - Printed Ink: `rgba(214, 177, 106, 0.52)`, `rgba(145, 181, 139, 0.50)`, `rgba(135, 174, 196, 0.48)`
   - Warm Paper: `rgba(230, 181, 102, 0.52)`, `rgba(159, 195, 148, 0.50)`, `rgba(214, 151, 145, 0.46)`
   - Night Study: `rgba(215, 173, 96, 0.32)`, `rgba(88, 166, 155, 0.30)`, `rgba(170, 120, 154, 0.32)`
2. THE Theme System SHALL expose each theme's three highlight colors as named CSS custom properties on the corresponding `reader-mood-*` class, using consistent variable names such as `--sophia-highlight-1`, `--sophia-highlight-2`, and `--sophia-highlight-3`.
3. THE Theme System SHALL store highlight color definitions in a single authoritative location in `theme.ts` or `index.css`, so that no component hard-codes RGBA values independently.

---

### Requirement 2 — Native Text Selection Color

**User Story:** As a reader, I want selected text anywhere in the application to use the first highlight color of the active theme, so that even casual text selection feels part of the reading atmosphere.

#### Acceptance Criteria

1. THE Application SHALL apply the first highlight color of the active reading theme as the `background-color` of `::selection` and `::-moz-selection` pseudo-elements.
2. WHEN the active reading theme changes, THE Application SHALL update the native text selection color immediately without requiring a page refresh.
3. THE Application SHALL apply the selection color inside the PDF text layer using targeted `::selection` rules, so that selecting text in the PDF viewer produces the same themed color as selecting text elsewhere.
4. THE Application SHALL set a legible foreground color on `::selection` (e.g., `color: inherit` or a dark/light contrast value per theme) so that selected text remains readable.

---

### Requirement 3 — Highlight Color Tokens in the HighlightColor Type

**User Story:** As a developer, I want the `HighlightColor` type to represent the three theme-position indices rather than semantic names, so that components can look up the actual RGBA value from the active theme without maintaining a parallel mapping.

#### Acceptance Criteria

1. THE Frontend SHALL replace the existing `HighlightColor` values (`gold`, `blue`, `green`, `rose`) with positional identifiers (`highlight-1`, `highlight-2`, `highlight-3`) in `highlight.types.ts`.
2. THE Backend SHALL accept only the new positional color identifiers when creating or retrieving highlights, replacing the old color enum in `highlights.types.ts` and `highlights.dto.ts`.
3. WHEN an existing saved highlight carries an old color name from before this migration, THE Application SHALL treat it as `highlight-1` to maintain visual continuity.
4. THE Frontend SHALL provide a lookup function that maps a `HighlightColor` and an active `ReadingMood` to the corresponding RGBA string using the authoritative definitions from Requirement 1.

---

### Requirement 4 — Color Picker in the Selection Toolbar

**User Story:** As a reader, I want the color picker to show exactly the three coordinated highlight colors for the current theme, so that I can choose a color that matches my reading mood.

#### Acceptance Criteria

1. WHEN the selection toolbar is displayed, THE Color Picker SHALL show exactly three color swatches in the order defined by the active reading theme.
2. WHEN a new text selection is made, THE Color Picker SHALL pre-select the first color (`highlight-1`) of the active theme.
3. WHEN the active reading theme changes while the toolbar is visible, THE Color Picker SHALL update the displayed swatches to show the new theme's colors immediately.
4. THE Color Picker swatches SHALL render using the RGBA values from the authoritative theme definitions, not from separate hard-coded Tailwind classes.

---

### Requirement 5 — Live Preview on Selected Text

**User Story:** As a reader, I want to see my chosen highlight color applied immediately to the selected text before I confirm, so that I can make an informed choice without committing.

#### Acceptance Criteria

1. WHEN a user selects a color in the color picker while text is selected, THE Highlight Preview SHALL update immediately to show the selected RGBA color on the selected passage.
2. WHEN the highlight preview is active in PDF mode, THE PDF Highlights Overlay SHALL render the preview rect using the chosen theme color's RGBA value.
3. WHEN the highlight preview is active in reading mode, THE Reading Highlight Renderer SHALL render the preview mark using the chosen theme color's RGBA value.

---

### Requirement 6 — Saved Highlight Color Persistence

**User Story:** As a reader, I want my saved highlights to display in the color I originally chose, regardless of what theme I switch to later, so that my reading record stays consistent.

#### Acceptance Criteria

1. WHEN a highlight is saved, THE Application SHALL store the `HighlightColor` positional identifier (e.g., `highlight-2`) and SHALL NOT alter it when the theme changes.
2. WHEN a saved highlight is rendered under a different theme, THE Application SHALL resolve the stored positional color identifier against the currently active theme's RGBA values to display the highlight.
3. WHEN the application reloads with a different active theme than when the highlight was created, THE Saved Highlights SHALL display using the position-mapped color for the new theme.

---

### Requirement 7 — Backward Compatibility and Migration

**User Story:** As a developer, I want existing highlights stored with old color names to continue rendering without data loss, so that no user loses access to their reading history.

#### Acceptance Criteria

1. WHEN the application encounters a saved highlight with an old color value (`gold`, `blue`, `green`, or `rose`), THE Application SHALL map the old value to a positional identifier: `gold` → `highlight-1`, `blue` → `highlight-3`, `green` → `highlight-2`, `rose` → `highlight-1`.
2. THE Backend SHALL accept both old and new color identifiers during a transitional migration window, and THE Backend SHALL validate that any submitted color is a member of the supported set.
3. THE Database migration SHALL update all existing highlight `color` column values from old names to their mapped positional identifiers atomically.

---

### Requirement 8 — No Regression in PDF Layout or Unrelated Behavior

**User Story:** As a developer, I want the theme-aware highlight changes isolated to color rendering and selection styling, so that no PDF layout, zoom, or unrelated reader functionality is affected.

#### Acceptance Criteria

1. WHEN theme-aware highlight colors are implemented, THE PDF Viewer SHALL preserve its existing layout, zoom behavior, page rendering, and typography without modification.
2. THE Implementation SHALL reuse the existing `reader-mood-*` CSS class system and `applyTheme` function rather than introducing a parallel theme mechanism.
3. THE Existing backend and frontend tests SHALL continue to pass after the changes, and THE Test Suite SHALL include focused tests for color resolution and selection color behavior.
