import { unauthorized } from "../http/errors";
import type { ApiNext, ApiRequest, ApiResponse } from "../http/types";
import { readAccessTokenCookie } from "./cookies";
import { getUserForSessionToken } from "./auth.service";

function readBearerToken(header: string | string[] | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  const value = Array.isArray(header) ? header[0] : header;
  const [scheme, token, extra] = value.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    throw unauthorized("Authorization header must use the Bearer token format.");
  }

  return token.trim();
}

function readAccessToken(req: ApiRequest): string | undefined {
  const bearerToken = readBearerToken(req.headers.authorization);

  if (bearerToken) {
    return bearerToken;
  }

  return readAccessTokenCookie(req);
}

async function attachAuthContext(req: ApiRequest, token: string): Promise<void> {
  const session = await getUserForSessionToken(token);
  req.auth = {
    userId: session.userId,
    sessionId: session.sessionId,
  };

  // Future user-owned services should scope queries with req.auth.userId.
  // Example: where: { userId: req.auth.userId }
}

export async function requireAuth(
  req: ApiRequest,
  _res: ApiResponse,
  next: ApiNext,
): Promise<void> {
  try {
    const token = readAccessToken(req);

    if (!token) {
      throw unauthorized();
    }

    await attachAuthContext(req, token);

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(
  req: ApiRequest,
  _res: ApiResponse,
  next: ApiNext,
): Promise<void> {
  try {
    const token = readAccessToken(req);

    if (!token) {
      next();
      return;
    }

    await attachAuthContext(req, token);

    next();
  } catch {
    next();
  }
}
