import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import {
  getLibraryBook,
  getLibraryBookCover,
  getLibraryBookPdf,
  getLibraryBookReaderData,
  getLibraryBookReadingContent,
  listLibrary,
  updateLibraryBookMetadata,
  uploadBook,
} from "./books.controller";

const express = require("express");

export function createBooksRouter() {
  const router = express.Router();

  router.get("/", requireAuth, asyncHandler(listLibrary));
  router.post("/upload", requireAuth, asyncHandler(uploadBook));
  router.get("/:userBookId/reader", requireAuth, asyncHandler(getLibraryBookReaderData));
  router.get(
    "/:userBookId/reading-content",
    requireAuth,
    asyncHandler(getLibraryBookReadingContent),
  );
  router.get("/:userBookId/pdf", requireAuth, asyncHandler(getLibraryBookPdf));
  router.get("/:userBookId/cover", requireAuth, asyncHandler(getLibraryBookCover));
  router.patch("/:userBookId/metadata", requireAuth, asyncHandler(updateLibraryBookMetadata));
  router.get("/:userBookId", requireAuth, asyncHandler(getLibraryBook));

  return router;
}
