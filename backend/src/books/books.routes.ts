import { requireAuth } from "../auth/auth.middleware";
import { asyncHandler } from "../http/errors";
import { getLibraryBook, listLibrary, uploadBook } from "./books.controller";

const express = require("express");

export function createBooksRouter() {
  const router = express.Router();

  router.get("/", requireAuth, asyncHandler(listLibrary));
  router.post("/upload", requireAuth, asyncHandler(uploadBook));
  router.get("/:userBookId", requireAuth, asyncHandler(getLibraryBook));

  return router;
}
