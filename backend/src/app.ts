import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "./config";
import { checkDatabaseHealth } from "./db";

const express = require("express");

type Request = IncomingMessage;
type Response = ServerResponse & {
  json: (body: unknown) => void;
  sendStatus: (statusCode: number) => void;
  status: (statusCode: number) => Response;
};
type Next = (error?: unknown) => void;

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use((req: Request, res: Response, next: Next) => {
    res.setHeader("Access-Control-Allow-Origin", config.frontendOrigin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json());

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
    const message = error instanceof Error ? error.message : "Unexpected server error.";

    res.status(500).json({
      status: "error",
      message,
    });
  });

  return app;
}
