import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "./notes.controller";

const express = require("express");

export function createNotesRouter() {
  const router = express.Router();

  router.get("/:userBookId/notes", requireAuth, asyncHandler(listNotes));
  router.post("/:userBookId/notes", requireAuth, asyncHandler(createNote));
  router.get("/:userBookId/notes/:noteId", requireAuth, asyncHandler(getNote));
  router.patch("/:userBookId/notes/:noteId", requireAuth, asyncHandler(updateNote));
  router.delete("/:userBookId/notes/:noteId", requireAuth, asyncHandler(deleteNote));

  return router;
}
