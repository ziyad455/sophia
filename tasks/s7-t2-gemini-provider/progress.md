# S7-T2 Progress

## 2026-07-28

### Context and skills

- Read `AGENTS.md`, relevant `docs/context` files, S7-T1 plan/findings,
  `docs/ai-runtime.md`, backend configuration, TypeScript configuration, AI
  runtime code, tests, package files, and repository history.
- `SOPHIA_PROJECT.md` is not present.
- Discovered all repository skills and selected the four Sophia planning,
  backend, context, and verification skills recorded in `task_plan.md`.

### Audit

- Confirmed S7-T1 is merged and the feature branch starts from clean `main`.
- Confirmed no SDK, Gemini code, cancellation contract, AI composition root, or
  provider configuration exists.
- Confirmed existing structured failures use `invalid_response`.

### Official research

- Verified the official SDK and current API choices using Google-owned sources.
- Selected `models.generateContent` for its exact compatibility with S7-T1.
- Recorded cancellation, JSON Schema, model, and sampling limitations.

### TDD evidence

1. Cancellation contract:
   - Red: added an `AIRuntime` test for an already-aborted request.
   - Command: `npm run build --prefix backend`.
   - Observed: TypeScript rejected both missing `AIRequest.signal` and missing
     `cancelled` error code (`TS2353`, `TS2367`).
   - Smallest correction: add provider-neutral `signal?: AbortSignal`, add the
     normalized `cancelled` category, validate the signal, and reject an
     already-aborted request before provider resolution/invocation.
   - Green: `npm run build --prefix backend` and
     `node backend/dist/src/ai/ai-runtime.test.js` both exited 0; all eight
     runtime tests passed.
2. Gemini configuration:
   - Red: added pure-parser tests for disabled configuration, trimmed required
     values, partial/empty configuration, and timeout bounds.
   - Command: `npm run build --prefix backend`.
   - Observed: compilation failed because `./gemini-config` did not exist
     (`TS2307`).
   - Smallest implementation: local typed configuration, a safe
     `GeminiConfigurationError`, optional configuration only when every Gemini
     variable is absent, and a 1,000-120,000 ms timeout bound with a 30,000 ms
     default.
   - Green: build and the four focused configuration tests exited 0.
3. Provider contract:
   - Red: added a compile-time `AIProvider` assignment and normalized response
     test using a one-method injected SDK client.
   - Command: `npm run build --prefix backend`.
   - Observed: compilation failed because the Gemini provider and SDK boundary
     modules did not exist (`TS2307`).
   - Smallest implementation: stable `gemini` provider identity, explicit
     constructor injection, one-method SDK client boundary, and a normalized
     text response with no raw SDK response attached.
   - Green: build and the focused provider contract test exited 0.
4. Text request mapping:
   - Red: added ordered role/system-instruction mapping plus generation-setting
     assertions and an invalid late-system-instruction case.
   - Command: focused provider test after a successful build.
   - Observed: official-format mapping passed, but the late system instruction
     was silently accepted (`Missing expected rejection`).
   - Smallest implementation: reject a system message after conversation
     content with a safe, non-retryable `invalid_request` before transport.
   - Green: build and all three focused provider tests exited 0.
5. Text response mapping:
   - Red: added empty-output rejection and raw-field allowlisting tests.
   - Command: focused provider test after a successful build.
   - Observed: raw-field allowlisting already passed, but whitespace-only text
     was returned (`Missing expected rejection`).
   - Smallest implementation: require non-whitespace response text and emit a
     safe, non-retryable `invalid_response` without including generated output.
   - Green: build and all five focused provider tests exited 0.
6. Structured request mapping and parsing:
   - Red: added supported JSON Schema mapping, unsupported keyword, and
     malformed JSON cases.
   - Command: focused provider test after a successful build.
   - Observed: all three new cases failed because no structured behavior
     existed; the request config was empty and invalid inputs were accepted.
   - Smallest implementation: map the documented Gemini JSON Schema subset to
     `responseMimeType`/`responseJsonSchema`, reject unsupported constructs
     before transport, parse JSON safely, and return normalized structured data
     without invoking the schema validator inside the adapter.
   - Green: build and all eight focused provider tests exited 0.
7. Mandatory runtime validation integration:
   - Added a Gemini-through-`AIRuntime` integration test covering valid JSON,
     valid JSON with the wrong shape, and empty structured output.
   - This test passed on its first run because the preceding adapter parsing
     cycle and S7-T1's existing authoritative validator already compose
     correctly; no additional production behavior was added.
   - Result: all nine focused provider tests passed.
8. Usage and finish reasons:
   - Red: added complete/partial usage cases and a Gemini finish-reason table.
   - Command: focused provider test after a successful build.
   - Observed: finish-reason cases passed, but complete SDK usage was omitted
     from the normalized result.
   - Smallest implementation: map usage only when all three SDK counts are
     safe non-negative integers; omit partial metadata rather than deriving or
     fabricating values.
   - Green: build and all eleven focused provider tests exited 0.
9. Error normalization:
   - Red: added numeric SDK status mapping, transport-code fallback, unknown
     failure sanitization, and empty safety-blocked output cases.
   - Command: focused provider test after a successful build.
   - Observed: raw provider/transport errors escaped and safety blocking was
     misclassified as `invalid_response`.
   - Smallest implementation: prefer structured numeric status, narrowly map
     known transport codes, preserve the original cause internally, use fixed
     safe messages/retryability, and classify empty blocked output as
     `content_filtered`.
   - Green: build and all fourteen focused provider tests exited 0.
10. Cancellation and timeout:
   - Red: added already-aborted, active cancellation, deterministic mocked-clock
     timeout, and listener/timer cleanup tests.
   - Command: focused provider test after a successful build.
   - Observed: all four cases failed; requests carried no SDK abort signal,
     already-aborted work reached transport, and abort-like errors became
     `provider_failure`.
   - Smallest implementation: create one per-request controller, forward caller
     cancellation, enforce the validated deadline, distinguish cancellation
     from timeout by private abort reasons, and clean both timer and listener in
     `finally`.
   - Green: build and all eighteen focused provider tests exited 0.
11. Registration and composition:
   - Red: added explicit registration, missing-configuration, and duplicate
     protection tests.
   - Command: `npm run build --prefix backend`.
   - Observed: compilation failed because `./composition` did not exist
     (`TS2307`).
   - Smallest implementation: explicit `createGeminiAIRuntime`, optional
     injected registry/client, one registered `gemini` provider, server-owned
     default selection, and SDK client construction only inside the invoked
     factory. Central config now parses optional Gemini environment settings;
     example values remain commented out.
   - Green: build and all three focused composition tests exited 0.

### Deterministic evaluation baseline

- Added eleven fake-transport cases covering request mapping, response mapping,
  schema guidance, malformed JSON, wrong-shaped JSON, raw-field allowlisting,
  authentication, rate limiting, cancellation, missing usage, and provider
  replacement.
- No evaluation case contains credentials or performs external I/O.
- Fresh command `npm run test:ai-evals --prefix backend` exited 0 with all
  eleven cases passing.

### Defects encountered

- Review red cycle found three boundary gaps:
  - a system-only request produced an empty Gemini `contents` array
  - a `$ref` schema node could include a non-`$` sibling unsupported by the SDK
  - Node fetch-style network codes nested under `Error.cause` were missed
- Focused tests failed in all three cases. The adapter now rejects empty mapped
  content, enforces Gemini's `$ref` sibling rule, and reads a network code from
  either the top-level error or one controlled cause level.

### Documentation and review

- Updated `docs/ai-runtime.md` with the SDK/API choice, provider boundary,
  configuration, composition, mapping, allowlisting, structured validation,
  errors, cancellation, privacy, tests, and explicit exclusions.
- Added the `generateContent` adapter ADR to
  `docs/context/architecture-decisions.md`.
- Review searches confirmed one vendor import in the SDK client, centralized
  environment access, no adapter logging, no `any`, no unrestricted options,
  no global registry/singleton, and no import-time client construction.
