import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import { getProcessingStatus, startProcessing } from "./processing.controller";

const express = require("express");

export function createProcessingRouter() {
  const router = express.Router();

  router.post("/:userBookId/process", requireAuth, asyncHandler(startProcessing));
  router.get("/:userBookId/processing-status", requireAuth, asyncHandler(getProcessingStatus));

  return router;
}

