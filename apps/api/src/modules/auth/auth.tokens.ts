import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env";
import { AuthErrors } from "./auth.errors";

const ALGORITHM = "HS256";

const accessTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  type: z.literal("access"),
});

/** Access tokens carry only the user id and a type marker — no profile data. */
export function createAccessToken(userId: string): string {
  return jwt.sign({ type: "access" }, env.ACCESS_TOKEN_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    algorithm: ALGORITHM,
  });
}

export function verifyAccessToken(token: string): { userId: string } {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET, { algorithms: [ALGORITHM] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw AuthErrors.accessTokenExpired();
    throw AuthErrors.invalidAccessToken();
  }

  const payload = accessTokenPayloadSchema.safeParse(decoded);
  if (!payload.success) throw AuthErrors.invalidAccessToken();

  return { userId: payload.data.sub };
}

/** 256 bits of CSPRNG output; opaque to the client and never stored raw. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
