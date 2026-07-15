import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import {
  getAuthenticatedReaderPreferences,
  patchAuthenticatedReaderPreferences,
} from "./preferences.controller";

const express = require("express");

export function createPreferencesRouter() {
  const router = express.Router();

  router.get("/reader", requireAuth, asyncHandler(getAuthenticatedReaderPreferences));
  router.patch("/reader", requireAuth, asyncHandler(patchAuthenticatedReaderPreferences));

  return router;
}
