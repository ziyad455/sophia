import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function routeSource(): string {
  const backendRoot = existsSync(path.resolve(process.cwd(), "src"))
    ? process.cwd()
    : path.resolve(process.cwd(), "backend");

  return readFileSync(
    path.join(backendRoot, "src/chat/chat.routes.ts"),
    "utf8",
  );
}

function appSource(): string {
  const backendRoot = existsSync(path.resolve(process.cwd(), "src"))
    ? process.cwd()
    : path.resolve(process.cwd(), "backend");

  return readFileSync(path.join(backendRoot, "src/app.ts"), "utf8");
}

test("chat routes expose only the authenticated S8-T1 HTTP surface", () => {
  const compact = (value: string) => value.replace(/[\s,]+/g, "");
  const source = compact(routeSource());

  for (const route of [
    'router.post("/:userBookId/chat-sessions", requireAuth, asyncHandler(createChatSession))',
    'router.get("/:userBookId/chat-sessions", requireAuth, asyncHandler(listChatSessions))',
    'router.get("/:userBookId/chat-sessions/:sessionId", requireAuth, asyncHandler(getChatSession))',
    'router.post("/:userBookId/chat-sessions/:sessionId/messages", requireAuth, asyncHandler(createChatMessage))',
    'router.delete("/:userBookId/chat-sessions/:sessionId", requireAuth, asyncHandler(deleteChatSession))',
  ]) {
    assert.ok(source.includes(compact(route)), "Missing authenticated route: " + route);
  }

  assert.equal(source.includes("assistant-message"), false);
  assert.equal(source.includes("AIRuntime"), false);
  assert.equal(source.includes("Gemini"), false);
});

test("the backend composition root mounts chat under books", () => {
  const source = appSource().replace(/[\s,]+/g, "");

  assert.ok(source.includes('import{createChatRouter}from"./chat/chat.routes"'));
  assert.ok(source.includes('app.use("/books"createChatRouter())'));
});
