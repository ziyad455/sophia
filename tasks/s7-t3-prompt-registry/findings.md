# S7-T3 Findings

## Repository Audit

- Work began from clean `main` at `d33e6bb`, after merged S7-T1 and S7-T2,
  then moved to `feature/s7-prompt-registry`.
- `SOPHIA_PROJECT.md`, `DESIGN.md`, `.adr-dir`, and a dedicated ADR directory
  are absent. The established ADR convention is append-only sections in
  `docs/context/architecture-decisions.md`.
- `AIProvider` receives `AIRequest<unknown>` and returns
  `AIProviderResponse`.
- `AIRuntime.generate()` validates request messages, resolves the configured
  provider from an instance-owned `AIProviderRegistry`, normalizes failures,
  allowlists response fields, and performs authoritative structured-output
  validation.
- `AIMessage` is Sophia-owned and contains only `role` (`system`, `user`, or
  `assistant`) and string `content`.
- S7-T1's runtime validation contract is
  `StructuredOutputValidationResult<T>` with a deterministic
  `validate(unknown)` function.
- `AIError` is transport-independent, uses stable codes and retryability, keeps
  unknown causes internal, and uses fixed public messages.
- `AIProviderRegistry` validates lowercase stable IDs, rejects duplicates, and
  is explicitly instantiated. No global registry exists.
- Gemini code and SDK types are isolated under
  `backend/src/ai/providers/gemini/`; only composition imports that adapter.
- `FakeAIProvider` is deterministic and performs no network, environment,
  filesystem, database, or logging work.
- Gemini configuration is optional, parsed centrally from the server
  environment, and used only by explicit composition.
- Dependency injection is manual through constructors, options, narrow client
  interfaces, and factories. There is no DI framework.
- Tests are colocated TypeScript `*.test.ts` files using `node:test` and
  `node:assert/strict`. Backend scripts compile them before executing the
  emitted JavaScript.
- The existing deterministic evaluation is
  `gemini-provider.eval.test.ts`, run directly with Node through
  `test:ai-evals`; it uses a fake SDK boundary and no network.
- The backend has no lint script. Existing task convention invokes the
  frontend-installed Oxlint binary against `backend/src`.
- AI runtime/provider modules do not log. Backend logging is limited to startup
  and unrelated processing/book warnings.

## Prompt Search and Classification

No prompt registry, definition contract, prompt builder, production philosophy
prompt, prompt service, or prompt application wiring exists.

| Location | Classification | Finding |
| --- | --- | --- |
| `backend/src/ai/ai-runtime.test.ts` | Test fixture | Normalized system/user messages such as explanation requests exercise S7-T1. |
| `backend/src/ai/providers/gemini/*.test.ts` | Test fixture | Synthetic system/user/assistant content verifies adapter mapping and safe errors. |
| `backend/src/ai/providers/gemini/*.eval.test.ts` | Test fixture | Deterministic no-network evaluation content verifies the adapter boundary. |
| `backend/src/ai/testing/fake-ai-provider.ts` | Test harness fixture | Stable fallback output; not a product prompt. |
| `backend/src/ai/providers/gemini/gemini-provider.ts` | Provider mapping and error messages | `systemInstruction` is an SDK request field. Fixed strings report mapping/transport failures; the adapter owns no product prompt. |
| `backend/src/ai/contracts.ts` | User-content transport | `AIMessage.content` carries caller-provided normalized text but contains no literal prompt. |
| `docs/`, `README.md`, `AGENTS.md` | Documentation/product prose | Describes future prompts, AI behavior, and agent instructions; it is not runtime prompt construction. |
| `backend/prisma/schema.prisma` | Dormant persistence metadata | `ChapterSummary.promptVersion` exists for a later feature; no current service uses it and S7-T3 adds no persistence. |
| `frontend/src` | Unrelated UI copy | Reflection wording belongs to notes/profile UI and is not sent to AI. |
| lockfiles | Unrelated dependency metadata | The package name `prompts` is transitive frontend tooling, not Sophia prompt architecture. |

## Risks and Controls

- Unknown input can contain passages, notes, highlights, or reflections.
  Validation errors must not echo values or validator issues.
- Validator/renderer exceptions can carry private text. Public prompt messages
  stay fixed; causes are internal and must not be serialized or logged.
- Returning the definition or its original message objects would expose
  validators and allow mutation. The registry will reconstruct and freeze only
  controlled fields.
- Returning “latest” or overwriting duplicates would make behavior
  irreproducible. Only exact positive integer versions are accepted.
- Accepting arbitrary objects or extra message fields could allow SDK objects
  or caller-defined roles through. Rendered messages will be strict plain
  records with exactly `role` and `content`.
- A registry can structurally separate trusted instructions and untrusted
  content, but cannot fully prevent prompt injection. Documentation must not
  claim otherwise.
- No product consumer exists, so adding application composition or placeholder
  prompt registration would be unused architecture and is intentionally
  excluded.

## Skill Security Findings

- Automated scanning with
  `.agents/skills/skill-scanner/scripts/scan_skill.py` completed for all
  selected generic workflow skills.
- `prompt-engineering-patterns` had zero findings. Its helper source was also
  inspected manually; it is not needed or executed.
- `planning-with-files` had seven critical scanner findings for executable
  lifecycle hooks and home-directory/config access. Its automation is rejected;
  only manual Markdown planning is used.
- `context-compression` had one high scanner finding for pytest auto-discovery.
  Its code/tests are not executed; only the structured artifact-trail guidance
  is used.
- Scanner URL notices in security/filesystem documentation are inert examples.
  No external content or helper execution is required.

## Decisions

- Own prompts under `backend/src/ai/prompts/`, next to but independent from the
  runtime and providers.
- Reuse S7-T1 validation types rather than add a package or second validation
  result shape.
- Keep prompt-domain errors separate from `AIError`.
- Use exact ID/version `render()` as the only definition-resolution outcome;
  do not expose a public method that returns definitions.
- Add no application composition until a production definition is introduced
  by a later feature.

## Implemented Architecture

- `PromptDefinition<TInput>` is a readonly code-defined contract with exact
  identity, description, an S7-T1-compatible validator, and a normalized
  message renderer.
- `PromptRegistry` owns a private nested ID/version map. Registration is
  explicit and duplicate exact pairs are rejected.
- Prompt IDs use the provider registry's stable lowercase grammar and
  64-character limit.
- Versions are canonical positive integer strings up to 80 characters, matching
  the existing future Prisma `promptVersion` metadata. There is no “latest,”
  alias, range, or registration-order resolution.
- Definitions are captured into one private `validateAndRender(unknown)`
  closure. The original definition, schema, input, and map are never returned.
- Input failures omit validator issues. Validator/renderer exceptions are
  normalized with fixed messages and only a non-enumerable internal cause.
- Rendered messages must be non-empty strict plain records with exactly
  allowlisted role/content fields. Reflection/proxy failures are normalized.
- Result objects, arrays, and reconstructed messages are frozen and freshly
  allocated per render.
- `PromptError` is independent of `AIError`, providers, Gemini, Express, and
  HTTP status codes.
- The registry is exported publicly but has no production instance,
  composition, route, or prompt definition.

## Review Verdict

- Correctness: exact resolution, validation, duplicates, versions, errors, and
  mutation/isolation behavior are covered.
- Readability/simplicity: six focused module files, no dependency, no template
  engine, and one public registry operation for rendering.
- Architecture: provider-neutral, instance-owned, no import-time registration,
  and no feature/application wiring.
- Security/privacy: unknown input and rendered output are validated; safe
  messages omit private content; no prompt logging or environment access.
- Performance: bounded map lookups and message-array validation; no I/O or
  unbounded background work.
- Three review defects were corrected with regression tests: the version limit
  now follows audited metadata, malformed validator results are normalized, and
  reflection traps cannot leak raw errors.
- No required review findings remain.
