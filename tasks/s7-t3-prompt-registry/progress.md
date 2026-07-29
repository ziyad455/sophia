# S7-T3 Progress

## 2026-07-29

### Context and skills

- Read the attached S7-T3 specification, `AGENTS.md`, relevant Sophia context,
  AI runtime documentation, existing ADRs, S7-T1 plan, S7-T2 task records, the
  complete production AI module, AI tests/evaluation structure, backend package
  and TypeScript configuration, environment configuration, and logging/error
  conventions.
- Confirmed `SOPHIA_PROJECT.md` and `DESIGN.md` are absent.
- Read the selected skill instructions and relevant prompt-engineering
  references before implementation.
- The initial scanner invocation through `uv` failed because `uv` is not
  installed. Running the inspected scanner directly with `python3` succeeded.
- Rejected `planning-with-files` automation because its scanner findings include
  executable lifecycle hooks and home-directory/config access. Durable task
  files are maintained manually.
- Rejected execution of context-compression helper/tests because the scanner
  reported pytest auto-discovery risk.

### Audit

- Confirmed S7-T1 and S7-T2 are merged and the worktree was clean.
- Created `feature/s7-prompt-registry` from `main`.
- Confirmed no existing prompt abstraction or production prompt exists.
- Classified all prompt-like source matches in `findings.md`.
- Chose the smallest unwired, instance-owned `backend/src/ai/prompts/` module.

### Fresh baseline

- `npm run typecheck --prefix backend` exited 0.
- `npm run test:ai --prefix backend` exited 0; 21 S7-T1 tests passed.
- `npm run test:gemini --prefix backend` exited 0; 26 S7-T2 tests passed
  (4 configuration, 19 provider, 3 composition).
- `npm run test:ai-evals --prefix backend` exited 0; all 11 existing Gemini
  adapter evaluation cases passed.
- Node printed the existing expected ExperimentalWarning for MockTimers.

### TDD evidence

1. Exact registration and rendering:
   - Red: `npm run test:prompts --prefix backend` failed during TypeScript
     compilation with `TS2307` because `./contracts` and
     `./prompt-registry` did not exist.
   - Smallest implementation: add the Sophia-owned definition/result contract,
     capture the validator/renderer, store one exact ID/version, validate the
     happy-path input, and return normalized messages.
   - Green: the focused command exited 0; 1 test passed.
2. Duplicate protection:
   - Red: the focused build failed because the new `./errors` module did not
     exist; the current registry would otherwise overwrite the exact pair.
   - Smallest implementation: add the prompt-domain error taxonomy and reject
     an existing exact ID/version before mutation.
   - Green: 2 focused tests passed.
3. Multiple explicit versions:
   - The new test passed on its first run because the nested exact-version map
     from slice 1 already satisfied the behavior. No production change was
     made and the implementation was not deliberately weakened to manufacture
     a failure.
   - Green: 3 focused tests passed.
4. Missing definitions and identifier/version validation:
   - Red: both new tests failed with `Missing expected exception`; missing
     prompts returned empty messages and invalid identities were accepted.
   - Smallest implementation: validate stable lowercase IDs and canonical
     positive-integer versions on registration/render, then emit
   `prompt_not_found` for a missing exact pair.
   - Green: 5 focused tests passed.
5. Unknown input validation:
   - Red: the new test caught the generic
     `Error: Prompt input validation failed.` instead of the required domain
     error.
   - Smallest implementation: return `invalid_prompt_input` with only the
     already-validated prompt identity and omit validator issues/input.
   - Green: 6 focused tests passed; invalid input never invoked the renderer.
6. Deterministic rendering:
   - The identical-input test passed on its first run because the captured
     code-defined test renderer already returns equivalent messages. No
     production behavior was added.
   - Green: 7 focused tests passed.
7. Rendered-message validation:
   - Red: an empty rendered array returned successfully
     (`Missing expected exception`).
   - Smallest implementation: require a non-empty array of strict plain data
     records with exactly `role` and `content`, a supported role, and non-empty
     string content; reconstruct allowlisted messages and reject SDK/class
     instances or extra fields.
   - Green: 8 focused tests passed across eight invalid rendered shapes.
8. Mutation safety:
   - Red: `Object.isFrozen(result)` was false.
   - Smallest implementation: freeze each reconstructed message, the message
     array, and the controlled result object. Validator and renderer function
     references were already captured at registration.
   - Green: 9 focused tests passed; attempted array/message mutation threw
     `TypeError` and later renders remained unchanged.
9. Privacy-safe exception normalization:
   - Red: a validator's raw `Error` containing private passage text escaped.
   - Smallest implementation: wrap validator and renderer exceptions as fixed
     `prompt_render_failed` errors with safe identity and a non-enumerable
     internal cause.
   - Green: 10 focused tests passed; public/enumerable error content omitted
     the sensitive fixture.
10. Instance isolation:
    - The isolation test passed on its first run because the private map is
      instance-owned. No production change was needed.
    - Green: 11 focused tests passed.
11. Definition boundary:
    - Red: a `null` definition leaked a raw property-access `TypeError`.
    - Smallest implementation: validate definition shape, non-empty
      description, validator, and renderer before registration, using
      `invalid_prompt_definition`.
    - Green: 12 focused tests passed.
12. Public barrel:
    - Red: TypeScript reported `TS2305` for missing public exports.
    - Smallest implementation: add `prompts/index.ts` and re-export the public
      prompt contracts, error types, and registry from `ai/index.ts`.
    - Green: 12 focused tests passed through the public barrel.

### Deterministic prompt evaluation

- Added eleven no-network cases for exact resolution, duplicates, versions,
  missing definitions, invalid input, determinism, rendered validation,
  mutation safety, isolation, privacy-safe errors, and provider-neutral output.
- `npm run test:prompt-evals --prefix backend` exited 0; 11 passed.

### Static boundaries

- Production prompt files matched no Gemini SDK, Gemini adapter, AI provider,
  `AIRuntime`, environment, logging, model, provider-options, or broad `any`
  patterns.

### Review defects corrected with TDD

- Red: the focused suite had three failures:
  - an 80-character canonical version was rejected by the unproven nine-digit
    cap
  - a rendered proxy leaked its private reflection-trap exception
  - a malformed validator result leaked a raw property-access `TypeError`
- Smallest corrections:
  - align canonical integer versions with the audited 80-character Prisma
    `promptVersion` metadata
  - normalize unexpected reflection failures as `invalid_rendered_prompt`
  - validate the validator-result discriminant inside the protected validator
    boundary and normalize malformed results as `prompt_render_failed`
- Green: `npm run test:prompts --prefix backend` exited 0; 13 passed.

### Documentation and review

- Added the versioned prompt module, validation/privacy rules, exact-version
  strategy, error taxonomy, testing/evaluation commands, injection limitations,
  and future feature flow to `docs/ai-runtime.md`.
- Added the accepted code-defined/exact-version ADR to the repository's
  existing `docs/context/architecture-decisions.md` convention.
- Added readonly public definition/input contracts as a green refactor.
- Added `test:prompt-all` and `test:ai-all` commands while preserving the
  existing S7-T1 and S7-T2 standalone commands.
- Review confirmed no production prompt, global registry, application wiring,
  provider setting, model selection, environment read, log, `any`, dependency,
  lockfile change, route, controller, database change, frontend change, or
  unrelated refactor.

### Final verification

- All commands and outputs are recorded in `verification.md`.
- Fresh results: 13 prompt units, 11 prompt evals, 82 combined AI checks, 21
  S7-T1 regressions, 26 S7-T2 regressions, 11 existing Gemini evals, and 84
  complete backend tests passed.
- TypeScript, targeted/full lint, backend build, offline audit, vendor/privacy
  boundary searches, lockfile check, and `git diff --check` completed without
  an S7-T3 failure.
- Full lint still reports only the two documented pre-existing processing
  warnings.

### Defects encountered

None in project code. One repository search command had a shell-quoting error;
it was rerun with safe separate patterns and completed.
