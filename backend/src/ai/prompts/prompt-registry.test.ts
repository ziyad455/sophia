import assert from "node:assert/strict";
import test from "node:test";
import type { AIMessage } from "../contracts";
import {
  type PromptDefinition,
  PromptError,
  PromptRegistry,
} from "../index";

type TestPromptInput = {
  subject: string;
};

type ValidatedPromptInput = {
  subject: string;
  mode: "brief" | "deep";
  context: {
    page: number;
  };
};

function testDefinition(
  version = "1",
): PromptDefinition<TestPromptInput> {
  return {
    id: "test-prompt",
    version,
    description: "A deterministic test-only prompt.",
    inputSchema: {
      validate(value) {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          typeof (value as Record<string, unknown>).subject === "string"
        ) {
          return {
            success: true,
            value: {
              subject: (value as Record<string, string>).subject,
            },
          };
        }

        return {
          success: false,
          issues: ["subject must be a string"],
        };
      },
    },
    render(input) {
      return [
        {
          role: "system",
          content: "Use the supplied test subject.",
        },
        {
          role: "user",
          content: input.subject,
        },
      ];
    },
  };
}

test("registers and renders one definition by exact prompt ID and version", () => {
  const registry = new PromptRegistry();

  registry.register(testDefinition());

  assert.deepEqual(
    registry.render("test-prompt", "1", {
      subject: "A deterministic subject.",
    }),
    {
      promptId: "test-prompt",
      promptVersion: "1",
      messages: [
        {
          role: "system",
          content: "Use the supplied test subject.",
        },
        {
          role: "user",
          content: "A deterministic subject.",
        },
      ],
    },
  );
});

test("rejects duplicate prompt ID and version registration", () => {
  const registry = new PromptRegistry();

  registry.register(testDefinition());

  assert.throws(
    () => registry.register(testDefinition()),
    (error: unknown) =>
      error instanceof PromptError &&
      error.code === "duplicate_prompt" &&
      error.promptId === "test-prompt" &&
      error.promptVersion === "1",
  );
});

test("keeps multiple explicit versions of one prompt independently resolvable", () => {
  const registry = new PromptRegistry();

  registry.register(testDefinition("1"));
  registry.register({
    ...testDefinition("2"),
    render(input) {
      return [
        {
          role: "user",
          content: `Version 2: ${input.subject}`,
        },
      ];
    },
  });

  assert.deepEqual(
    registry.render("test-prompt", "1", { subject: "Subject" }).messages,
    [
      {
        role: "system",
        content: "Use the supplied test subject.",
      },
      {
        role: "user",
        content: "Subject",
      },
    ],
  );
  assert.deepEqual(
    registry.render("test-prompt", "2", { subject: "Subject" }).messages,
    [
      {
        role: "user",
        content: "Version 2: Subject",
      },
    ],
  );
});

test("rejects unknown prompt IDs and versions with controlled exact-resolution errors", () => {
  const registry = new PromptRegistry();

  registry.register(testDefinition());

  for (const [promptId, promptVersion] of [
    ["missing-prompt", "1"],
    ["test-prompt", "2"],
  ] as const) {
    assert.throws(
      () => registry.render(promptId, promptVersion, { subject: "Subject" }),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "prompt_not_found" &&
        error.promptId === promptId &&
        error.promptVersion === promptVersion &&
        error.message === "The requested prompt definition is not registered.",
    );
  }
});

test("validates prompt IDs and exact positive-integer versions", () => {
  const invalidIds = [
    "",
    "Test Prompt",
    "test/prompt",
    ".test-prompt",
    "a".repeat(65),
  ];
  const invalidVersions = ["", "0", "01", "latest", "1.0", "-1", "1".repeat(81)];

  for (const id of invalidIds) {
    const registry = new PromptRegistry();

    assert.throws(
      () => registry.register({ ...testDefinition(), id }),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "invalid_prompt_id" &&
        error.promptId === undefined &&
        error.promptVersion === undefined,
    );
    assert.throws(
      () => registry.render(id, "1", { subject: "Private subject" }),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "invalid_prompt_id" &&
        error.promptId === undefined &&
        error.promptVersion === undefined,
    );
  }

  for (const version of invalidVersions) {
    const registry = new PromptRegistry();

    assert.throws(
      () => registry.register({ ...testDefinition(), version }),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "invalid_prompt_version" &&
        error.promptId === "test-prompt" &&
        error.promptVersion === undefined,
    );
    assert.throws(
      () => registry.render("test-prompt", version, { subject: "Private subject" }),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "invalid_prompt_version" &&
        error.promptId === "test-prompt" &&
      error.promptVersion === undefined,
    );
  }

  const maximumLengthVersion = "1".repeat(80);
  const registry = new PromptRegistry();

  registry.register(testDefinition(maximumLengthVersion));
  assert.equal(
    registry.render("test-prompt", maximumLengthVersion, { subject: "Subject" })
      .promptVersion,
    maximumLengthVersion,
  );
});

test("validates unknown input before rendering and omits private validation data", () => {
  const registry = new PromptRegistry();
  let renderCalls = 0;
  let receivedInput: ValidatedPromptInput | undefined;
  const definition: PromptDefinition<ValidatedPromptInput> = {
    id: "validated-test-prompt",
    version: "1",
    description: "A test-only prompt with nested validated input.",
    inputSchema: {
      validate(value) {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          const input = value as Record<string, unknown>;
          const context = input.context;

          if (
            typeof input.subject === "string" &&
            input.subject.trim().length > 0 &&
            (input.mode === "brief" || input.mode === "deep") &&
            typeof context === "object" &&
            context !== null &&
            !Array.isArray(context) &&
            Number.isSafeInteger((context as Record<string, unknown>).page) &&
            ((context as Record<string, number>).page > 0)
          ) {
            return {
              success: true,
              value: {
                subject: input.subject,
                mode: input.mode,
                context: {
                  page: (context as Record<string, number>).page,
                },
              },
            };
          }
        }

        return {
          success: false,
          issues: ["private passage must match the required input shape"],
        };
      },
    },
    render(input) {
      renderCalls += 1;
      receivedInput = input;

      return [{ role: "user", content: input.subject }];
    },
  };

  registry.register(definition);

  const validInput = {
    subject: "A valid subject.",
    mode: "brief",
    context: { page: 7 },
    ignored: "not forwarded",
  };

  registry.render("validated-test-prompt", "1", validInput);

  assert.deepEqual(receivedInput, {
    subject: "A valid subject.",
    mode: "brief",
    context: { page: 7 },
  });

  const invalidInputs: unknown[] = [
    undefined,
    null,
    [],
    {},
    { subject: "   ", mode: "brief", context: { page: 7 } },
    { subject: 42, mode: "brief", context: { page: 7 } },
    { subject: "Private passage", mode: "unsupported", context: { page: 7 } },
    { subject: "Private passage", mode: "brief", context: [] },
    { subject: "Private passage", mode: "brief", context: { page: 0 } },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => registry.render("validated-test-prompt", "1", input),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "invalid_prompt_input" &&
        error.promptId === "validated-test-prompt" &&
        error.promptVersion === "1" &&
        error.message === "The prompt input is invalid." &&
        error.message.includes("Private passage") === false &&
        error.message.includes("private passage") === false &&
        error.cause === undefined,
    );
  }

  assert.equal(renderCalls, 1);
});

test("renders equivalent messages for identical deterministic input", () => {
  const registry = new PromptRegistry();
  const input = { subject: "The same subject." };

  registry.register(testDefinition());

  const first = registry.render("test-prompt", "1", input);
  const second = registry.render("test-prompt", "1", input);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
});

test("rejects malformed rendered messages without rewriting or dropping them", () => {
  class ProviderMessage {
    readonly role = "user";
    readonly content = "Private SDK-backed content.";
  }

  const invalidRenderedValues: Array<{
    id: string;
    value: unknown;
  }> = [
    { id: "empty", value: [] },
    {
      id: "unsupported-role",
      value: [{ role: "tool", content: "Private tool content." }],
    },
    {
      id: "empty-content",
      value: [{ role: "user", content: "   " }],
    },
    {
      id: "invalid-content",
      value: [{ role: "user", content: 42 }],
    },
    {
      id: "undefined-role",
      value: [{ role: undefined, content: "Private content." }],
    },
    {
      id: "extra-provider-field",
      value: [
        {
          role: "user",
          content: "Private content.",
          providerOptions: { model: "provider-model" },
        },
      ],
    },
    {
      id: "sdk-instance",
      value: [new ProviderMessage()],
    },
    {
      id: "throwing-proxy",
      value: [
        new Proxy(
          { role: "user", content: "Private proxied content." },
          {
            getPrototypeOf() {
              throw new Error("Private proxy trap: do not expose.");
            },
          },
        ),
      ],
    },
    {
      id: "non-array",
      value: { role: "user", content: "Private content." },
    },
  ];

  for (const rendered of invalidRenderedValues) {
    const registry = new PromptRegistry();
    const promptId = `invalid-render-${rendered.id}`;

    registry.register({
      ...testDefinition(),
      id: promptId,
      render: () => rendered.value as never,
    });

    assert.throws(
      () => registry.render(promptId, "1", { subject: "Private subject." }),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "invalid_rendered_prompt" &&
        error.promptId === promptId &&
        error.promptVersion === "1" &&
        error.message === "The prompt renderer returned invalid messages." &&
        error.message.includes("Private") === false,
    );
  }
});

test("normalizes a malformed validator result as an internal validator failure", () => {
  const malformedResults: unknown[] = [
    undefined,
    null,
    {},
    { success: "not-a-boolean", privateValue: "do not expose" },
  ];

  for (const result of malformedResults) {
    const registry = new PromptRegistry();

    registry.register({
      ...testDefinition(),
      inputSchema: {
        validate: () => result as never,
      },
    });

    assert.throws(
      () =>
        registry.render("test-prompt", "1", {
          subject: "Private validator input.",
        }),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "prompt_render_failed" &&
        error.message === "The prompt input validator failed." &&
        error.message.includes("Private") === false &&
        JSON.stringify(error).includes("do not expose") === false,
    );
  }
});

test("returns frozen defensive messages and captures registered behavior", () => {
  const registry = new PromptRegistry();
  const definition = testDefinition();
  const mutableDefinition = definition as {
    inputSchema: {
      validate: PromptDefinition<TestPromptInput>["inputSchema"]["validate"];
    };
    render: PromptDefinition<TestPromptInput>["render"];
  };

  registry.register(definition);

  mutableDefinition.inputSchema.validate = () => ({
    success: false,
    issues: ["mutated validator"],
  });
  mutableDefinition.render = () => [
    {
      role: "user",
      content: "Mutated renderer.",
    },
  ];

  const first = registry.render("test-prompt", "1", {
    subject: "Original subject.",
  });

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.messages), true);
  assert.equal(Object.isFrozen(first.messages[0]), true);
  assert.throws(
    () => {
      (first.messages as AIMessage[]).push({
        role: "user",
        content: "Caller mutation.",
      });
    },
    TypeError,
  );
  assert.throws(
    () => {
      (first.messages[0] as AIMessage).content = "Caller mutation.";
    },
    TypeError,
  );

  const second = registry.render("test-prompt", "1", {
    subject: "Original subject.",
  });

  assert.deepEqual(second.messages, [
    {
      role: "system",
      content: "Use the supplied test subject.",
    },
    {
      role: "user",
      content: "Original subject.",
    },
  ]);
  assert.notEqual(first.messages, second.messages);
  assert.notEqual(first.messages[0], second.messages[0]);
});

test("normalizes validator and renderer failures without exposing private content", () => {
  const cases = [
    {
      id: "throwing-validator",
      failure: new Error("Private passage from validator: do not expose."),
      expectedMessage: "The prompt input validator failed.",
      definition(failure: Error): PromptDefinition<TestPromptInput> {
        return {
          ...testDefinition(),
          id: "throwing-validator",
          inputSchema: {
            validate() {
              throw failure;
            },
          },
        };
      },
    },
    {
      id: "throwing-renderer",
      failure: new Error("Private passage from renderer: do not expose."),
      expectedMessage: "The prompt renderer failed.",
      definition(failure: Error): PromptDefinition<TestPromptInput> {
        return {
          ...testDefinition(),
          id: "throwing-renderer",
          render() {
            throw failure;
          },
        };
      },
    },
  ];

  for (const scenario of cases) {
    const registry = new PromptRegistry();

    registry.register(scenario.definition(scenario.failure));

    assert.throws(
      () =>
        registry.render(scenario.id, "1", {
          subject: "Private input: do not expose.",
        }),
      (error: unknown) => {
        if (!(error instanceof PromptError)) {
          return false;
        }

        const serialized = JSON.stringify(error);

        return (
          error.code === "prompt_render_failed" &&
          error.promptId === scenario.id &&
          error.promptVersion === "1" &&
          error.message === scenario.expectedMessage &&
          error.cause === scenario.failure &&
          error.message.includes("Private") === false &&
          serialized.includes("Private") === false &&
          serialized.includes("do not expose") === false
        );
      },
    );
  }
});

test("keeps registrations isolated between PromptRegistry instances", () => {
  const firstRegistry = new PromptRegistry();
  const secondRegistry = new PromptRegistry();

  firstRegistry.register(testDefinition());

  assert.throws(
    () =>
      secondRegistry.render("test-prompt", "1", {
        subject: "Private subject.",
      }),
    (error: unknown) =>
      error instanceof PromptError &&
      error.code === "prompt_not_found",
  );

  secondRegistry.register({
    ...testDefinition(),
    render: () => [{ role: "user", content: "Second registry." }],
  });

  assert.equal(
    firstRegistry.render("test-prompt", "1", { subject: "First registry." })
      .messages[1]?.content,
    "First registry.",
  );
  assert.equal(
    secondRegistry.render("test-prompt", "1", { subject: "Ignored." })
      .messages[0]?.content,
    "Second registry.",
  );
});

test("rejects malformed prompt definitions with a stable domain error", () => {
  const malformedDefinitions: unknown[] = [
    null,
    {},
    { ...testDefinition(), description: "   " },
    { ...testDefinition(), inputSchema: {} },
    {
      ...testDefinition(),
      inputSchema: { validate: "not-a-function" },
    },
    { ...testDefinition(), render: undefined },
  ];

  for (const definition of malformedDefinitions) {
    const registry = new PromptRegistry();

    assert.throws(
      () => registry.register(definition as PromptDefinition<unknown>),
      (error: unknown) =>
        error instanceof PromptError &&
        error.code === "invalid_prompt_definition" &&
        error.message === "The prompt definition is invalid." &&
        error.message.includes("not-a-function") === false,
    );
  }
});
