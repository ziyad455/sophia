import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { config } from "../config";
import { unauthorized } from "../http/errors";

const TOKEN_BYTES = 32;
const JWT_ALGORITHM = "HS256";
const ACCESS_TOKEN_TYPE = "access";

export type AccessTokenPayload = {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  sid: string;
  sub: string;
  typ: typeof ACCESS_TOKEN_TYPE;
};

export type GeneratedAccessToken = {
  token: string;
  payload: AccessTokenPayload;
  expiresAt: Date;
};

export function createOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function createTokenId(): string {
  return randomUUID();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function signJwtInput(input: string): string {
  return createHmac("sha256", config.auth.jwtAccessSecret).update(input).digest("base64url");
}

function assertSignature(input: string, signature: string): void {
  const expectedSignature = Buffer.from(signJwtInput(input), "base64url");
  const actualSignature = Buffer.from(signature, "base64url");

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw unauthorized("Access token signature is invalid.");
  }
}

export function createAccessToken(userId: string, sessionId: string, issuedAt = new Date()): GeneratedAccessToken {
  const expiresAt = addSeconds(issuedAt, config.auth.accessTokenTtlSeconds);
  const payload: AccessTokenPayload = {
    aud: config.auth.jwtAudience,
    exp: Math.floor(expiresAt.getTime() / 1000),
    iat: Math.floor(issuedAt.getTime() / 1000),
    iss: config.auth.jwtIssuer,
    jti: createTokenId(),
    sid: sessionId,
    sub: userId,
    typ: ACCESS_TOKEN_TYPE,
  };
  const header = {
    alg: JWT_ALGORITHM,
    typ: "JWT",
  };
  const input = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;

  return {
    token: `${input}.${signJwtInput(input)}`,
    payload,
    expiresAt,
  };
}

export function verifyAccessToken(token: string, now = new Date()): AccessTokenPayload {
  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw unauthorized("Access token is malformed.");
  }

  let header: { alg?: string; typ?: string };
  let payload: AccessTokenPayload;

  try {
    header = decodeBase64UrlJson<{ alg?: string; typ?: string }>(encodedHeader);
    payload = decodeBase64UrlJson<AccessTokenPayload>(encodedPayload);
  } catch {
    throw unauthorized("Access token is malformed.");
  }

  if (header.alg !== JWT_ALGORITHM || header.typ !== "JWT") {
    throw unauthorized("Access token header is invalid.");
  }

  assertSignature(`${encodedHeader}.${encodedPayload}`, signature);

  if (
    payload.typ !== ACCESS_TOKEN_TYPE ||
    payload.iss !== config.auth.jwtIssuer ||
    payload.aud !== config.auth.jwtAudience ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number" ||
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    typeof payload.jti !== "string" ||
    !payload.sub ||
    !payload.sid ||
    !payload.jti
  ) {
    throw unauthorized("Access token claims are invalid.");
  }

  if (payload.exp <= Math.floor(now.getTime() / 1000)) {
    throw unauthorized("Access token is expired.");
  }

  return payload;
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
