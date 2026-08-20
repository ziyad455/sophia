import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../http/errors";
import {
  MAX_CHAT_MESSAGE_CONTENT_LENGTH,
  parseCreateChatSessionDto,
  parseCreateUserMessageDto,
} from "./chat.dto";

function assertBadRequest(callback: () => unknown): void {
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 400,
  );
}

test("chat session creation accepts no body or an empty JSON object", () => {
  assert.deepEqual(parseCreateChatSessionDto(undefined), {});
  assert.deepEqual(parseCreateChatSessionDto({}), {});
  assertBadRequest(() => parseCreateChatSessionDto(null));
  assertBadRequest(() => parseCreateChatSessionDto({ title: "Client title" }));
  assertBadRequest(() => parseCreateChatSessionDto({ userId: "client-controlled" }));
});

test("user message parsing trims content without rewriting internal whitespace", () => {
  assert.deepEqual(
    parseCreateUserMessageDto({
      content: "  What does this passage mean?\n\nPlease go slowly.  ",
    }),
    {
      content: "What does this passage mean?\n\nPlease go slowly.",
    },
  );
});

test("user message parsing rejects empty, non-string, markup, and oversized content", () => {
  assertBadRequest(() => parseCreateUserMessageDto({ content: "   " }));
  assertBadRequest(() => parseCreateUserMessageDto({ content: ["question"] }));
  assertBadRequest(() => parseCreateUserMessageDto({ content: "<script>private</script>" }));
  assertBadRequest(() =>
    parseCreateUserMessageDto({
      content: "x".repeat(MAX_CHAT_MESSAGE_CONTENT_LENGTH + 1),
    }),
  );
});

test("user message parsing rejects client-controlled roles, identity, ordering, and AI settings", () => {
  for (const body of [
    { content: "Question", role: "assistant" },
    { content: "Question", role: "system" },
    { content: "Question", role: "tool" },
    { content: "Question", role: "developer" },
    { content: "Question", userId: "client-controlled" },
    { content: "Question", sequence: 1 },
    { content: "Question", provider: "gemini" },
    { content: "Question", model: "client-model" },
    { content: "Question", promptId: "client-prompt" },
  ]) {
    assertBadRequest(() => parseCreateUserMessageDto(body));
  }
});
