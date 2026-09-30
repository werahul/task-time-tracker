import { execSync } from "node:child_process";

export default function setup(): void {
  const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against "${databaseName}": the test DATABASE_URL must name a *_test database.`,
    );
  }

  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
