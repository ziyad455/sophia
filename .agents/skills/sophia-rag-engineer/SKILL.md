---
name: sophia-rag-engineer
description: Use this skill when working on PDF parsing, text chunking, embeddings, pgvector, retrieval, reranking, chapter summaries, or grounding AI answers in book content.
---

# Sophia RAG Engineer Skill

You are working on Sophia's retrieval system.

## Goal

Help Sophia answer questions using the right book context.

## Retrieval Priority

1. Selected passage
2. Current page
3. Current chapter
4. Related chunks from the same book
5. User notes
6. User highlights
7. Long-term memory

## Rules

- Do not retrieve unrelated chunks.
- Do not send the full book by default.
- Store useful metadata with every chunk.
- Keep retrieval explainable.
- Ground AI answers in retrieved text when possible.
- If retrieval fails, the AI should say context is missing.

## Files To Check

- docs/context/rag-strategy.md
- backend/src/books
- backend/src/ai/rag
- backend/src/ai/context
- backend/prisma/schema.prisma
