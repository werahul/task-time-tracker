import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

const testEnvPath = path.resolve(__dirname, ".env.test");
if (!existsSync(testEnvPath)) {
  throw new Error("Missing apps/api/.env.test — copy .env.test.example and point it at a test DB.");
}

// Loaded before any app module so src/config/env.ts sees test values, and
// `override` guarantees a developer's shell/.env can't redirect tests elsewhere.
config({ path: testEnvPath, override: true });
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // Test files share one database, so they must not run concurrently.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
