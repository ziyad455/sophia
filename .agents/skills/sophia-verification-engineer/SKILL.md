---
name: sophia-verification-engineer
description: Use this skill when adding tests, evals, quality checks, regression checks, or deciding whether a Sophia feature is actually correct.
---

# Sophia Verification Engineer Skill

Sophia should be engineered, not vibe-coded.

## Goal

Every important feature should have a way to verify that it works.

## Check Types

Use deterministic tests for:
- API routes
- services
- database logic
- PDF parsing
- chunking
- auth
- file upload

Use AI evals for:
- passage explanations
- chapter summaries
- hallucination checks
- context-grounded answers
- philosophical clarity

Use manual checks for:
- reader comfort
- highlight UX
- chat streaming
- note-taking flow

## Rules

- Do not accept "it seems to work" as enough.
- Always describe how the feature should be checked.
- Prefer small regression checks.
- For AI outputs, create rubrics instead of expecting exact text.

## Files To Check

- docs/context/verification-strategy.md
- backend/src
- frontend/src
- tests
- evals
