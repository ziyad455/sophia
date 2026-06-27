# Architecture Decisions

## Current MVP Architecture

Frontend:
React + TypeScript

Backend:
Express.js + TypeScript

Database:
PostgreSQL + Prisma

Storage:
Local file system for PDFs during MVP

AI:
Provider abstraction

Future:
pgvector for vector search
RAG for book/chapter context
Long-term memory for personalization

## Principles

- Keep the MVP simple.
- Do not introduce microservices.
- Do not introduce Python unless necessary.
- Do not couple the app directly to one AI provider.
- Keep the AI provider replaceable.
- Build services around product features, not technical buzzwords.

## Main Backend Areas

- books
- reader
- chat
- ai
- notes
- highlights
- memory
