import { badRequest } from "../http/errors";

export type RegisterDto = {
  email: string;
  password: string;
  displayName?: string;
};

export type LoginDto = {
  email: string;
  password: string;
};

export type RefreshTokenDto = {
  refreshToken: string;
};

export type LogoutDto = {
  refreshToken?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const DISPLAY_NAME_MAX_LENGTH = 255;

function assertBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

function readRequiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  if (typeof value !== "string") {
    throw badRequest(`${key} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw badRequest(`${key} is required.`);
  }

  return trimmed;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 320) {
    throw badRequest("A valid email address is required.");
  }

  return normalized;
}

function validatePassword(password: string): string {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw badRequest(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
  }

  return password;
}

function readDisplayName(body: Record<string, unknown>): string | undefined {
  const value = body.displayName;

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw badRequest("displayName must be a string.");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw badRequest(`displayName must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
  }

  return trimmed;
}

export function parseRegisterDto(value: unknown): RegisterDto {
  const body = assertBody(value);

  return {
    email: normalizeEmail(readRequiredString(body, "email")),
    password: validatePassword(readRequiredString(body, "password")),
    displayName: readDisplayName(body),
  };
}

export function parseLoginDto(value: unknown): LoginDto {
  const body = assertBody(value);

  return {
    email: normalizeEmail(readRequiredString(body, "email")),
    password: readRequiredString(body, "password"),
  };
}

export function parseRefreshTokenDto(value: unknown): RefreshTokenDto {
  const body = assertBody(value);

  return {
    refreshToken: readRequiredString(body, "refreshToken"),
  };
}

export function parseLogoutDto(rawValue: unknown): LogoutDto {
  const body = assertBody(rawValue);
  const refreshToken = body.refreshToken;

  if (refreshToken === undefined || refreshToken === null) {
    return {};
  }

  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    throw badRequest("refreshToken must be a string.");
  }

  return {
    refreshToken: refreshToken.trim(),
  };
}
