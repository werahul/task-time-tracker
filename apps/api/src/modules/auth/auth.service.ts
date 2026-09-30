import type { AuthUser, LoginInput, RegisterInput } from "@task-time-tracker/shared";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { isPrismaError } from "../../lib/prisma";
import { AuthErrors } from "./auth.errors";
import { hashPassword, verifyPassword } from "./auth.password";
import { sessionRepository, userRepository } from "./auth.repository";
import { createAccessToken, generateRefreshToken, hashRefreshToken } from "./auth.tokens";
import type { AuthResult, AuthTokens, NewSession } from "./auth.types";

function buildSession(userId: string): { refreshToken: string; session: NewSession } {
  const refreshToken = generateRefreshToken();
  return {
    refreshToken,
    session: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN * 1000),
    },
  };
}

async function startSession(userId: string): Promise<AuthTokens> {
  const { refreshToken, session } = buildSession(userId);
  await sessionRepository.create(session);
  logger.info({ event: "auth.session_created", userId }, "Session created");
  return { accessToken: createAccessToken(userId), refreshToken };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    if (await userRepository.findByEmail(input.email)) {
      throw AuthErrors.emailAlreadyRegistered();
    }

    const passwordHash = await hashPassword(input.password);

    let user: AuthUser;
    try {
      user = await userRepository.create({ name: input.name, email: input.email, passwordHash });
    } catch (error) {
      // A concurrent registration for the same email won the race.
      if (isPrismaError(error, "P2002")) throw AuthErrors.emailAlreadyRegistered();
      throw error;
    }

    logger.info({ event: "auth.registered", userId: user.id }, "User registered");
    return { user, tokens: await startSession(user.id) };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const credentials = await userRepository.findCredentialsByEmail(input.email);
    const passwordMatches = await verifyPassword(credentials?.passwordHash, input.password);

    if (!credentials || !passwordMatches) {
      logger.warn({ event: "auth.login_failed" }, "Login failed");
      throw AuthErrors.invalidCredentials();
    }

    const { passwordHash: _passwordHash, ...user } = credentials;
    logger.info({ event: "auth.login_succeeded", userId: user.id }, "Login succeeded");
    return { user, tokens: await startSession(user.id) };
  },

  async refresh(refreshToken: string | undefined): Promise<AuthTokens> {
    if (!refreshToken) throw AuthErrors.invalidRefreshToken();

    const current = await sessionRepository.findByTokenHash(hashRefreshToken(refreshToken));
    // A revoked token being presented again can indicate a stolen, replayed token.
    const rejection = !current
      ? "unknown_token"
      : current.revokedAt
        ? "revoked_token_reused"
        : current.expiresAt <= new Date()
          ? "session_expired"
          : null;
    if (rejection || !current) {
      logger.warn(
        { event: "auth.refresh_rejected", reason: rejection, userId: current?.userId },
        "Refresh rejected",
      );
      throw rejection === "session_expired"
        ? AuthErrors.sessionExpired()
        : AuthErrors.invalidRefreshToken();
    }

    const { refreshToken: nextRefreshToken, session } = buildSession(current.userId);
    const rotated = await sessionRepository.rotate(current.id, session);
    if (!rotated) {
      logger.warn(
        { event: "auth.refresh_rejected", reason: "concurrent_rotation", userId: current.userId },
        "Refresh rejected",
      );
      throw AuthErrors.invalidRefreshToken();
    }

    logger.info({ event: "auth.session_rotated", userId: current.userId }, "Session rotated");
    return { accessToken: createAccessToken(current.userId), refreshToken: nextRefreshToken };
  },

  /** Safe to call with a missing, unknown, expired, or already-revoked token. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await sessionRepository.revokeByTokenHash(hashRefreshToken(refreshToken));
    logger.info({ event: "auth.session_revoked" }, "Session revoked");
  },

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await userRepository.findById(userId);
    // A valid token for a since-deleted user is treated as unauthenticated.
    if (!user) throw AuthErrors.authenticationRequired();
    return user;
  },
};
