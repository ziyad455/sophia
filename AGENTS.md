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
Before starting any task in this project, make sure you understand the project context from the agent/context files.

Always treat the `.agents/` folder, `AGENTS.md`, `docs/context/`, and `DESIGN.md` as the source of truth for Sophia’s product direction, design rules, planning principles, and agent skills.

You do not need to reread every context file before every small task if you already have enough relevant context.

However, you must read or refresh the relevant context when:

* you are missing context
* the task is important or architectural
* the task affects product direction
* the task affects design, UI, UX, themes, or typography
* the task affects AI behavior, memory, interpretation, or reading experience
* the task involves creating or updating agent skills
* the task could change the long-term structure of the project

For normal implementation tasks, load only the relevant context and skill files instead of reading everything.

Use the right skill for the task when one exists.

Do not jump into implementation without understanding the product goal.

Sophia is a philosophy reading companion, not a generic chatbot, not a generic PDF viewer, and not a SaaS dashboard.

Every decision should protect the reading experience and answer:

Does this improve the philosophy reading experience?


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
