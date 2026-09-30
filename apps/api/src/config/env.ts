import "dotenv/config";
import { z } from "zod";
import { DURATION_PATTERN, parseDurationToSeconds } from "../utils/duration";
import { isValidTimeZone } from "../utils/timezone";

const durationInSeconds = z
  .string()
  .regex(DURATION_PATTERN, "must be a duration such as 30s, 15m, 12h or 7d")
  .transform(parseDurationToSeconds);

/** `KEY=` in a .env file yields "", which should mean "not set". */
function blankAsUnset<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

const booleanFlag = z.enum(["true", "false"]).transform((value) => value === "true");

/** Comma-separated origins, each normalized to a bare origin for exact matching. */
const originList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().url("each FRONTEND_URL entry must be a URL")).min(1))
  .transform((urls) => [...new Set(urls.map((url) => new URL(url).origin))]);

// Copied from the .env examples; never acceptable as a real secret.
const PLACEHOLDER_SECRET = "replace-with-a-long-random-secret";
// From .env.test.example; fine for tests, never for production.
const TEST_EXAMPLE_SECRET = "test-only-secret-that-is-at-least-32-characters-long";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    LOG_LEVEL: blankAsUnset(
      z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
    ),
    /** Trusted frontend origin(s): CORS and the state-changing Origin check. */
    FRONTEND_URL: originList.default("http://localhost:3000"),
    /** Reverse-proxy hops to trust for client IPs (rate limiting). Default: 1 in production. */
    TRUST_PROXY: blankAsUnset(z.coerce.number().int().min(0).max(10).optional()),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(10_000),
    /** Serve /api/v1/docs and /api/v1/openapi.json. Default: off in production. */
    API_DOCS_ENABLED: blankAsUnset(booleanFlag.optional()),

    DATABASE_URL: z
      .string({ required_error: "DATABASE_URL is required" })
      .url("DATABASE_URL must be a valid connection string")
      .refine((url) => /^postgres(ql)?:\/\//.test(url), "DATABASE_URL must be a PostgreSQL URL"),

    ACCESS_TOKEN_SECRET: z
      .string({ required_error: "ACCESS_TOKEN_SECRET is required" })
      .min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters")
      .refine(
        (secret) => secret !== PLACEHOLDER_SECRET,
        "ACCESS_TOKEN_SECRET is still the example placeholder; generate a real secret",
      ),
    ACCESS_TOKEN_EXPIRES_IN: durationInSeconds.default("15m"),
    REFRESH_TOKEN_EXPIRES_IN: durationInSeconds.default("7d"),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

    // Per-IP limits. Login and register each get AUTH_RATE_LIMIT_MAX per window.
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    AUTH_RATE_LIMIT_WINDOW: durationInSeconds.default("15m"),
    AUTH_REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    // Baseline for every /api request.
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    API_RATE_LIMIT_WINDOW: durationInSeconds.default("1m"),

    // Defines "today" for the daily summary when the client sends no timezone.
    APP_TIMEZONE: z
      .string()
      .default("UTC")
      .refine(isValidTimeZone, "APP_TIMEZONE must be an IANA timezone, e.g. UTC or Asia/Kolkata"),

    // --- AI task assistant (optional; unset AI_PROVIDER disables it) ---------
    // Server-side only: none of these are ever sent to the browser.
    AI_PROVIDER: blankAsUnset(z.enum(["anthropic"]).optional()),
    AI_API_KEY: blankAsUnset(z.string().optional()),
    AI_MODEL: blankAsUnset(z.string().default("claude-opus-5")),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
    AI_MAX_INPUT_LENGTH: z.coerce.number().int().min(10).max(4000).default(1000),
    AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    AI_RATE_LIMIT_WINDOW: durationInSeconds.default("15m"),
  })
  .superRefine((env, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (env.COOKIE_SAME_SITE === "none" && env.NODE_ENV !== "production") {
      fail("COOKIE_SAME_SITE", "COOKIE_SAME_SITE=none requires Secure cookies (production only)");
    }
    if (env.AI_PROVIDER && !env.AI_API_KEY) {
      fail("AI_API_KEY", "AI_API_KEY is required when AI_PROVIDER is set");
    }
    if (env.NODE_ENV === "production") {
      if (env.FRONTEND_URL.some((origin) => !origin.startsWith("https://"))) {
        fail("FRONTEND_URL", "FRONTEND_URL origins must use https in production");
      }
      if (env.ACCESS_TOKEN_SECRET === TEST_EXAMPLE_SECRET) {
        fail("ACCESS_TOKEN_SECRET", "ACCESS_TOKEN_SECRET is the test example secret");
      }
      if (env.ACCESS_TOKEN_SECRET.length < 64) {
        fail(
          "ACCESS_TOKEN_SECRET",
          "ACCESS_TOKEN_SECRET must be at least 64 characters in production",
        );
      }
    }
  })
  .transform(({ FRONTEND_URL, TRUST_PROXY, API_DOCS_ENABLED, LOG_LEVEL, ...env }) => {
    const production = env.NODE_ENV === "production";
    return {
      ...env,
      FRONTEND_ORIGINS: FRONTEND_URL,
      TRUST_PROXY: TRUST_PROXY ?? (production ? 1 : 0),
      API_DOCS_ENABLED: API_DOCS_ENABLED ?? !production,
      LOG_LEVEL: LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : "info"),
    };
  });

export type Env = z.output<typeof envSchema>;

/** Parses configuration; exported separately so the rules can be unit-tested. */
export function parseEnv(source: Record<string, string | undefined>) {
  return envSchema.safeParse(source);
}

function loadEnv(): Env {
  const parsed = parseEnv(process.env);

  if (!parsed.success) {
    // Fail fast. Only field names and rule messages are printed — never values.
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

/** Validated configuration. Durations are in seconds unless the name says _MS. */
export const env = loadEnv();
