# Memory Strategy

Sophia memory should help the user build long-term philosophical understanding.

## Memory Types

- preferred explanation style
- favorite philosophers
- difficult concepts
- recurring questions
- personal reflections
- finished books
- important highlights

## What To Remember

Remember:
- concepts the user struggles with
- philosophers the user enjoys
- recurring philosophical interests
- explanation style preferences

Do not remember:
- random temporary questions
- every chat message
- private details unrelated to reading

## Memory Format

Each memory should include:

- type
- content
- source
- confidence
- createdAt
- updatedAt

## Technical Shape

Sophia should use one main AI orchestrator with task modes, plus a memory subsystem.

Do not model memory as a separate visible assistant. The user should experience one Sophia, while the backend uses specialized services.

Recommended internal shape:

```txt
AI Orchestrator
├── Context Builder
├── Task Handlers
├── Provider Adapter
└── Memory System
    ├── Memory Extractor
    ├── Memory Reviewer / Updater
    └── Memory Selector
```

## Memory Pipeline

The memory subsystem should run after meaningful reading events, not after every request.

Useful memory trigger events:

- user writes a note
- user creates a highlight
- user asks repeated questions about the same idea
- user corrects Sophia's explanation
- user finishes a reading session
- user finishes a chapter or book

The memory extractor should produce candidate memories from those events. Candidate memories should be distilled observations, not raw transcripts.

The memory reviewer / updater should decide whether to:

- create a new memory
- update an existing memory
- ignore the event
- lower confidence
- archive stale or contradicted memory

The memory selector should run at answer time and include only memories relevant to the current task, passage, book, chapter, or question.

## User Preferences vs Memory

Keep explicit preferences separate from inferred memory.

Explicit preferences belong in `user_preferences`, for example:

- theme
- font size
- explanation depth
- preferred tone

Inferred or saved understanding belongs in `user_memory`, for example:

- user prefers simple explanations before deeper analysis
- user often asks for historical context
- user struggles with a recurring philosophical concept
- user connects a passage to a personal reflection

Do not collapse preferences and memory into one table. Preferences are settings. Memory is learned from reading behavior.

## Example

If the user highlights a passage about suffering and writes:

```txt
This reminds me of Buddhist attachment.
```

Sophia may create a candidate memory:

```txt
type: personal_reflection
content: User connects Schopenhauer's idea of suffering with Buddhist attachment.
sourceType: note
sourceId: note.id
confidence: 0.7
status: active
```

Later, when the user asks about Schopenhauer, the memory selector may include this memory if it is relevant to the passage or question.

## MVP Boundaries

For the MVP:

- start with memory extraction from notes, highlights, chat messages, and reading sessions
- store distilled memories in `user_memory`
- keep memory status reviewable and removable
- use confidence scores conservatively
- select only a small number of relevant memories for AI context

Avoid:

- storing every chat message as memory
- remembering private details unrelated to reading
- adding autonomous multi-agent coordination before the core reading loop works
- allowing long-term memory to outweigh selected passage or current chapter context
