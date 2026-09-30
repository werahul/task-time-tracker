import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../config/env";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

/** A client usable inside or outside a transaction; repositories accept it optionally. */
export type DbClient = Prisma.TransactionClient;

/** Runs `work` atomically. Lets a service compose repositories without touching Prisma directly. */
export function runInTransaction<T>(work: (db: DbClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(work);
}

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
