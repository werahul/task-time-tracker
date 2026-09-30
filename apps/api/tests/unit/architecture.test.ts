import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static guards for the layering and ownership rules, so a regression fails CI
// instead of relying on review.

const MODULES_DIR = path.resolve(__dirname, "../../src/modules");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

const files = sourceFiles(MODULES_DIR).map((file) => ({
  name: path.relative(MODULES_DIR, file).replaceAll("\\", "/"),
  source: readFileSync(file, "utf8"),
}));
const byKind = (suffix: string) => files.filter((f) => f.name.endsWith(suffix));

// Importing the `prisma` client object itself (helpers like runInTransaction are fine).
const IMPORTS_PRISMA_CLIENT = /import\s*{[^}]*\bprisma\b[^}]*}\s*from\s*["'][./]+lib\/prisma["']/;

describe("architecture", () => {
  it("finds the module sources", () => {
    expect(byKind(".repository.ts").length).toBeGreaterThanOrEqual(4);
    expect(byKind(".controller.ts").length).toBeGreaterThanOrEqual(5);
  });

  it("controllers never touch the database", () => {
    for (const { name, source } of byKind(".controller.ts")) {
      expect(source, name).not.toMatch(/lib\/prisma|@prisma\/client/);
    }
  });

  it("services never import the Prisma client (queries live in repositories)", () => {
    for (const { name, source } of byKind(".service.ts")) {
      expect(source, name).not.toMatch(IMPORTS_PRISMA_CLIENT);
      expect(source, name).not.toMatch(/prisma\.(task|timeLog|user|session)\./);
    }
  });

  it("controllers and services never read userId from the request body, query, or params", () => {
    for (const { name, source } of [...byKind(".controller.ts"), ...byKind(".service.ts")]) {
      expect(source, name).not.toMatch(/req\.(body|query|params)\.userId/);
      expect(source, name).not.toMatch(/\{\s*userId\s*\}\s*=\s*req\.(body|query|params)/);
    }
  });

  it("repositories never look up a task or time log by id alone", () => {
    for (const { name, source } of byKind(".repository.ts")) {
      // Protected resources are fetched with findFirst/updateMany/deleteMany plus userId.
      expect(source, name).not.toMatch(/prisma\.(task|timeLog)\.findUnique/);
    }
  });
});
