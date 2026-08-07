# S7-T7 Evaluation Seeds — Verification

## Fresh baseline

- Command: `npm run test:ai-all --prefix backend`
- Exit status: `0`
- Relevant result: all 153 existing S7-T1 through S7-T6 constituent unit/evaluation cases passed before S7-T7 implementation. Node emitted the existing experimental MockTimers warning during Gemini timeout tests; no test failed.

## Final executable gates

All commands ran from `/home/ziyad/projects/sophia` on 2026-08-07.

| Command | Exit | Relevant output |
| --- | ---: | --- |
| `npm run test:evaluation-seeds --prefix backend` | 0 | 7/7 new runtime, cross-layer, provider-replacement, and privacy seeds passed. |
| `npm run eval:ai --prefix backend` | 0 | All 60 globally identified deterministic evaluations passed across six files. |
| `npm run test:ai --prefix backend` | 0 | 46/46 provider-registry, structured-output, runtime, fake-provider, and trace unit regressions passed. |
| `npm run test:gemini --prefix backend` | 0 | 26/26 S7-T2 configuration, fake-transport adapter, and composition regressions passed. Node emitted the existing experimental MockTimers warning. |
| `npm run test:prompt-all --prefix backend` | 0 | 13 prompt units and 11 prompt evaluations passed; 24/24. |
| `npm run test:context-all --prefix backend` | 0 | 15 context units and 13 context evaluations passed; 28/28. |
| `npm run test:structured-output-all --prefix backend` | 0 | 14 structured-output unit/contract tests and 10 evaluations passed; 24/24. |
| `npm run test:tracing-all --prefix backend` | 0 | 14 tracing units and 8 tracing evaluations passed; 22/22. |
| `npm run test:ai-all --prefix backend` | 0 | 160/160 constituent AI unit/evaluation cases passed with every eval file executed once. |
| `npm test --prefix backend` | 0 | Complete backend command passed all 124 named tests plus the existing preference helper assertions. Node emitted only the existing MockTimers warning. |
| `npm run typecheck --prefix backend` | 0 | `tsc --noEmit` completed with no diagnostics. |
| `frontend/node_modules/.bin/oxlint backend/src` | 0 | No S7-T7 findings. Two pre-existing warnings remain in `processing/pdf-text.ts:45` and `processing/processing.service.ts:539`. |
| `npm run build --prefix backend` | 0 | `tsc -p tsconfig.build.json` completed with no diagnostics. |
| `node --test-name-pattern='S7-PRIVACY-001' backend/dist/src/ai/evaluation-seeds.eval.test.js` | 0 | The explicit privacy regression passed 1/1. |

## Static privacy, network, and provider gates

| Command | Exit | Relevant output |
| --- | ---: | --- |
| `rg -n '(fetch\(|node:http|node:https|axios|createGeminiSDKClient\(|new GoogleGenAI|process\.env)' backend/src/ai --glob '*.eval.test.ts'` | 1 | Expected no matches: evaluations contain no network/client construction or environment access. |
| `rg -n '(GEMINI_API_KEY|apiKey|@google/genai)' backend/src/ai --glob '*.eval.test.ts'` | 1 | Expected no matches: evaluations need no API key or vendor import. |
| `rg -n '(toMatchSnapshot|snapshot|golden|LLM-as-judge|semantic similarity|BLEU|ROUGE|latency threshold)' backend/src/ai --glob '*.eval.test.ts'` | 1 | Expected no matches: no snapshots, goldens, subjective scoring, or fake latency threshold. |
| `rg -n '(console\.|logger|\.log\()' backend/src/ai --glob '*.eval.test.ts'` | 1 | Expected no matches: evaluation code emits no private logger metadata. |
| `rg -n 'from "@google/genai"|require\("@google/genai"\)' backend/src` | 0 | Exactly one match remains in `providers/gemini/gemini-sdk-client.ts`. |
| `rg -n '(@google/genai|providers/gemini|Gemini)' backend/src/ai/contracts.ts backend/src/ai/errors.ts backend/src/ai/ai-runtime.ts backend/src/ai/structured-output.ts backend/src/ai/prompts backend/src/ai/context backend/src/ai/tracing --glob '!*.test.ts' --glob '!*.eval.test.ts'` | 1 | Expected no matches: shared production boundaries remain provider-neutral. |
| `rg -n 'JSON\.parse' backend/src/ai` | 0 | Exactly one match remains at the Gemini adapter boundary. |

Case inventory commands:

```sh
rg --files backend/src/ai | rg '\.eval\.test\.ts$' | sort
rg -o '^test\("S7-[A-Z-]+-[0-9]{3}' backend/src/ai --glob '*.eval.test.ts' | wc -l
rg -o 'test\("S7-[A-Z-]+-[0-9]{3}' backend/src/ai --glob '*.eval.test.ts' | sed 's/.*test("//' | sort | uniq -d
```

All exited `0`. They listed the six files invoked by `eval:ai`, counted 60
cases, and returned no duplicate IDs.

## Diff and scope gates

| Command | Exit | Relevant output |
| --- | ---: | --- |
| `git diff --check` | 0 | No whitespace errors. |
| `git diff --quiet -- backend/package-lock.json package-lock.json frontend/package-lock.json` | 0 | No dependency or lockfile change. |
| `git status --short --untracked-files=all` | 0 | Only the new seed, inherited eval title updates, package scripts, AI runtime docs, and S7-T7 task records are changed. |

## Verification conclusion

Every requested executable and static gate passed. All evaluations used local fakes or fake transports; no external AI or network call occurred and no credential was read.
