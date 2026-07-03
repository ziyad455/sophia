import type { ApiRequest, ApiResponse } from "../http/types";
import { clearAuthCookies, readRefreshTokenCookie, setAuthCookies } from "./cookies";
import { parseLoginDto, parseLogoutDto, parseRefreshTokenDto, parseRegisterDto } from "./auth.dto";
import {
  getCurrentUser,
  loginWithEmail,
  refreshSession,
  revokeSessionByRefreshToken,
  registerWithEmail,
  revokeSession,
} from "./auth.service";
import type { RequestMetadata } from "./auth.types";

function getRequestMetadata(req: ApiRequest): RequestMetadata {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim() ?? req.ip;

  return {
    userAgent: req.headers["user-agent"],
    ipAddress,
  };
}

export async function register(req: ApiRequest, res: ApiResponse): Promise<void> {
  const result = await registerWithEmail(parseRegisterDto(req.body), getRequestMetadata(req));
  setAuthCookies(res, result.tokens);
  res.status(201).json(result);
}

export async function login(req: ApiRequest, res: ApiResponse): Promise<void> {
  const result = await loginWithEmail(parseLoginDto(req.body), getRequestMetadata(req));
  setAuthCookies(res, result.tokens);
  res.status(200).json(result);
}

export async function refresh(req: ApiRequest, res: ApiResponse): Promise<void> {
  const cookieRefreshToken = readRefreshTokenCookie(req);
  const dto = cookieRefreshToken ? { refreshToken: cookieRefreshToken } : parseRefreshTokenDto(req.body);
  const result = await refreshSession(dto);
  setAuthCookies(res, result.tokens);
  res.status(200).json(result);
}

export async function logout(req: ApiRequest, res: ApiResponse): Promise<void> {
  const dto = parseLogoutDto(req.body ?? {});
  const refreshToken = dto.refreshToken ?? readRefreshTokenCookie(req);

  if (req.auth) {
    await revokeSession(req.auth.sessionId);
  } else if (refreshToken) {
    await revokeSessionByRefreshToken(refreshToken);
  }

  clearAuthCookies(res);
  res.sendStatus(204);
}

export async function me(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!req.auth) {
    res.status(401).json({
      status: "error",
      code: "unauthorized",
      message: "Authentication is required.",
    });
    return;
  }

  const user = await getCurrentUser(req.auth.userId);
  res.status(200).json({ user });
}
