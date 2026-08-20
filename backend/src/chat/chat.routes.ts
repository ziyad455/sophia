import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import {
  createChatMessage,
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatSessions,
} from "./chat.controller";

const express = require("express");

export function createChatRouter() {
  const router = express.Router();

  router.post(
    "/:userBookId/chat-sessions",
    requireAuth,
    asyncHandler(createChatSession),
  );
  router.get(
    "/:userBookId/chat-sessions",
    requireAuth,
    asyncHandler(listChatSessions),
  );
  router.get(
    "/:userBookId/chat-sessions/:sessionId",
    requireAuth,
    asyncHandler(getChatSession),
  );
  router.post(
    "/:userBookId/chat-sessions/:sessionId/messages",
    requireAuth,
    asyncHandler(createChatMessage),
  );
  router.delete(
    "/:userBookId/chat-sessions/:sessionId",
    requireAuth,
    asyncHandler(deleteChatSession),
  );

  return router;
}
