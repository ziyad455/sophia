import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import {
  createHighlight,
  deleteHighlight,
  listHighlights,
} from "./highlights.controller";

const express = require("express");

export function createHighlightsRouter() {
  const router = express.Router();

  router.get("/:userBookId/highlights", requireAuth, asyncHandler(listHighlights));
  router.post("/:userBookId/highlights", requireAuth, asyncHandler(createHighlight));
  router.delete(
    "/:userBookId/highlights/:highlightId",
    requireAuth,
    asyncHandler(deleteHighlight),
  );

  return router;
}
