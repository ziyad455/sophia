# S7-T4 Findings

Status: Architecture decided; implementation in progress

## Initial Context

- Sophia is a philosophy reading companion. S7-T4 improves future reading
  support by making selected and nearby textual evidence small, traceable, and
  deterministic before it reaches a prompt.
- The builder receives already-authorized candidates. Authentication,
  ownership checks, record loading, and candidate eligibility stay with future
  feature services.
- Candidate text is dynamic, private, and untrusted data. It must never become
  a trusted prompt instruction merely because it is included in context.
- `SOPHIA_PROJECT.md` and `DESIGN.md` were not found by the initial targeted
  repository search. This will be confirmed and recorded with the full audit.
- The worktree was clean at the initial `git status --short --untracked-files=all`.

## Skill Discovery

- Relevant installed workflow skills include the requested planning, file
  context, compression, TDD, incremental implementation, interface, tool,
  evaluation, harness, security, documentation, review, verification, and
  prompt-engineering skills.
- Sophia-specific context, backend, and verification skills are also installed
  and selected.
- `using-agent-skills` and `debugging-and-error-recovery` are absent from
  `.agents/skills/`.
- `planning-with-files` contains executable lifecycle hooks and home-directory
  discovery. Its automation is outside the task's needed surface and will not
  run; its durable Markdown method is applied manually.
- The repository scanner reported no findings for the selected harness, tool,
  evaluation, security, interface, spec, task-breakdown, filesystem, TDD,
  incremental, review, documentation, verification, prompt-engineering, or
  Sophia-specific skills.
- `planning-with-files` produced seven critical mechanical findings: five
  lifecycle-hook categories and two script pattern matches in
  `session-catchup.py`. No hook or bundled planning script will run.
- `context-compression` produced one high structural finding because its
  `tests/test_compression_evaluator.py` auto-imports a bundled evaluator under
  pytest. The test content is an ordinary evaluator unit test, but neither it
  nor the bundled evaluator is needed or will run; only the structured artifact
  trail guidance is applied.

## Prior Sprint Context

- S7-T3 established an instance-owned, exact-versioned `PromptRegistry` under
  `backend/src/ai/prompts/`, with strict runtime validation, controlled prompt
  errors, fresh frozen results, and no application wiring.
- S7-T3 deliberately left context assembly to S7-T4 and documented the future
  flow as feature service to `PromptRegistry` to `AIRuntime` to `AIProvider`.
- These prior findings are orientation only; current repository source will be
  audited before reuse.
- No S7-T1 task directory exists in the current repository. Its authoritative
  artifacts are the merged AI runtime source, tests, docs, and accepted ADR.
- S7-T2's task records confirm manual, instance-owned composition, provider SDK
  isolation, safe fixed error messages, authoritative runtime validation, and
  deterministic fake-transport evaluation. S7-T4 must add no composition or
  provider dependency.

## Product and Architecture Documentation

- `docs/context/context-engineering.md` prioritizes selected passage above
  chapter/retrieved material, notes, and highlights; it separates textual
  evidence from interpretive background and forbids sending the whole book by
  default.
- `docs/context/rag-strategy.md` describes a future retrieval order but RAG,
  relevance selection, and `user memory` are outside S7-T4. The builder should
  accept only already-selected candidates and should not invent retrieval.
- `docs/context/memory-strategy.md` names a future Context Builder inside the AI
  orchestrator, but memory selection is explicitly excluded from this sprint.
- Existing ADRs are append-only sections in
  `docs/context/architecture-decisions.md`; no separate ADR directory exists.
- `docs/ai-runtime.md` already reserves a later builder between feature context
  selection and `PromptRegistry`. Prompt instructions and untrusted context
  must remain structurally separate.
- Existing runtime and prompt modules perform no content logging, expose only
  allowlisted normalized fields, and use fixed domain-safe errors with internal
  causes. S7-T4 should match those conventions.

## Audit To Complete

- Exact AI runtime/provider/prompt contracts, errors, validation, fake/Gemini
  adapters, composition, exports, logging, tests, and eval runner.
- Extracted page/chapter/chunk, book, highlight, and note models/contracts.
- Existing context concatenation, page adjacency, budgeting, truncation,
  provenance/citation, and AI request metadata behavior.
- Package scripts, TypeScript/test configuration, and authoritative commands.

## Current AI Module Audit

- The complete `backend/src/ai/` production and test/evaluation module was
  inspected. There is no `context/` module or context-building implementation.
- `AIProvider.generate()` accepts Sophia-owned `AIRequest<unknown>` and returns
  `AIProviderResponse`. `AIRequest` carries normalized messages, optional
  model/temperature/output-token limit, output requirement, and abort signal;
  it carries no context package or request metadata.
- `AIRuntime.generate()` validates request messages/options, resolves the
  configured provider from an instance-owned registry, normalizes failures,
  allowlists response fields, and authoritatively validates structured output.
- `PromptRegistry` is instance-owned and independent of runtime/providers. It
  validates unknown input through a definition validator, validates plain
  rendered messages, reconstructs/freeze-returns controlled results, and uses
  fixed `PromptError` messages with identity-only metadata and internal causes.
- `FakeAIProvider` is deterministic but records original request references and
  is a provider test harness, not a reusable context mutation-safety helper.
- Gemini SDK imports remain isolated to
  `backend/src/ai/providers/gemini/gemini-sdk-client.ts`; context code must not
  import composition, adapters, SDK contracts, or `AIRuntime`.
- AI application composition exists only as an explicit Gemini factory and is
  not wired into `app.ts`. `PromptRegistry` also has no production instance.
  An unwired exported ContextBuilder matches current architecture.
- Existing AI/prompt tests use colocated `node:test` and
  `node:assert/strict`; evals are deterministic `*.eval.test.ts` files rather
  than a separate framework.
- Domain errors are separate classes with stable literal code unions and safe
  messages. HTTP status mapping is not part of AI/prompt boundaries.

## Reading Data and Authorization Audit

- Prisma owns `Book`, `UserBook`, `Chapter`, `Page`, `BookChunk`, `Highlight`,
  and `Note`. Context must not return these entities directly.
- Safe near-term identifiers exist for book, user-book, chapter, page, chunk,
  highlight, and note records. Filesystem paths and book storage fields exist
  on `Book` but are not valid provenance.
- `Page` has `id`, `bookId`, optional `chapterId`, one-based `pageNumber`, and
  optional extracted text. `Chapter` has stable ID/index plus optional title,
  page range, and text offsets. `BookChunk` has stable ID, book/chapter IDs,
  page range, chunk index, content, approximate stored `tokenCount`, version,
  and arbitrary metadata.
- Public reader content already returns authorized book metadata, ordered
  chapters, and extracted page IDs/numbers/text. It derives chapter assignment
  from explicit page relations or chapter page ranges. It does not build AI
  context or select neighboring pages.
- Highlight input is capped at 5,000 characters and normalizes whitespace.
  Public highlights expose stable ID, book/user-book IDs, selected text, page
  range, chapter ID, and reader anchor fields. Highlight services verify book
  ownership and source location before persistence.
- Note input is capped at 10,000 characters (quote at 5,000), plain-text
  validated, and classified as passage/highlight/page/chapter/book. Public
  notes expose stable ID, content/quote, highlight/page/chapter references, and
  chapter title. Note services verify ownership and derive highlight-source
  context server-side.
- Existing feature services prove the correct trust boundary: routes establish
  `userId`; services verify `UserBook` ownership and record relationships; a
  future feature service must then map authorized records into context blocks.
  `ContextBuilder` needs no Prisma/repository access.

## Existing Context-Like Logic Classification

| Location | Classification | Finding |
| --- | --- | --- |
| `backend/src/processing/chunker.ts` | Feature-specific, partially reusable concept | `estimateTokenCount()` is a deterministic word-count times 1.3 approximation for ingestion chunking. It is not an official tokenizer and its function/type live in a database chunk-generation concern. Reusing it would mislabel a context budget as tokens and couple runtime context to processing. |
| `backend/src/books/books.service.ts` | Reusable caller data, not builder logic | Authorizes user books and returns ordered metadata/pages/chapters. Future feature services may use this data to create candidates; the builder must not call it. |
| `notes` and `highlights` services/mappers | Reusable caller data and authorization pattern | Supply already-owned content and safe IDs/ranges, but their Prisma/public objects must be mapped into Sophia context contracts. |
| AI runtime/prompt tests | Test fixtures only | Synthetic passage/message strings test boundaries; they are not context construction. |
| `docs/context/*` and README | Product guidance/future design | Define priority principles and future citations but no executable provenance or context types. |

- No concatenated AI passage string, chapter-text assembly for prompts,
  current/neighbor page selection, context budget, truncation helper, source
  citation type, provenance type, or AI request context metadata exists.
- Repository searches found no provider-neutral tokenizer dependency or local
  exact token counter. S7-T4 should use an honestly named deterministic unit,
  with no dependency or network count.

## Configuration, Logging, and Verification Constraints

- Backend TypeScript is strict ES2022/NodeNext. Tests are compiled by package
  scripts before Node executes emitted JavaScript.
- Every existing backend test/evaluation script runs `npm run build` first.
  Repository instructions prohibit Codex from running any build command, so
  those scripts cannot be used as-is in this task's fresh verification.
  A direct no-build Node test path must be proven or the gates must be reported
  as user-run recommendations.
- The backend has no lint script; prior sprint convention invokes the installed
  frontend Oxlint binary against backend source.
- AI, prompt, highlight, and note modules do not log content. Production logs
  are limited to startup plus book/processing failures. S7-T4 must add no logs.
- No dependency or tokenizer addition is justified.

## Architecture Decision

### Responsibility and trust boundary

- A future authorized feature service selects and loads eligible data, verifies
  ownership, maps it into Sophia context blocks, controls allowed kinds,
  priorities, required IDs, truncation policy, and budget, then calls the pure
  builder.
- `ContextBuilder` validates unknown request data, orders it, enforces the
  controlled budget, truncates only where explicitly allowed, and returns
  frozen provenance-preserving data. It performs no I/O and does not interpret
  source text as instructions.
- Future `PromptRegistry` definitions receive the structured package and keep
  trusted prompt instructions separate. The builder does not render messages,
  concatenate a prompt, or call `AIRuntime`.

### Contract and policies

- Kinds: selected passage, current page, surrounding page, current chapter,
  book metadata, highlight, and note. These are present or near-term reading
  layers. Retrieved chunks/RAG, interpretive background, conversation, and
  memory are intentionally absent.
- Block IDs use the established lowercase stable-ID grammar. Source entity IDs
  use the repository's UUID grammar. Sources require `bookId` and `userBookId`
  and only allow kind-relevant IDs/page ranges.
- Higher integer `priority` sorts first within required/optional groups. Stable
  ties use kind order `selected_passage`, `current_page`, `surrounding_page`,
  `current_chapter`, `book_metadata`, `highlight`, `note`, then block ID. This
  protects selected reading evidence while letting a server-owned feature
  policy prioritize a specific eligible block.
- Requiredness is per request ID, never implicit by kind. A missing/disallowed
  required block or required content over budget fails safely; nothing is
  silently dropped or shortened.
- Duplicate IDs fail rather than deduplicate, because silent deduplication
  hides caller mistakes and makes provenance ambiguous.
- Budget is exact Unicode code points in returned block content. It makes no
  token claim and needs no tokenizer. Bounds are 100 candidates and 100,000
  code points for both a block and package limit.
- Truncation is opt-in `preserve_start` and valid only for optional current,
  surrounding, or chapter text. It appends `\n[context truncated]` inside the
  remaining budget without splitting surrogate pairs. Other blocks use
  `none` and stay whole.
- A greedy pass preserves priority: full blocks are included when they fit;
  non-truncatable blocks that do not fit are excluded and later smaller blocks
  may still fit; a permitted truncated block consumes the remaining budget so
  no collection of lower-priority fragments is produced.
- Output stays structured and frozen. It contains ordered copied blocks,
  copied/frozen source references, usage/truncation metadata, budget totals,
  and content-free exclusion records. There is no `combinedText` because a
  delimiter would be prompt construction and would weaken provenance.

### Threat model

- Assets: private book passages, notes, highlights, user-owned identifiers, and
  deterministic policy behavior.
- Boundaries: unknown request objects/proxies, private candidate text, and
  server-controlled policy fields.
- Controls: strict plain-record/field allowlists, bounded arrays/strings,
  stable sorting, UUID/source validation, fixed safe errors, fresh copies and
  freezing, no logging/I/O, no executable callback/configuration, and caller
  authorization documented as mandatory.
- Prompt injection remains possible in book/note text; the builder only keeps
  it as data and cannot make model instructions trustworthy.
