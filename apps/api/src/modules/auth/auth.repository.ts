import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@task-time-tracker/shared";
import { prisma } from "../../lib/prisma";
import type { NewSession } from "./auth.types";

const safeUserSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;

export const userRepository = {
  findById(id: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({ where: { id }, select: safeUserSelect });
  },

  findByEmail(email: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({ where: { email }, select: safeUserSelect });
  },

  /** The only query that reads passwordHash; used solely for credential checks. */
  findCredentialsByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { ...safeUserSelect, passwordHash: true },
    });
  },

  create(data: { name: string; email: string; passwordHash: string }): Promise<AuthUser> {
    return prisma.user.create({ data, select: safeUserSelect });
  },
};

export const sessionRepository = {
  async create(data: NewSession): Promise<void> {
    await prisma.session.create({ data });
  },

  findByTokenHash(tokenHash: string) {
    return prisma.session.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  },

  /** Revokes the session matching the hash, if it is still active. Idempotent. */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  /**
   * Revokes `sessionId` and creates its replacement in one transaction.
   * The conditional update (revokedAt IS NULL) means that when two requests
   * race to rotate the same token, only one can win; the loser gets `false`.
   */
  rotate(sessionId: string, replacement: NewSession): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) return false;

      await tx.session.create({ data: replacement });
      return true;
    });
  },

  /** Housekeeping: removes sessions that can no longer be used. Returns rows deleted. */
  async deleteExpiredAndRevoked(now: Date = new Date()): Promise<number> {
    const { count } = await prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] },
    });
    return count;
  },
};
