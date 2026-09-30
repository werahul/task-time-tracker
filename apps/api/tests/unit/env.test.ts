import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env";

const STRONG_SECRET = "s".repeat(64);
const base = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
  ACCESS_TOKEN_SECRET: STRONG_SECRET,
};
const production = { ...base, NODE_ENV: "production", FRONTEND_URL: "https://app.example.com" };

function errorsFor(source: Record<string, string>) {
  const result = parseEnv(source);
  return result.success ? {} : result.error.flatten().fieldErrors;
}

describe("environment validation", () => {
  it("accepts a minimal development configuration with safe defaults", () => {
    const result = parseEnv(base);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      NODE_ENV: "development",
      FRONTEND_ORIGINS: ["http://localhost:3000"],
      TRUST_PROXY: 0,
      API_DOCS_ENABLED: true,
      ACCESS_TOKEN_EXPIRES_IN: 900,
    });
  });

  it("fails fast without the required secrets and database", () => {
    const errors = errorsFor({});

    expect(errors.DATABASE_URL).toBeDefined();
    expect(errors.ACCESS_TOKEN_SECRET).toBeDefined();
  });

  it.each([
    ["a short secret", { ACCESS_TOKEN_SECRET: "too-short" }, "ACCESS_TOKEN_SECRET"],
    [
      "the .env.example placeholder",
      { ACCESS_TOKEN_SECRET: "replace-with-a-long-random-secret" },
      "ACCESS_TOKEN_SECRET",
    ],
    ["a non-Postgres database URL", { DATABASE_URL: "mysql://localhost/app" }, "DATABASE_URL"],
    ["a malformed duration", { ACCESS_TOKEN_EXPIRES_IN: "15 minutes" }, "ACCESS_TOKEN_EXPIRES_IN"],
    ["SameSite=None outside production", { COOKIE_SAME_SITE: "none" }, "COOKIE_SAME_SITE"],
    ["an AI provider without a key", { AI_PROVIDER: "anthropic" }, "AI_API_KEY"],
    ["an unknown AI provider", { AI_PROVIDER: "someone-else" }, "AI_PROVIDER"],
    ["an invalid timezone", { APP_TIMEZONE: "Mars/Olympus" }, "APP_TIMEZONE"],
    ["an invalid frontend origin", { FRONTEND_URL: "not a url" }, "FRONTEND_URL"],
  ])("rejects %s", (_case, overrides, field) => {
    expect(errorsFor({ ...base, ...overrides })[field as "DATABASE_URL"]).toBeDefined();
  });

  it("treats blank optional values as unset", () => {
    const result = parseEnv({ ...base, AI_PROVIDER: "", AI_MODEL: "", LOG_LEVEL: "" });

    expect(result.success).toBe(true);
    expect(result.data?.AI_PROVIDER).toBeUndefined();
    expect(result.data?.AI_MODEL).toBe("claude-opus-5");
  });

  it.each([
    [{}, null],
    [{ RENDER_GIT_COMMIT: "2a43eacd1f2e3b4c5d6e7f8091a2b3c4d5e6f708" }, "2a43eac"],
    [{ VERCEL_GIT_COMMIT_SHA: "302af79f830f866260a4a2a5dc29e5e447652d69" }, "302af79"],
  ])("derives the short build commit from the platform (%o)", (overrides, expected) => {
    expect(parseEnv({ ...base, ...overrides }).data?.COMMIT).toBe(expected);
  });

  it.each([
    ["anthropic", undefined, "claude-opus-5"],
    ["gemini", undefined, "gemini-2.5-flash"],
    ["gemini", "gemini-custom-model", "gemini-custom-model"],
  ])("defaults AI_MODEL per provider (%s, AI_MODEL=%s)", (provider, model, expected) => {
    const result = parseEnv({ ...base, AI_PROVIDER: provider, AI_API_KEY: "key", AI_MODEL: model });

    expect(result.success).toBe(true);
    expect(result.data?.AI_MODEL).toBe(expected);
  });

  it("accepts a comma-separated list of frontend origins, normalized", () => {
    const result = parseEnv({
      ...base,
      FRONTEND_URL: "http://localhost:3000/, https://preview.example.com/path",
    });

    expect(result.data?.FRONTEND_ORIGINS).toEqual([
      "http://localhost:3000",
      "https://preview.example.com",
    ]);
  });

  describe("production", () => {
    it("accepts a hardened configuration and applies production defaults", () => {
      const result = parseEnv(production);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        TRUST_PROXY: 1,
        API_DOCS_ENABLED: false,
        LOG_LEVEL: "info",
      });
    });

    it.each([
      ["a non-https frontend origin", { FRONTEND_URL: "http://app.example.com" }, "FRONTEND_URL"],
      [
        "a secret under 64 characters",
        { ACCESS_TOKEN_SECRET: "x".repeat(40) },
        "ACCESS_TOKEN_SECRET",
      ],
      [
        "the test example secret",
        { ACCESS_TOKEN_SECRET: "test-only-secret-that-is-at-least-32-characters-long" },
        "ACCESS_TOKEN_SECRET",
      ],
    ])("rejects %s", (_case, overrides, field) => {
      expect(errorsFor({ ...production, ...overrides })[field as "FRONTEND_URL"]).toBeDefined();
    });
  });
});
