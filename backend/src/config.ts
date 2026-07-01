const DEFAULT_PORT = 3000;

function readPort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "127.0.0.1",
  port: readPort(process.env.PORT),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
  databaseUrl: process.env.DATABASE_URL,
};
