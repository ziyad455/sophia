const DEFAULT_PORT = 3000;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

type CookieSameSite = "lax" | "strict" | "none";

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

function readInteger(value: string | undefined, defaultValue: number, name: string): number {
  if (!value) {
    return defaultValue;
  }

  const integer = Number.parseInt(value, 10);
  if (!Number.isInteger(integer) || integer < 1) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }

  return integer;
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

function readSameSite(value: string | undefined): CookieSameSite {
  if (!value) {
    return "lax";
  }

  if (value === "lax" || value === "strict" || value === "none") {
    return value;
  }

  throw new Error(`Invalid AUTH_COOKIE_SAME_SITE value: ${value}`);
}

function readJwtSecret(nodeEnv: string): string {
  if (process.env.JWT_ACCESS_SECRET) {
    return process.env.JWT_ACCESS_SECRET;
  }

  if (nodeEnv === "production") {
    throw new Error("JWT_ACCESS_SECRET is required in production.");
  }

  return "development-only-change-me";
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const config = {
  nodeEnv,
  host: process.env.HOST ?? "127.0.0.1",
  port: readPort(process.env.PORT),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
  databaseUrl: process.env.DATABASE_URL,
  auth: {
    jwtAccessSecret: readJwtSecret(nodeEnv),
    jwtIssuer: process.env.JWT_ISSUER ?? "sophia-api",
    jwtAudience: process.env.JWT_AUDIENCE ?? "sophia-web",
    accessTokenTtlSeconds: readInteger(
      process.env.ACCESS_TOKEN_TTL_SECONDS,
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
      "ACCESS_TOKEN_TTL_SECONDS",
    ),
    refreshTokenTtlDays: readInteger(
      process.env.REFRESH_TOKEN_TTL_DAYS,
      DEFAULT_REFRESH_TOKEN_TTL_DAYS,
      "REFRESH_TOKEN_TTL_DAYS",
    ),
    accessCookieName: process.env.ACCESS_TOKEN_COOKIE_NAME ?? "sophia_access_token",
    refreshCookieName: process.env.REFRESH_TOKEN_COOKIE_NAME ?? "sophia_refresh_token",
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN,
    cookieSecure: readBoolean(process.env.AUTH_COOKIE_SECURE, nodeEnv === "production"),
    cookieSameSite: readSameSite(process.env.AUTH_COOKIE_SAME_SITE),
  },
};
