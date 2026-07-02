export type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

export type AuthResponse = {
  user: PublicUser;
  tokens: AuthTokens;
};

export type RequestMetadata = {
  userAgent?: string;
  ipAddress?: string;
};
