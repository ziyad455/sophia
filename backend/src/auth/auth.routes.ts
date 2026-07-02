import { asyncHandler } from "../http/errors";
import { login, logout, me, refresh, register } from "./auth.controller";
import { requireAuth } from "./auth.middleware";

const express = require("express");

export function createAuthRouter() {
  const router = express.Router();

  router.post("/register", asyncHandler(register));
  router.post("/login", asyncHandler(login));
  router.post("/refresh", asyncHandler(refresh));
  router.post("/logout", requireAuth, asyncHandler(logout));
  router.get("/me", requireAuth, asyncHandler(me));

  return router;
}
