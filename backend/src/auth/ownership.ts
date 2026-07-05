import { forbidden, notFound, unauthorized } from "../http/errors";
import type { ApiRequest, AuthContext } from "../http/types";

export type UserScope = {
  userId: string;
};

export type OwnedResource = {
  userId: string;
};

export type OwnershipFailureMode = "not_found" | "forbidden";

export type AssertOwnedResourceOptions = {
  failureMode?: OwnershipFailureMode;
  message?: string;
};

export function requireAuthContext(req: ApiRequest): AuthContext {
  if (!req.auth) {
    throw unauthorized();
  }

  return req.auth;
}

export function getAuthUserId(req: ApiRequest): string {
  return requireAuthContext(req).userId;
}

export function buildUserScope(userId: string): UserScope {
  return { userId };
}

export function buildAuthenticatedUserScope(req: ApiRequest): UserScope {
  return buildUserScope(getAuthUserId(req));
}

function throwOwnershipFailure(options: AssertOwnedResourceOptions): never {
  const failureMode = options.failureMode ?? "not_found";
  const message = options.message;

  if (failureMode === "forbidden") {
    throw forbidden(message);
  }

  throw notFound(message);
}

export function assertUserOwnedResource<TResource extends OwnedResource>(
  resource: TResource | null | undefined,
  userId: string,
  options: AssertOwnedResourceOptions = {},
): TResource {
  if (!resource || resource.userId !== userId) {
    throwOwnershipFailure(options);
  }

  return resource;
}

export function assertOwnedResource<TResource>(
  resource: TResource | null | undefined,
  options: AssertOwnedResourceOptions = {},
): TResource {
  if (!resource) {
    throwOwnershipFailure(options);
  }

  return resource;
}
