import { argon2id, hash, verify } from "argon2";

// OWASP-recommended Argon2id baseline (19 MiB memory, 2 iterations, 1 lane).
const HASH_OPTIONS = { type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

/**
 * Verifies a password against a stored hash. When no hash is available (the
 * user does not exist) it verifies against a dummy hash instead, so an unknown
 * email costs the same time as a wrong password and can't be detected by timing.
 */
export async function verifyPassword(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  dummyHash ??= hashPassword("timing-equalization-placeholder");
  const hashToCheck = passwordHash ?? (await dummyHash);

  try {
    const matches = await verify(hashToCheck, password);
    return matches && passwordHash !== undefined;
  } catch {
    return false;
  }
}
