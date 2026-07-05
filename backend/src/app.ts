import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "./config";
import { checkDatabaseHealth } from "./db";
import { createAuthRouter } from "./auth/auth.routes";
import { HttpError } from "./http/errors";

const express = require("express");

type Request = IncomingMessage;
type Response = ServerResponse & {
  json: (body: unknown) => void;
  sendStatus: (statusCode: number) => void;
  status: (statusCode: number) => Response;
};
type Next = (error?: unknown) => void;

function getRequestOrigin(req: Request): string | undefined {
  const origin = req.headers.origin;

  return Array.isArray(origin) ? origin[0] : origin;
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use((req: Request, res: Response, next: Next) => {
    const origin = getRequestOrigin(req);

    if (origin && config.frontendOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json());
  app.use("/auth", createAuthRouter());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "sophia-api",
      environment: config.nodeEnv,
    });
  });

  app.get("/health/db", async (_req: Request, res: Response) => {
    const health = await checkDatabaseHealth();

    res.status(health.ok ? 200 : 503).json({
      status: health.ok ? "ok" : "error",
      database: health.ok ? "connected" : "unavailable",
      message: health.message,
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      status: "error",
      message: "Route not found.",
    });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: Next) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        status: "error",
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected server error.";

    res.status(500).json({
      status: "error",
      message,
    });
  });

  return app;
}
