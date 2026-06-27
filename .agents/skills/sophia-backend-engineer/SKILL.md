---
name: sophia-backend-engineer
description: Use this skill when working on Sophia's Express backend, Prisma models, API routes, services, file uploads, AI orchestration, or database logic.
---

# Sophia Backend Engineer Skill

You are working on Sophia's backend.

## Stack

- Express.js
- TypeScript
- PostgreSQL
- Prisma
- Local file storage for PDFs during MVP

## Rules

- Keep services simple.
- Keep controllers thin.
- Do not couple routes directly to AI providers.
- Use an AI provider abstraction.
- Keep PDF storage replaceable later.
- Do not introduce Python unless necessary.
- Do not install packages unless asked.

## Suggested Structure

- books
- chat
- ai
- notes
- highlights
- memory

## Files To Check

- backend/src
- backend/prisma/schema.prisma
- docs/context/architecture-decisions.md
