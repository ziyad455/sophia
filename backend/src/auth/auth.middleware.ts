import { unauthorized } from "../http/errors";
import type { ApiNext, ApiRequest, ApiResponse } from "../http/types";
import { readAccessTokenCookie } from "./cookies";
import { getUserForSessionToken } from "./auth.service";

function readBearerToken(header: string | string[] | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  const value = Array.isArray(header) ? header[0] : header;
  const [scheme, token] = value.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token.trim();
}

export async function requireAuth(
  req: ApiRequest,
  _res: ApiResponse,
  next: ApiNext,
): Promise<void> {
  try {
    const token = readBearerToken(req.headers.authorization) ?? readAccessTokenCookie(req);

    if (!token) {
      throw unauthorized();
    }

    const session = await getUserForSessionToken(token);
    req.auth = {
      userId: session.userId,
      sessionId: session.sessionId,
    };

    next();
  } catch (error) {
    next(error);
  }
}
