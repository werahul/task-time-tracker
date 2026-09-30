import type { AuthUser } from "@task-time-tracker/shared";

/** Identity attached to a request by the authenticate middleware. */
export interface AuthenticatedUser {
  id: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface NewSession {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}
