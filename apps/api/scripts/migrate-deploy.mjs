// Applies committed migrations (`prisma migrate deploy`) over a connection that
// supports them. Prisma takes a session-level advisory lock while migrating;
// through a transaction-mode pooler (e.g. Neon's "-pooler" host) that lock can
// be left held on a pooled server connection, and the next deploy then times
// out with P1002. So: use DIRECT_DATABASE_URL when set, and refuse pooler hosts
// with an explanation instead of hanging.
import { spawnSync } from "node:child_process";
import "dotenv/config";

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Migrations need DATABASE_URL (or DIRECT_DATABASE_URL) to be set.");
  process.exit(1);
}

let host = "";
try {
  host = new URL(url).hostname;
} catch {
  // Let Prisma report a malformed URL.
}

if (host.includes("-pooler")) {
  console.error(
    [
      `Refusing to migrate through a connection pooler (${host}).`,
      "Prisma migrations need a direct database connection. Either:",
      "  - set DATABASE_URL to the direct connection string (host without '-pooler'), or",
      "  - keep the pooled DATABASE_URL for the app and set DIRECT_DATABASE_URL for migrations.",
    ].join("\n"),
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
