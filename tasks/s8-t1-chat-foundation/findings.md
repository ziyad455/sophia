# S8-T1 Chat Sessions and Messages Foundation — Findings

## Skills discovered and selected

| Skill | Application |
| --- | --- |
| `sophia-backend-engineer` | Keep Express controllers thin, Prisma/service logic simple, and production chat decoupled from AI providers. |
| `security-and-hardening` | Threat-model authenticated identity, cross-user/cross-book access, role forgery, private content, input bounds, and safe errors/logs. |
| `api-and-interface-design` | Define controlled request/response DTOs, predictable routes/errors, boundary validation, and deterministic observable ordering. |
| `spec-driven-development`, `planning-and-task-breakdown` | Treat the detailed brief as the approved spec and map it to ordered, bounded, verifiable slices. |
| `planning-with-files`, `filesystem-context`, `context-compression` | Preserve audit, decisions, errors, artifact trail, TDD evidence, and verification on disk; retrieve large context selectively. |
| `tdd`, `incremental-implementation` | Work one public behavior at a time through red-green cycles without speculative abstractions. |
| `harness-engineering` | Keep acceptance checks fixed, editable surfaces narrow, evidence durable, and commits/merges human-controlled. |
| `evaluation` | Use ordinary deterministic backend tests for CRUD/ownership/order and add no AI quality evaluation for a no-model task. |
| `code-review-and-quality`, `documentation-and-adrs`, `verification-before-completion` | Review all required axes, document durable decisions/API behavior, and make no completion claim without fresh evidence. |

Requested but unavailable: `using-agent-skills` and `debugging-and-error-recovery`.

`tool-design` is not selected: S8-T1 exposes an ordinary backend service/API boundary, not an AI tool contract.

## Skill and project-instruction conflicts

- Spec/planning skills normally require a separate approval checkpoint; the user's detailed brief is already the approved specification.
- TDD requests pre-agreed seams; the brief explicitly selects service and authenticated HTTP behavior as the seams.
- Incremental implementation recommends commits per slice; commits were not requested, so increments will remain uncommitted and evidence-backed.
- The brief requests a backend build, but repository policy says never run builds. Focused and regression tests are explicitly requested and permitted; the build command will be handed to the user.
- Headroom was invoked for large skill content but its configured proxy was unavailable, so context will be kept concise manually and in these task records.

## Audit

### Existing relevant schema

- `ChatSession` already references `userId`, `userBookId`, `bookId`, optional chapter/title/mode/archive fields, timestamps, and messages. `userBook` and messages use `onDelete: Cascade`.
- `ChatMessage` already references its session and user, stores controlled Prisma role/content/timestamp plus future-facing context/provider metadata, and cascades with its session.
- The initial migration already creates both tables, ownership foreign keys, and indexes for sessions by user/user-book/update time and messages by session/create time.
- The pre-existing `ChatMessageRole` enum includes `USER`, `ASSISTANT`, `SYSTEM`, and `TOOL`. S8-T1 will preserve the legacy schema but allowlist only user/assistant in the domain mapper and create only `USER` from browser input.
- No migration is justified: the existing `(sessionId, createdAt)` index supports the selected `createdAt, id` total ordering, and cascade deletion is already atomic.

### Existing chat-related code

- No chat route, controller, service, DTO, mapper, or test exists. Only schema and future-looking documentation exist, so no application abstraction will be duplicated.
- No production chat prompt, provider call, runtime call, context policy, or reader UI exists.

### Existing ownership pattern

- Private routes use `requireAuth`; controllers call `requireAuthContext(req)` and pass only authenticated `userId` to services.
- Services validate UUIDs, query `UserBook` with `{ id: userBookId, userId }`, and return fixed 404 errors for malformed, missing, mismatched, or unowned records.
- Personal data queries include both `userId` and `userBookId`. Shared `Book` is reached only after resolving the owned `UserBook`.

### Existing route/API pattern

- Feature routers mount under `/books`; nested resources use `/:userBookId/<resources>` and apply `requireAuth` per route.
- Controllers parse params/body, derive auth, call services, and return `{ resource }`/`{ resources }`; create is 201, reads 200, and delete is 204.
- `HttpError` uses `{ status, code, message, details }` at the app boundary. Unowned private resources conventionally use `not_found` rather than 403.
- `docs/api.md` is currently a placeholder, so S8-T1 will establish the documented chat contract there without conflicting with an existing API format.

### Existing validation pattern

- Validation is handwritten with `unknown` input, record checks, allowlisted fields, UUID guards, trimming, deliberate maximum lengths, and `badRequest` errors. No validation dependency is installed.
- Notes use a 10,000-character plain-text limit and reject NUL/HTML. Chat will reuse this deliberate bound: it accommodates quoted passages and developed philosophical questions while bounding storage and later model input.

### Existing test pattern

- Tests are colocated TypeScript `node:test` files with `node:assert/strict`.
- Database service tests replace methods on the singleton Prisma client and restore them; there is no separate integration-test database strategy or route-test convention.
- Package test scripts compile before execution, but repository policy forbids builds. Node 22 source execution works with a temporary extensionless-import resolver at `/tmp/sophia-typescript-loader.mjs`, allowing requested focused tests without build output.

### Recommended smallest implementation

- Add `backend/src/chat/` with controlled types, DTO validation, mapper, ownership-first service, thin controller, authenticated router, and colocated DTO/service/controller-or-route tests.
- Mount the router under `/books` in `app.ts`.
- Reuse the existing schema without migration. Derive `userId`/`bookId` from the authenticated owner and `UserBook`; never accept them from input.
- List sessions by `createdAt DESC, id DESC`; return messages by `createdAt ASC, id ASC`. Both server-generated keys form deterministic total orders; equal timestamps are resolved by UUID and no client can set either key.
- Create only user messages from HTTP. Map only user/assistant roles to public DTOs. Document the future internal assistant method rather than adding unused provider/orchestration code.
- Delete a session with one ownership-scoped `deleteMany`; the existing foreign-key cascade removes messages in the same database statement.
- Do not paginate yet because current sibling nested-resource lists are unpaginated and S8-T1 requires only the foundation. Avoid loading messages in session lists; add pagination when product volume/UX requirements exist.

## Threat model

| Boundary/asset | Abuse case | Required control |
| --- | --- | --- |
| Authenticated request to chat service | Body/params spoof another user | Derive identity only from authenticated request context. |
| Shared `Book` with multiple owners | One owner enumerates another owner's chat | Authorize through `UserBook.userId`; return 404 for unowned/mismatched resources. |
| Message creation input | Client forges assistant/system/tool/developer role or ordering | Accept an allowlisted body containing content only; server assigns user role and order. |
| Private message persistence | Content leaks through logs/errors/traces | Never log content; expose controlled DTOs and generic established errors. |
| Concurrent message writes | Duplicate/ambiguous order | Use the smallest database-backed unique ordering strategy proven safe by the audit. |
| Session deletion | Orphaned messages/partial delete | Use verified cascade or an atomic transaction matching schema conventions. |

## Implemented contract

- Routes: authenticated create/list/get/delete session operations and authenticated user-message creation under `/books/:userBookId/chat-sessions`.
- DTOs: session `{ id, createdAt, updatedAt }`; message `{ id, role, content, createdAt }`; session detail embeds ordered messages.
- Validation: session body omitted or empty only; message body contains only 1-10,000 character trimmed plain-text `content`.
- Ownership: all session reads/writes use authenticated `userId`, requested `userBookId`, and the `UserBook.userId` relation. Creation first resolves the owned `UserBook` and derives `bookId`.
- Roles: HTTP creation always writes Prisma `USER`; public reads allowlist only `USER` and `ASSISTANT`.
- Ordering: sessions `createdAt DESC, id DESC`; messages `createdAt ASC, id ASC`.
- Persistence: no migration; one scoped hard delete uses the existing session-message cascade.
- Assistant boundary: documented for S8-T2 and intentionally not implemented without a caller.
- Evaluation: no new AI evaluation case. Deterministic API/service tests are the correct S8-T1 boundary; the existing AI suite remains a regression gate.

## Review outcome

- Correctness: all route handlers map to the intended service operation and response status/envelope; invalid or unowned identifiers return fixed 404s.
- Security/privacy: identity is derived only from auth context, same-Book users remain isolated by `UserBook`, client role/order/identity/AI fields are rejected, and production chat code contains no logging or AI/runtime calls.
- API/architecture: controllers are thin; services own authorization/query behavior; Prisma results are explicitly selected and mapped into allowlisted DTOs.
- Performance/consistency: lists do not load messages, get-one loads ordered messages in one nested query, no N+1 query exists, and cascade deletion is one atomic database statement.
- Scope: no schema, migration, dependency, frontend, provider, prompt, context, RAG, memory, streaming, or unrelated refactor was added.
- Known limitation: session and message lists are unpaginated to match current nested-resource conventions; product pagination remains a future contract change.
