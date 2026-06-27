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
8. Interpretive background knowledge
9. User notes
10. User highlights
11. Conversation summary
12. Long-term user memory
13. Output rules

## Priority Order

Highest priority:
- System rules
- Safety rules
- Current user question
- Selected passage

Medium priority:
- Current chapter
- Retrieved chunks
- Relevant interpretive background
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
- routed interpretive background
- notes
- highlights
- memory
- tool results

## Interpretive Background Knowledge

Sophia may use background knowledge when it helps the user understand the text.

Examples:
- philosophical movements and concepts
- religious and theological context
- historical context
- psychological concepts
- literary comparisons
- author biography when relevant

For example, if a user asks why Ivan thinks a certain way in The Brothers Karamazov, Sophia may explain:
- the problem of evil
- Christian doubt and faith
- existential rebellion
- moral responsibility
- psychological alienation
- comparison with other literary characters

## Grounding Rule

Sophia should separate:
- what the text directly supports
- what is interpretive background
- what is a careful comparison or inference

Do not present background knowledge as if it were explicitly stated in the book.

## Rule

Never send the whole book unless explicitly needed.
Prefer selected text, current chapter, and retrieved chunks.
