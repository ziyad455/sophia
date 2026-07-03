import type { User } from "../../generated/prisma/client";
import { AuthProvider } from "../../generated/prisma/client";
import { config } from "../config";
import { prisma } from "../db/prisma";
import { conflict, unauthorized } from "../http/errors";
import type { LoginDto, RefreshTokenDto, RegisterDto } from "./auth.dto";
import type { AuthResponse, PublicUser, RequestMetadata } from "./auth.types";
import { hashPassword, verifyPassword } from "./password";
import {
  addDays,
  createAccessToken,
  createOpaqueToken,
  createTokenId,
  hashToken,
  verifyAccessToken,
} from "./tokens";

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

function serializeUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function serializeAuthResponse(user: User, tokens: SessionTokens): AuthResponse {
  return {
    user: serializeUser(user),
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
    },
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function createSession(userId: string, metadata: RequestMetadata): Promise<SessionTokens> {
  const now = new Date();
  const sessionId = createTokenId();
  const accessToken = createAccessToken(userId, sessionId, now);
  const refreshToken = createOpaqueToken();
  const refreshTokenExpiresAt = addDays(now, config.auth.refreshTokenTtlDays);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      sessionTokenHash: hashToken(accessToken.payload.jti),
      expiresAt: refreshTokenExpiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      refreshTokens: {
        create: {
          userId,
          tokenHash: hashToken(refreshToken),
          expiresAt: refreshTokenExpiresAt,
        },
      },
    },
  });

  return {
    accessToken: accessToken.token,
    refreshToken,
    accessTokenExpiresAt: accessToken.expiresAt,
    refreshTokenExpiresAt,
  };
}

export async function registerWithEmail(
  dto: RegisterDto,
  metadata: RequestMetadata,
): Promise<AuthResponse> {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: dto.email,
    },
  });

  if (existingUser) {
    throw conflict("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(dto.password);

  try {
    const user = await prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        authAccounts: {
          create: {
            provider: AuthProvider.EMAIL,
            providerUserId: dto.email,
            email: dto.email,
            passwordHash,
          },
        },
      },
    });

    const tokens = await createSession(user.id, metadata);
    return serializeAuthResponse(user, tokens);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("An account with this email already exists.");
    }

    throw error;
  }
}

export async function loginWithEmail(
  dto: LoginDto,
  metadata: RequestMetadata,
): Promise<AuthResponse> {
  const account = await prisma.authAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.EMAIL,
        providerUserId: dto.email,
      },
    },
    include: {
      user: true,
    },
  });

  if (!account?.passwordHash || account.user.deletedAt) {
    throw unauthorized("Invalid email or password.");
  }

  const passwordMatches = await verifyPassword(dto.password, account.passwordHash);
  if (!passwordMatches) {
    throw unauthorized("Invalid email or password.");
  }

  const tokens = await createSession(account.userId, metadata);
  return serializeAuthResponse(account.user, tokens);
}

export async function refreshSession(dto: RefreshTokenDto): Promise<AuthResponse> {
  const now = new Date();
  const tokenHash = hashToken(dto.refreshToken);
  const refreshTokenRecord = await prisma.refreshToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      session: true,
      user: true,
    },
  });

  if (
    !refreshTokenRecord ||
    refreshTokenRecord.revokedAt ||
    refreshTokenRecord.expiresAt <= now
  ) {
    throw unauthorized("Refresh token is invalid or expired.");
  }

  if (refreshTokenRecord.rotatedAt) {
    await prisma.$transaction([
      prisma.session.update({
        where: {
          id: refreshTokenRecord.sessionId,
        },
        data: {
          revokedAt: now,
        },
      }),
      prisma.refreshToken.updateMany({
        where: {
          sessionId: refreshTokenRecord.sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
    ]);

    throw unauthorized("Refresh token has already been used.");
  }

  if (
    refreshTokenRecord.session.revokedAt ||
    refreshTokenRecord.session.expiresAt <= now ||
    refreshTokenRecord.user.deletedAt
  ) {
    throw unauthorized("Refresh token is invalid or expired.");
  }

  const jwtAccessToken = createAccessToken(refreshTokenRecord.userId, refreshTokenRecord.sessionId, now);
  const refreshToken = createOpaqueToken();
  const refreshTokenExpiresAt = addDays(now, config.auth.refreshTokenTtlDays);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: {
        id: refreshTokenRecord.id,
      },
      data: {
        rotatedAt: now,
      },
    }),
    prisma.session.update({
      where: {
        id: refreshTokenRecord.sessionId,
      },
      data: {
        sessionTokenHash: hashToken(jwtAccessToken.payload.jti),
        expiresAt: refreshTokenExpiresAt,
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: refreshTokenRecord.userId,
        sessionId: refreshTokenRecord.sessionId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
      },
    }),
  ]);

  return serializeAuthResponse(refreshTokenRecord.user, {
    accessToken: jwtAccessToken.token,
    refreshToken,
    accessTokenExpiresAt: jwtAccessToken.expiresAt,
    refreshTokenExpiresAt,
  });
}

export async function revokeSession(sessionId: string, refreshToken?: string): Promise<void> {
  const now = new Date();

  await prisma.$transaction([
    prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        revokedAt: now,
      },
    }),
    prisma.refreshToken.updateMany({
      where: refreshToken
        ? {
            sessionId,
            tokenHash: hashToken(refreshToken),
            revokedAt: null,
          }
        : {
            sessionId,
            revokedAt: null,
          },
      data: {
        revokedAt: now,
      },
    }),
  ]);
}

export async function revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
  const refreshTokenRecord = await prisma.refreshToken.findUnique({
    where: {
      tokenHash: hashToken(refreshToken),
    },
  });

  if (!refreshTokenRecord) {
    return;
  }

  await revokeSession(refreshTokenRecord.sessionId);
}

export async function getUserForSessionToken(accessToken: string): Promise<{
  user: PublicUser;
  userId: string;
  sessionId: string;
}> {
  const payload = verifyAccessToken(accessToken);
  const session = await prisma.session.findUnique({
    where: {
      id: payload.sid,
    },
    include: {
      user: true,
    },
  });

  if (
    !session ||
    session.userId !== payload.sub ||
    session.sessionTokenHash !== hashToken(payload.jti) ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.deletedAt
  ) {
    throw unauthorized();
  }

  return {
    user: serializeUser(session.user),
    userId: session.userId,
    sessionId: session.id,
  };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user || user.deletedAt) {
    throw unauthorized();
  }

  return serializeUser(user);
}
