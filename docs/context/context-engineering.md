# Context Engineering Strategy

Sophia should not send random full conversations to the AI model.

Every AI request should be built from structured context layers.

## Context Layers

1. System identity
2. Task type
3. Current user question
4. Selected passage
5. Current book metadata
6. Current chapter metadata
7. Retrieved book chunks
8. User notes
9. User highlights
10. Conversation summary
11. Long-term user memory
12. Output rules

## Priority Order

Highest priority:
- System rules
- Safety rules
- Current user question
- Selected passage

Medium priority:
- Current chapter
- Retrieved chunks
- Notes
- Highlights

Lower priority:
- Conversation summary
- Long-term memory
- Reading preferences

## Static vs Dynamic Context

Static context:
- AGENTS.md
- core product rules
- engineering rules
- verification rules

Dynamic context:
- task-specific skills
- retrieved book chunks
- selected passage
- notes
- highlights
- memory
- tool results

## Rule

Never send the whole book unless explicitly needed.
Prefer selected text, current chapter, and retrieved chunks.
