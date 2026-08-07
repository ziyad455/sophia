# S7-T5 Structured Output Contracts — Findings

## Skills discovered

Installed project skills include API/interface design, code review, context compression, documentation/ADRs, evaluation, filesystem context, harness engineering, incremental implementation, planning/task breakdown, planning with files, prompt engineering, security/hardening, Sophia backend and verification, spec-driven development, TDD, tool design, and verification before completion, plus unrelated frontend/performance/design skills.

The requested `using-agent-skills` and `debugging-and-error-recovery` skills are not installed.

## Skills selected and influence

- `planning-with-files`, `filesystem-context`, `context-compression`: durable audit/plan/progress records, concise large-file handling, and no repeated reads.
- `spec-driven-development`, `planning-and-task-breakdown`: acceptance criteria and dependency-ordered phases before code.
- `api-and-interface-design`, `tool-design`: a hard-to-misuse typed boundary with consistent errors and no duplicate surface.
- `tdd`, `incremental-implementation`: behavior-first cases at the public seam, followed by the smallest implementation slice.
- `security-and-hardening`, `harness-engineering`: model output is untrusted; evaluators are locked; raw/private output cannot enter safe errors.
- `evaluation`, `sophia-verification-engineer`: deterministic offline cases in the existing evaluation system.
- `sophia-backend-engineer`: provider abstraction, TypeScript, simple services, and no provider coupling at callers.
- `documentation-and-adrs`, `code-review-and-quality`, `verification-before-completion`: document rationale, review five axes, and avoid unsupported completion claims.
- `prompt-engineering-patterns`: provider schema metadata may guide generation but never replaces application validation.

## Instruction conflicts

- The task asks Codex to execute strict red-green cycles and fresh tests/build. Project `AGENTS.md` forbids builds and says to stop after implementation with commands for the user. Project instructions control; test cases will be authored first, but no passing/build claim will be made without later user-run evidence.
- Skill defaults that require commits or human plan approval before implementation are advisory here; the user supplied an explicit detailed specification, and `.git` is read-only.
- No subagents are used because current orchestration policy forbids delegation unless explicitly requested.

## Audit questions

1. **S7-T1 already provides:** `StructuredOutputSchema<T>`, optional provider-neutral JSON Schema metadata, `AIRequest<T>` structured requirements, normalized structured provider values, `validateStructuredOutput`, `AIRuntime` validation, typed `AIResponse<T>`, safe provider response allowlisting, and the deterministic `FakeAIProvider` queue.
2. **GeminiProvider already provides:** structured-mode request mapping, a documented Gemini JSON Schema subset check, `application/json` guidance, the only AI-module `JSON.parse`, malformed/empty response handling, and conversion to an unknown normalized value. It deliberately does not run the application validator.
3. **Runtime validation location:** `AIRuntime.generate` calls `validateStructuredOutput` after provider response validation and before returning the value. This is the authoritative trust boundary.
4. **Can feature code define a schema safely?** Partially. A feature can create a typed `StructuredOutputSchema<T>`, but the contract has only a name, no explicit application output version, no definition validation, and mutation/validator-result hardening is incomplete.
5. **Can feature code receive strongly typed validated output?** Partially. `AIRuntime.generate<T>` returns validated `AIResponse<T>`, but callers must select the generic, construct the low-level `{ type, schema }` requirement, and narrow the text/structured output union. There is no typed `generateStructured` result with direct trusted data.
6. **Duplicated parsing/validation:** No feature-level duplicate exists. JSON parsing occurs once, inside `GeminiProvider`, because parsing provider wire text is adapter responsibility. Runtime validation occurs once in `AIRuntime`. S7-T5 must preserve this split.
7. **Raw response exposure:** Raw Gemini SDK responses/candidates are allowlisted away. `AIProviderResponse.output.value` is visible only across the provider/runtime internal boundary before validation. Feature code receives only normalized runtime responses.
8. **Does code trust parsed JSON?** Gemini parsed values remain `unknown` and are validated by `AIRuntime`; no parsed model JSON is trusted directly. However, `validateStructuredOutput` currently trusts the validator result shape after the callback returns, so a malformed result can escape as a raw error or an invalid success value.
9. **Provider schema coupling:** Shared JSON Schema metadata is `Readonly<Record<string, unknown>>` and contains no Gemini SDK type. Gemini-specific subset validation/conversion stays in `providers/gemini`.
10. **Actual Sprint 8 gap:** a stable exact-versioned application definition, a hard-to-misuse typed `generateStructured` boundary, safe definition/result validation, dedicated invalid-model-output classification, and deterministic contract/evaluation coverage. Parsing, provider guidance, and the core trust boundary already exist.

## Existing unsafe behavior

- `validateStructuredOutput` exposes arbitrary validator `issues` in enumerable `AIError.details`. A validator that embeds generated passages, notes, or highlights can leak them through a safe error.
- Validator-result reflection happens outside the guarded callback block; malformed/proxy results can escape as `TypeError` or other raw exceptions.
- `invalid_response` currently combines malformed provider envelopes with invalid model-generated structures. S7-T5 will add the narrower `invalid_output` code for empty/malformed/wrong-shaped structured results while retaining `invalid_response` for provider envelope/mode failures.

## Architecture decision

- Keep `StructuredOutputSchema<T>` as the low-level S7-T1 runtime validator and provider-guidance carrier.
- Add a directly imported `StructuredOutputDefinition<T>` containing stable `id`, exact `version`, internal `description`, the existing runtime schema, and optional existing JSON Schema metadata.
- Add `AIRuntime.generateStructured` as a thin typed facade over `generate`; it captures/validates the definition before provider invocation and returns `data` plus normalized metadata and exact output identity/version.
- Do not add a registry. Output definitions are compile-time dependencies selected directly by the owning feature; there is no persistence lookup, dynamic selection, or cross-feature resolution requirement. Multiple exported constants can coexist as v1/v2 without a mutable registry or silent latest selection.
- Keep provider JSON parsing exactly where it is. JSON Schema remains optional generation guidance; only `StructuredOutputSchema.validate` establishes trust.
- Do not introduce generic repair/coercion. Bounds, enums, strict objects, nesting, and normalization are explicit per-definition validator policy.

## Static code review

- Correctness: the initial definition guard could coerce numeric IDs/versions through `RegExp.test`; explicit string checks and regression inputs were added.
- Error recovery: access to `request.output` is guarded so hostile definition reflection becomes a fixed `invalid_request` rather than a raw exception.
- Architecture: the implementation extends the existing root structured-output helper and `AIRuntime`; it adds no registry, parser, provider abstraction, dependency, route, or feature logic.
- Security/privacy: arbitrary validator issues were removed from public error details, malformed validator results are normalized, and structured content failures have the separate `invalid_output` category.
- Provider neutrality: a targeted shared-boundary search found no `any`, Gemini SDK import, `JSON.parse`, or raw response field. The only match was the intentional validator-result `issues` type in `contracts.ts`.
- Evaluation: ten synthetic offline structured-contract cases were added to the existing `test:ai-evals` command; existing Gemini malformed-JSON evaluation remains the adapter-level case.
- Verification limitation: this is a static review only. TypeScript, tests, lint, diff check, and build were not run.

## Prior context reused cautiously

- S7-T3 established exact ID/version resolution, explicit instance ownership, privacy-safe errors, and no provider/runtime imports in prompt definitions.
- S7-T4 established a deterministic provider/runtime-free context boundary and strict infrastructure-only scope.
- These are prior-run notes and will be verified against the current repository before design decisions.

Current repository inspection confirmed both prior boundaries. `docs/plans/s7-t1-ai-provider-interface.md` was found after the initial targeted task-folder search and read in full.
