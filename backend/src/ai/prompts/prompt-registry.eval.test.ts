import assert from "node:assert/strict";
import test from "node:test";
import type { AIMessage } from "../contracts";
import {
  type PromptDefinition,
  PromptError,
  PromptRegistry,
} from "../index";

type EvaluationInput = {
  text: string;
};

function definition(
  version = "1",
  prefix = "Version 1",
): PromptDefinition<EvaluationInput> {
  return {
    id: "evaluation-prompt",
    version,
    description: "A deterministic evaluation-only prompt.",
    inputSchema: {
      validate(value) {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          typeof (value as Record<string, unknown>).text === "string" &&
          (value as Record<string, string>).text.trim().length > 0
        ) {
          return {
            success: true,
            value: {
              text: (value as Record<string, string>).text,
            },
          };
        }

        return {
          success: false,
          issues: ["text is invalid"],
        };
      },
    },
    render(input) {
      return [
        {
          role: "system",
          content: "Evaluation instruction.",
        },
        {
          role: "user",
          content: `${prefix}: ${input.text}`,
        },
      ];
    },
  };
}

test("S7-PROMPT-001 [prompt]: exact ID and version resolve deterministically", () => {
  const registry = new PromptRegistry();

  registry.register(definition());

  const result = registry.render("evaluation-prompt", "1", { text: "Input" });

  assert.equal(result.promptId, "evaluation-prompt");
  assert.equal(result.promptVersion, "1");
  assert.equal(result.messages[1]?.content, "Version 1: Input");
});

test("S7-PROMPT-002 [prompt]: duplicate exact registration is rejected", () => {
  const registry = new PromptRegistry();

  registry.register(definition());

  assert.throws(
    () => registry.register(definition()),
    (error: unknown) =>
      error instanceof PromptError &&
      error.code === "duplicate_prompt",
  );
});

test("S7-PROMPT-003 [prompt]: explicit versions remain independent", () => {
  const registry = new PromptRegistry();

  registry.register(definition("1", "Version 1"));
  registry.register(definition("2", "Version 2"));

  assert.equal(
    registry.render("evaluation-prompt", "1", { text: "Input" }).messages[1]
      ?.content,
    "Version 1: Input",
  );
  assert.equal(
    registry.render("evaluation-prompt", "2", { text: "Input" }).messages[1]
      ?.content,
    "Version 2: Input",
  );
});

test("S7-PROMPT-004 [prompt]: a missing exact definition fails safely", () => {
  const registry = new PromptRegistry();

  assert.throws(
    () => registry.render("evaluation-prompt", "1", { text: "Input" }),
    (error: unknown) =>
      error instanceof PromptError &&
      error.code === "prompt_not_found",
  );
});

test("S7-PROMPT-005 [prompt]: invalid input never reaches the renderer", () => {
  const registry = new PromptRegistry();
  let renderCalls = 0;
  const prompt = definition();
  const originalRender = prompt.render;

  registry.register({
    ...prompt,
    render(input) {
      renderCalls += 1;
      return originalRender(input);
    },
  });

  assert.throws(
    () => registry.render("evaluation-prompt", "1", { text: 42 }),
    (error: unknown) =>
      error instanceof PromptError &&
      error.code === "invalid_prompt_input",
  );
  assert.equal(renderCalls, 0);
});

test("S7-PROMPT-006 [prompt]: identical input produces equivalent messages", () => {
  const registry = new PromptRegistry();
  const input = { text: "Same input" };

  registry.register(definition());

  assert.deepEqual(
    registry.render("evaluation-prompt", "1", input),
    registry.render("evaluation-prompt", "1", input),
  );
});

test("S7-PROMPT-007 [prompt]: invalid rendered messages are rejected", () => {
  const registry = new PromptRegistry();

  registry.register({
    ...definition(),
    render: () =>
      [{ role: "tool", content: "Invalid." }] as unknown as readonly AIMessage[],
  });

  assert.throws(
    () => registry.render("evaluation-prompt", "1", { text: "Input" }),
    (error: unknown) =>
      error instanceof PromptError &&
      error.code === "invalid_rendered_prompt",
  );
});

test("S7-PROMPT-008 [prompt]: render results are mutation-safe", () => {
  const registry = new PromptRegistry();

  registry.register(definition());

  const result = registry.render("evaluation-prompt", "1", { text: "Input" });

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.messages), true);
  assert.equal(Object.isFrozen(result.messages[0]), true);
  assert.throws(
    () => {
      (result.messages as AIMessage[]).length = 0;
    },
    TypeError,
  );
});

test("S7-PROMPT-009 [prompt]: registry instances do not share state", () => {
  const first = new PromptRegistry();
  const second = new PromptRegistry();

  first.register(definition());

  assert.throws(
    () => second.render("evaluation-prompt", "1", { text: "Input" }),
    (error: unknown) =>
      error instanceof PromptError &&
      error.code === "prompt_not_found",
  );
});

test("S7-PROMPT-010 [prompt]: errors omit private input and validator issues", () => {
  const registry = new PromptRegistry();

  registry.register({
    ...definition(),
    inputSchema: {
      validate: () => ({
        success: false,
        issues: ["private-note-value must never be exposed"],
      }),
    },
  });

  assert.throws(
    () =>
      registry.render("evaluation-prompt", "1", {
        text: "private-passage-value",
      }),
    (error: unknown) =>
      error instanceof PromptError &&
      error.message === "The prompt input is invalid." &&
      JSON.stringify(error).includes("private-note-value") === false &&
      JSON.stringify(error).includes("private-passage-value") === false,
  );
});

test("S7-PROMPT-011 [prompt]: output exposes no provider or model selection", () => {
  const registry = new PromptRegistry();

  registry.register(definition());

  const result = registry.render("evaluation-prompt", "1", { text: "Input" });

  assert.deepEqual(Object.keys(result), [
    "promptId",
    "promptVersion",
    "messages",
  ]);
  assert.equal(Object.hasOwn(result, "providerId"), false);
  assert.equal(Object.hasOwn(result, "model"), false);
  assert.equal(Object.hasOwn(result, "providerOptions"), false);
});
