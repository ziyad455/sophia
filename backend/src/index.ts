require("dotenv/config");

import { createApp } from "./app";
import { closeDatabase } from "./db";
import { config } from "./config";

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`Sophia backend listening at http://${config.host}:${config.port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error("Failed to start Sophia backend:", error.message);
  process.exit(1);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Received ${signal}. Shutting down Sophia backend.`);

  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
