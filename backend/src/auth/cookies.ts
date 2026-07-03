import { config } from "../config";
import type { ApiRequest, ApiResponse } from "../http/types";
import type { AuthTokens } from "./auth.types";

type CookieOptions = {
  httpOnly?: boolean;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
};

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  if (config.auth.cookieDomain) {
    parts.push(`Domain=${config.auth.cookieDomain}`);
  }

  return parts.join("; ");
}

function appendSetCookie(res: ApiResponse, cookie: string): void {
  const existing = res.getHeader("Set-Cookie");

  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookie]);
    return;
  }

  res.setHeader("Set-Cookie", [String(existing), cookie]);
}

export function setAuthCookies(res: ApiResponse, tokens: AuthTokens): void {
  appendSetCookie(
    res,
    serializeCookie(config.auth.accessCookieName, tokens.accessToken, {
      httpOnly: true,
      maxAgeSeconds: config.auth.accessTokenTtlSeconds,
      sameSite: config.auth.cookieSameSite,
      secure: config.auth.cookieSecure,
    }),
  );
  appendSetCookie(
    res,
    serializeCookie(config.auth.refreshCookieName, tokens.refreshToken, {
      httpOnly: true,
      maxAgeSeconds: config.auth.refreshTokenTtlDays * 24 * 60 * 60,
      sameSite: config.auth.cookieSameSite,
      secure: config.auth.cookieSecure,
    }),
  );
}

export function clearAuthCookies(res: ApiResponse): void {
  appendSetCookie(
    res,
    serializeCookie(config.auth.accessCookieName, "", {
      httpOnly: true,
      maxAgeSeconds: 0,
      sameSite: config.auth.cookieSameSite,
      secure: config.auth.cookieSecure,
    }),
  );
  appendSetCookie(
    res,
    serializeCookie(config.auth.refreshCookieName, "", {
      httpOnly: true,
      maxAgeSeconds: 0,
      sameSite: config.auth.cookieSameSite,
      secure: config.auth.cookieSecure,
    }),
  );
}

export function readCookie(req: ApiRequest, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  const header = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  const cookies = header.split(";");

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValueParts.join("="));
    }
  }

  return undefined;
}

export function readAccessTokenCookie(req: ApiRequest): string | undefined {
  return readCookie(req, config.auth.accessCookieName);
}

export function readRefreshTokenCookie(req: ApiRequest): string | undefined {
  return readCookie(req, config.auth.refreshCookieName);
}
