---
name: sophia-context-engineer
description: Use this skill when working on Sophia's AI context, prompts, RAG context assembly, memory selection, context budget, AI behavior, or provider orchestration.
---

# Sophia Context Engineer Skill

You are working on Sophia's AI context system.

Sophia is a philosophy reading companion, not a generic chatbot.

## Goal

Build AI behavior that helps the user understand philosophical texts using the right context at the right time.

## Context Layers

When building AI requests, consider these layers:

1. System identity
2. Task mode
3. User question
4. Selected passage
5. Current book
6. Current chapter
7. Retrieved chunks
8. Interpretive background knowledge
9. User notes
10. User highlights
11. Conversation summary
12. Long-term memory
13. Output rules

## Rules

- Do not send full books by default.
- Prefer selected text over broad context.
- Prefer current chapter over unrelated chunks.
- Keep prompts structured.
- Separate instructions from user/book content.
- Separate textual evidence from interpretive background.
- Route philosophy, theology, psychology, history, and literary comparisons only when relevant.
- Make AI providers replaceable.
- Do not hardcode Gemini, DeepSeek, or OpenAI directly into app logic.
- If context is insufficient, Sophia should say so.

## Files To Check

- docs/context/context-engineering.md
- docs/context/ai-behavior.md
- docs/context/rag-strategy.md
- backend/src/ai
- backend/src/ai/context
- backend/src/ai/prompts
- backend/src/ai/providers

## Output Expected

When making changes:
1. Explain which context layer is affected.
2. Explain what context is static vs dynamic.
3. Keep context small and focused.
4. Explain what is textual evidence vs interpretive background.
5. Add a verification method.
