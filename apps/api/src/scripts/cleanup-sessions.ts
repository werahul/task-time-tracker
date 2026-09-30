import { prisma } from "../lib/prisma";
import { sessionRepository } from "../modules/auth/auth.repository";

async function main() {
  const deleted = await sessionRepository.deleteExpiredAndRevoked();
  console.info(`Deleted ${deleted} expired or revoked session(s)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
