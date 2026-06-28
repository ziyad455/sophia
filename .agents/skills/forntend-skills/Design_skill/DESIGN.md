---
product: Sophia
tagline: Your AI Philosophy Companion
document_type: design-system-context
version: 0.1
status: planning
default_theme: warm-paper

fonts:
  reading:
    primary: Literata
    alternatives:
      - Lora
      - Crimson Pro
  ui:
    primary: Inter
    alternatives:
      - Geist
      - IBM Plex Sans

themes:
  warm_paper:
    name: Warm Paper
    role: default
    background: "#F4EBDD"
    surface: "#FFF8ED"
    text: "#2B2118"
    muted_text: "#6F6255"
    primary: "#8B5E34"
    accent: "#C49A6C"
    border: "#DED0BD"
    highlight: "#E9C46A66"
    quote_background: "#EFE1CC"
    ai_surface: "#FFF3E1"

  night_study:
    name: Night Study
    role: dark
    background: "#111111"
    surface: "#1A1A1A"
    text: "#EDE7DD"
    muted_text: "#A89F94"
    primary: "#C9A86A"
    accent: "#8E735B"
    border: "#2C2C2C"
    highlight: "#C9A86A33"
    quote_background: "#202020"
    ai_surface: "#181818"

  stoic_green:
    name: Stoic Green
    role: calm
    background: "#EEF3EC"
    surface: "#FAFCF7"
    text: "#1F2A24"
    muted_text: "#66736A"
    primary: "#3F5F4A"
    accent: "#A8BFA3"
    border: "#D4DED0"
    highlight: "#BFD8B866"
    quote_background: "#E4ECE0"
    ai_surface: "#F5F8F2"

  marble_academy:
    name: Marble Academy
    role: classical
    background: "#F7F7F2"
    surface: "#FFFFFF"
    text: "#252525"
    muted_text: "#6B6B63"
    primary: "#36454F"
    accent: "#B8A06A"
    border: "#E1DFD5"
    highlight: "#D6C48D66"
    quote_background: "#EFEFE7"
    ai_surface: "#FFFFFF"

  existential_ash:
    name: Existential Ash
    role: deep-dark
    background: "#181818"
    surface: "#232323"
    text: "#F1EFEA"
    muted_text: "#9C9992"
    primary: "#B84A3A"
    accent: "#D6A15C"
    border: "#333333"
    highlight: "#B84A3A44"
    quote_background: "#202020"
    ai_surface: "#1E1E1E"

spacing:
  scale:
    - 4
    - 8
    - 12
    - 16
    - 24
    - 32
    - 48
    - 64

radius:
  small_controls: 8
  cards: 12
  panels: 20
  large_containers: 24

layout:
  desktop:
    reader_area: "65% - 75%"
    side_panel: "25% - 35%"
  reading_width: "650px - 820px"

typography:
  book_body: "18px - 20px"
  book_line_height: "1.7 - 1.85"
  chat_text: "15px - 16px"
  ui_labels: "13px - 14px"
  small_metadata: "12px - 13px"
  chapter_title: "28px - 36px"
  section_title: "20px - 24px"
---

# Sophia DESIGN.md

This file defines Sophia's visual identity, design principles, UI direction, themes, typography, layout rules, and interaction behavior.

It exists so AI assistants and future frontend work do not invent random generic UI.

Sophia must always feel like a calm philosophy reading companion, not a generic SaaS dashboard, chatbot, or PDF viewer.

---

# 1. Product Design Vision

Sophia is an AI-powered philosophy reading companion.

The design should make the user want to:

- read slowly
- understand difficult ideas
- highlight meaningful passages
- write personal notes
- ask thoughtful questions
- return to ideas later
- build a long-term philosophical journey

Sophia should feel like:

- a quiet study room
- an old library
- a thoughtful companion
- a calm mentor
- a personal philosophy notebook
- a second brain for reading

Sophia should not feel like:

- a generic SaaS dashboard
- a normal PDF viewer
- a productivity app
- a noisy AI chatbot
- a business document-processing tool
- a file manager

---

# 2. Core Design Principles

## 2.1 Reading Comes First

Reading is the center of Sophia.

AI, notes, highlights, summaries, and memory should support reading.

They should never compete with the book.

If a UI element distracts from reading, simplify it or remove it.

## 2.2 Calm Is a Feature

Sophia should feel peaceful.

Avoid:

- visual noise
- too many buttons
- aggressive colors
- constant animations
- cluttered sidebars
- dashboard-style interfaces

Calm design is not decoration.
It is part of the product value.

## 2.3 Philosophy Needs Space

Philosophy is slow.

The interface should allow:

- long passages
- reflection
- uncertainty
- comparison between ideas
- questions without quick answers
- repeated revisiting of notes and highlights

The design should not push the user to rush.

## 2.4 AI Should Feel Integrated

Sophia's AI should not feel like ChatGPT pasted beside a PDF.

The AI companion should feel connected to:

- selected text
- current page
- current chapter
- notes
- highlights
- reading history
- user memory

The AI should help the reader return to the book, not replace the book.

## 2.5 Personal, Not Corporate

Sophia is a personal intellectual space.

It should feel warm, serious, and reflective.

Avoid making it look like an enterprise document-processing product.

---

# 3. Brand Feeling

Sophia should visually communicate:

- wisdom
- calm
- seriousness
- warmth
- depth
- focus
- trust
- reflection
- intellectual comfort

Design keywords:

```txt
quiet
literary
thoughtful
warm
timeless
focused
elegant
readable
personal
philosophical
```

Avoid:

```txt
neon
corporate
gamified
loud
over-animated
generic AI
dashboard-like
```

---

# 4. Typography

Typography is one of the most important parts of Sophia.

Sophia is a reading product, so text must feel comfortable for long reading sessions.

## 4.1 Font Strategy

Use two font families:

1. A serif font for reading content
2. A sans-serif font for interface elements

## 4.2 Recommended Reading Font

Default reading font:

```txt
Literata
```

Why:

- designed for long reading
- book-like
- warm
- readable
- suitable for philosophy

Alternative reading fonts:

```txt
Lora
Crimson Pro
```

Use Lora if the design needs a softer literary feeling.

Use Crimson Pro if the design needs a more classical academic feeling.

## 4.3 Recommended UI Font

Default UI font:

```txt
Inter
```

Why:

- clean
- modern
- readable
- reliable for web applications

Alternative UI fonts:

```txt
Geist
IBM Plex Sans
```

## 4.4 MVP Font Pairing

Use:

```txt
Reading font: Literata
UI font: Inter
```

This gives Sophia a balance between:

- book-like reading
- clean modern interface

## 4.5 Typography Scale

Recommended sizes:

```txt
Book body text: 18px - 20px
Book line height: 1.7 - 1.85
Chat text: 15px - 16px
UI labels: 13px - 14px
Small metadata: 12px - 13px
Chapter title: 28px - 36px
Section title: 20px - 24px
```

## 4.6 Reading Text Rules

For book reading:

- avoid very long lines
- use generous line height
- avoid harsh pure black on light themes
- avoid pure white on dark themes when possible
- give paragraphs breathing room
- keep selected text easy to see
- make highlights soft and readable

Recommended reading width:

```txt
650px - 820px
```

---

# 5. Color Themes

Sophia should support five reading themes for the MVP.

Each theme should feel like a different reading mood, not just a color swap.

Themes should affect:

- app background
- reading surface
- AI panel
- notes panel
- text
- muted text
- borders
- buttons
- highlights
- selected passage state
- quote blocks

Themes should not create different layouts.

The layout stays consistent.
Only the mood changes.

---

## 5.1 Warm Paper

Default theme.

This should feel like reading an old philosophy book on a quiet desk.

Best for:

- general reading
- Schopenhauer
- Aristotle
- Plato
- long comfortable sessions

```txt
Background: #F4EBDD
Surface: #FFF8ED
Text: #2B2118
Muted Text: #6F6255
Primary: #8B5E34
Accent: #C49A6C
Border: #DED0BD
Highlight: #E9C46A66
Quote Background: #EFE1CC
AI Surface: #FFF3E1
```

Feeling:

```txt
warm
literary
calm
book-like
personal
```

Warm Paper should be the default Sophia theme.

---

## 5.2 Night Study

Dark reading theme.

This should feel like reading philosophy late at night.

Best for:

- night reading
- Nietzsche
- Dostoevsky
- Camus
- Schopenhauer

```txt
Background: #111111
Surface: #1A1A1A
Text: #EDE7DD
Muted Text: #A89F94
Primary: #C9A86A
Accent: #8E735B
Border: #2C2C2C
Highlight: #C9A86A33
Quote Background: #202020
AI Surface: #181818
```

Feeling:

```txt
serious
quiet
deep
focused
```

---

## 5.3 Stoic Green

Calm natural theme.

This should feel peaceful and reflective.

Best for:

- Marcus Aurelius
- Seneca
- self-reflection
- morning reading

```txt
Background: #EEF3EC
Surface: #FAFCF7
Text: #1F2A24
Muted Text: #66736A
Primary: #3F5F4A
Accent: #A8BFA3
Border: #D4DED0
Highlight: #BFD8B866
Quote Background: #E4ECE0
AI Surface: #F5F8F2
```

Feeling:

```txt
peaceful
natural
reflective
stoic
balanced
```

---

## 5.4 Marble Academy

Classical philosophy theme.

This should feel clean, academic, and Greek-inspired.

Best for:

- Plato
- Aristotle
- logic
- ancient philosophy
- formal study

```txt
Background: #F7F7F2
Surface: #FFFFFF
Text: #252525
Muted Text: #6B6B63
Primary: #36454F
Accent: #B8A06A
Border: #E1DFD5
Highlight: #D6C48D66
Quote Background: #EFEFE7
AI Surface: #FFFFFF
```

Feeling:

```txt
classical
clean
intellectual
formal
timeless
```

---

## 5.5 Existential Ash

Deep modern dark theme.

This should feel minimal, cold, serious, and existential.

Best for:

- Camus
- Kafka
- Dostoevsky
- existentialism
- absurdism
- difficult emotional reading

```txt
Background: #181818
Surface: #232323
Text: #F1EFEA
Muted Text: #9C9992
Primary: #B84A3A
Accent: #D6A15C
Border: #333333
Highlight: #B84A3A44
Quote Background: #202020
AI Surface: #1E1E1E
```

Feeling:

```txt
heavy
minimal
existential
serious
dramatic but controlled
```

---

# 6. Layout Direction

## 6.1 Main Reader Layout

The main reader page may contain:

```txt
Left: book navigation or library context
Center: reading content
Right: AI companion, notes, highlights
```

But for MVP, avoid showing too many panels at once.

The center reading area should always feel dominant.

## 6.2 Recommended MVP Layout

Use a focused two-column layout:

```txt
Main reading area: 65% - 75%
AI / notes side panel: 25% - 35%
```

The side panel should be collapsible.

Notes and AI can share the side panel through tabs.

## 6.3 Reader Page Priorities

The reader page should prioritize:

1. Reading
2. Selecting text
3. Highlighting
4. Asking Sophia
5. Taking notes
6. Viewing chapter insights

Do not overfill the page.

---

# 7. Core Screens

## 7.1 Landing Page

The landing page should communicate:

- Sophia is a philosophy reading companion
- it helps readers understand, reflect, and remember
- it is calm, focused, and personal

Avoid generic SaaS language.

## 7.2 Authentication Screens

Auth screens should feel simple and trustworthy.

They should support:

- email login
- email registration
- Google sign-in

The design should feel calm, not like a startup growth funnel.

## 7.3 Library Page

The library should feel like a personal bookshelf.

It should not feel like a file manager.

Book cards should show:

- title
- author
- reading progress
- last opened
- optional cover
- current theme or mood later

## 7.4 Reader Page

The reader page is the heart of Sophia.

It should include:

- reading area
- page/chapter navigation
- text selection
- highlights
- notes
- AI companion panel
- theme controls
- reading progress

The book should visually remain the center.

## 7.5 Profile / Preferences Page

This page should allow the user to manage:

- theme
- reading font
- UI font if supported
- explanation style
- preferred answer depth
- Google account connection
- memory settings later

---

# 8. Components and UI Behavior

## 8.1 PDF Viewer

The PDF viewer should support:

- comfortable reading
- page navigation
- zoom
- text selection
- current page state
- reading progress
- selected passage extraction
- highlight display

The PDF viewer should not feel technical.

It should feel like a reading surface.

## 8.2 Text Selection

When the user selects text, Sophia should offer calm actions:

- Explain
- Ask Sophia
- Highlight
- Add Note
- Save Reflection

The action menu should be small and elegant.

Avoid big floating toolbars.

## 8.3 Highlights

Highlights should be soft and readable.

Avoid aggressive neon yellow.

Highlights should feel like marking a book, not like selecting text in a code editor.

Possible future highlight types:

- important idea
- question
- disagreement
- beautiful passage
- concept to revisit

For MVP, one highlight style is enough.

## 8.4 Notes

Notes should feel personal.

They should connect to:

- selected text
- page
- chapter
- book
- user

Notes should be easy to write without leaving the reading flow.

## 8.5 AI Companion Panel

The AI panel should feel like a thoughtful reading companion.

It should not dominate the page.

It should support:

- asking about selected text
- explaining a passage
- summarizing a chapter
- asking reflection questions
- connecting ideas
- showing relevant notes/highlights later

AI answers should be readable, calm, and well-spaced.

## 8.6 Chapter Summary View

The summary view should not replace reading.

It should help the reader organize what they read.

It should show:

- main idea
- important arguments
- important concepts
- key passages
- reflection questions

## 8.7 Reflection Prompt View

Reflection prompts should feel thoughtful, not motivational.

Good prompts:

- What assumption is this passage challenging?
- Do you agree with this idea?
- What would change if this argument were true?
- Where do you feel resistance to this idea?

Avoid empty prompts like:

- Great job!
- Keep going!
- You are doing amazing!

---

# 9. AI Answer Design

AI answers should be formatted for reading.

Preferred structure:

```txt
Simple explanation
Deeper meaning
Connection to the passage
Optional comparison
Reflection question
```

Visually, AI answers should use:

- short paragraphs
- gentle section headings
- subtle dividers
- quotes when useful
- enough spacing
- no overwhelming walls of text

The AI answer should make the reader return to the text.

It should not replace the text.

---

# 10. Interpretive Context UI

Sophia may later show which interpretive lens it is using.

Examples:

```txt
Philosophy
Religion
Psychology
Literary comparison
Historical context
Author context
```

This should be subtle.

Do not turn it into a complex dashboard.

A small label is enough:

```txt
Lens: Philosophy + Religion
```

---

# 11. Spacing and Shape

## 11.1 Spacing

Use generous spacing.

Sophia should breathe.

Recommended spacing scale:

```txt
4px
8px
12px
16px
24px
32px
48px
64px
```

## 11.2 Border Radius

Use soft radius:

```txt
Small controls: 8px
Cards: 12px - 16px
Panels: 18px - 24px
Large containers: 24px
```

Avoid extremely round bubbly UI.

Sophia should feel mature, not playful.

## 11.3 Shadows

Use shadows lightly.

Prefer borders and soft surfaces over heavy shadows.

Shadows should be subtle and calm.

---

# 12. Motion and Interaction

Motion should be slow, subtle, and meaningful.

Use motion for:

- opening side panels
- showing selected text actions
- streaming AI responses
- switching themes
- saving notes/highlights

Avoid:

- bouncy animations
- playful micro-interactions
- constant motion
- distracting transitions

Motion feeling:

```txt
calm
soft
slow
respectful
```

---

# 13. Icons

Use simple line icons.

Icon style should be:

- thin or medium stroke
- minimal
- readable
- not cartoonish

Good icon categories:

- book
- bookmark
- highlighter
- note
- quote
- insight
- moon
- sun
- leaf
- library
- search
- user

Avoid overly futuristic AI icons.

Sophia should not look like a generic AI tool.

---

# 14. Accessibility

Sophia should be comfortable and accessible.

Important rules:

- maintain readable contrast
- support keyboard navigation
- visible focus states
- readable font sizes
- avoid tiny text
- do not rely only on color
- support dark mode properly
- make interactive elements clear
- make selected text states obvious
- make highlights visible in all themes

Focus styles should be visible but elegant.

---

# 15. Responsive Design

## Desktop

Best experience:

- reading area
- AI / notes side panel
- comfortable layout

## Tablet

Use collapsible side panels.

The reader should still feel central.

## Mobile

Mobile should focus on one thing at a time:

- read
- ask
- notes
- highlights

Do not force desktop complexity onto mobile.

---

# 16. Empty States

Empty states should be warm and useful.

Examples:

## Empty Library

Do not say:

```txt
No files found.
```

Say:

```txt
Your library is quiet for now.
Upload your first philosophy book to begin reading with Sophia.
```

## Empty Notes

Do not say:

```txt
No notes.
```

Say:

```txt
Your reflections will appear here.
Select a passage and save a thought when something matters.
```

## Empty AI Chat

Do not say:

```txt
Ask me anything.
```

Say:

```txt
Select a passage or ask Sophia about the idea you are reading.
```

---

# 17. Writing Style in UI

Sophia's UI copy should be:

- calm
- simple
- reflective
- human
- not robotic
- not overly motivational

Use:

```txt
Ask Sophia
Save reflection
Explain this passage
Continue reading
Return to library
```

Avoid:

```txt
Generate insights
Boost productivity
Maximize understanding
AI-powered document workflow
```

---

# 18. MVP Design Scope

For MVP, design only:

- landing page
- authentication screens
- personal library
- upload flow
- PDF reading page
- five reading themes
- text selection actions
- highlights
- notes
- AI companion panel
- chapter summary view
- profile/preferences page

Do not design yet:

- social sharing
- public profiles
- leaderboards
- achievement systems
- complex analytics
- marketplace
- multi-user collaboration
- enterprise dashboards

---

# 19. Design Quality Checklist

Before accepting any UI idea, ask:

1. Does this improve philosophy reading?
2. Does this make the experience calmer?
3. Does this make the book feel central?
4. Does this avoid generic chatbot design?
5. Does this avoid generic SaaS dashboard design?
6. Is the typography comfortable for long reading?
7. Are highlights and notes easy to use?
8. Does AI feel connected to the selected passage?
9. Is the interface accessible?
10. Can this be simpler?

---

# 20. Final Design Direction

Sophia should feel like:

```txt
A calm digital library for philosophy,
with an AI companion sitting beside the book,
helping the reader understand, reflect, and remember.
```

Every design decision should support this feeling.

If a design element makes Sophia feel more like a generic SaaS dashboard, remove it.

If a design element makes reading calmer, deeper, or clearer, keep it.
