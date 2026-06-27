# Sophia Agent Instructions

Sophia is an AI-powered philosophy reading companion.

The goal is not to build a generic chatbot or a generic PDF reader.
The goal is to help users read, understand, reflect on, and remember philosophical ideas.

## Product Priority

Always prioritize:

1. Reading experience
2. Understanding difficult philosophical passages
3. Reflection, notes, and highlights
4. Long-term philosophical memory
5. Simple architecture

Every feature must answer:

Does this improve the philosophy reading experience?

If the answer is no, do not build it.

## Tech Stack

Frontend:
- React
- TypeScript

Backend:
- Express.js
- TypeScript

Database:
- PostgreSQL
- Prisma

AI:
- AI provider abstraction
- RAG later with pgvector
- Gemini/OpenRouter/DeepSeek should be swappable

## Engineering Rules

- Keep frontend and backend separated.
- Do not install packages unless explicitly asked.
- Prefer simple architecture over over-engineering.
- Use TypeScript everywhere.
- Do not add Python unless there is a strong ML reason.
- Make small, reviewable changes.
- Explain affected files before large changes.

## AI Product Rules

Sophia should feel like:
- a quiet study room
- a thoughtful companion
- a mentor
- a second brain

Sophia should not feel like:
- a generic chatbot
- a productivity app
- a random PDF summarizer

## Verification Rule

Do not stop at "it seems to work."
For every meaningful change, identify how it should be verified.

Why this file matters: Addy says the difference between vibe coding and engineering is verification, not whether AI is used. So we put that rule in static context.
