import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import {
  endReadingSession,
  startReadingSession,
  updateReadingSession,
} from "./reading-sessions.controller";

const express = require("express");

export function createReadingSessionsRouter() {
  const router = express.Router();

  router.post(
    "/:userBookId/reading-sessions",
    requireAuth,
    asyncHandler(startReadingSession),
  );
  router.patch(
    "/:userBookId/reading-sessions/:sessionId",
    requireAuth,
    asyncHandler(updateReadingSession),
  );
  router.post(
    "/:userBookId/reading-sessions/:sessionId/end",
    requireAuth,
    asyncHandler(endReadingSession),
  );

  return router;
}
