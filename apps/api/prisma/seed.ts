/**
 * Demo data: one fictional user with a small, realistic week of tasks and time.
 *
 *   npm run db:seed                  # create the demo user if it doesn't exist
 *   npm run db:seed:reset            # (not in production) rebuild the demo user's data
 *
 * Safe by default: if the demo user already exists, nothing is changed — the
 * seed never overwrites or deletes data unless --reset is passed, and --reset
 * is refused when NODE_ENV=production. It only ever touches the demo user.
 *
 * Credentials: DEMO_USER_EMAIL (default demo@example.com) and
 * DEMO_USER_PASSWORD. In production the password is required and must not be
 * the development default; share it with evaluators out of band.
 */
import "dotenv/config";
import { Prisma, PrismaClient, TaskStatus } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/auth.password";

const prisma = new PrismaClient();

const production = process.env.NODE_ENV === "production";
const reset = process.argv.includes("--reset");

// Local development convenience only; rejected in production.
const DEV_DEFAULT_PASSWORD = "demo-password-123";
const email = (process.env.DEMO_USER_EMAIL || "demo@example.com").trim().toLowerCase();
const password = process.env.DEMO_USER_PASSWORD || (production ? "" : DEV_DEFAULT_PASSWORD);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface DemoTask {
  title: string;
  description?: string;
  status: TaskStatus;
  /** For COMPLETED tasks: how long ago it was completed. */
  completedAgo?: number;
  /** Past sessions: [how long ago it started, duration]. All end before "now". */
  sessions: [startedAgo: number, duration: number][];
}

const DEMO_TASKS: DemoTask[] = [
  {
    title: "Build authentication API",
    description: "Register, login, refresh-token rotation and logout with HttpOnly cookies.",
    status: TaskStatus.COMPLETED,
    completedAgo: 1 * DAY,
    sessions: [
      [3 * DAY + 2 * HOUR, 1 * HOUR + 20 * MINUTE],
      [2 * DAY + 5 * HOUR, 45 * MINUTE],
      [1 * DAY + 3 * HOUR, 1 * HOUR + 50 * MINUTE],
    ],
  },
  {
    title: "Design dashboard",
    description: "Daily summary cards, weekly chart and top tasks.",
    status: TaskStatus.IN_PROGRESS,
    sessions: [
      [1 * DAY + 6 * HOUR, 35 * MINUTE],
      [4 * HOUR, 1 * HOUR + 15 * MINUTE],
    ],
  },
  {
    title: "Write documentation",
    description: "README: setup, architecture, API reference and deployment.",
    status: TaskStatus.IN_PROGRESS,
    sessions: [
      [4 * DAY + 3 * HOUR, 40 * MINUTE],
      [2 * HOUR, 45 * MINUTE],
    ],
  },
  { title: "Deploy application", status: TaskStatus.PENDING, sessions: [] },
];

async function createDemoData(tx: Prisma.TransactionClient, userId: string, now: number) {
  for (const task of DEMO_TASKS) {
    const created = await tx.task.create({
      data: {
        userId,
        title: task.title,
        description: task.description ?? null,
        status: task.status,
        completedAt: task.completedAgo ? new Date(now - task.completedAgo) : null,
      },
    });
    await tx.timeLog.createMany({
      data: task.sessions.map(([startedAgo, duration]) => ({
        userId,
        taskId: created.id,
        startedAt: new Date(now - startedAgo),
        stoppedAt: new Date(now - startedAgo + duration),
        durationSeconds: duration / 1000,
      })),
    });
  }
}

async function main() {
  if (!password) {
    throw new Error("DEMO_USER_PASSWORD is required in production.");
  }
  if (production && password === DEV_DEFAULT_PASSWORD) {
    throw new Error("DEMO_USER_PASSWORD must not be the development default in production.");
  }
  if (password.length < 8) {
    throw new Error("DEMO_USER_PASSWORD must be at least 8 characters.");
  }
  if (production && reset) {
    throw new Error("--reset is not allowed in production; the seed never overwrites data there.");
  }

  // Whole minutes, so stored durations match the timestamps exactly (CHECK constraint).
  const now = Math.floor(Date.now() / MINUTE) * MINUTE;
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && !reset) {
    console.log(`Demo user ${email} already exists; nothing changed (use --reset in development).`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    let userId: string;
    if (existing) {
      // --reset (development only): the demo user's tasks and logs cascade away.
      await tx.task.deleteMany({ where: { userId: existing.id } });
      await tx.user.update({ where: { id: existing.id }, data: { passwordHash } });
      userId = existing.id;
    } else {
      userId = (await tx.user.create({ data: { name: "Demo User", email, passwordHash } })).id;
    }
    await createDemoData(tx, userId, now);
  });

  const shownPassword = production ? "(from DEMO_USER_PASSWORD)" : password;
  console.log(`Seeded demo user: ${email} / ${shownPassword}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
