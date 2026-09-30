import { Router } from "express";
import { loginSchema, registerSchema } from "@task-time-tracker/shared";
import { env } from "../../config/env";
import { authenticate } from "../../middleware/authenticate.middleware";
import { createRateLimiter } from "../../middleware/rate-limit.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { authController } from "./auth.controller";

// Per-IP limits (configurable). Skipped under NODE_ENV=test so suites can make
// many requests; the limiter itself is covered by its own tests.
const skipInTests = () => env.NODE_ENV === "test";
const windowMs = env.AUTH_RATE_LIMIT_WINDOW * 1000;

const registerLimiter = createRateLimiter({
  name: "auth.register",
  windowMs,
  limit: env.AUTH_RATE_LIMIT_MAX,
  skip: skipInTests,
});
const loginLimiter = createRateLimiter({
  name: "auth.login",
  windowMs,
  limit: env.AUTH_RATE_LIMIT_MAX,
  skip: skipInTests,
});
const refreshLimiter = createRateLimiter({
  name: "auth.refresh",
  windowMs,
  limit: env.AUTH_REFRESH_RATE_LIMIT_MAX,
  skip: skipInTests,
});

export const authRouter = Router();

authRouter.post(
  "/register",
  registerLimiter,
  validateBody(registerSchema),
  authController.register,
);
authRouter.post("/login", loginLimiter, validateBody(loginSchema), authController.login);
authRouter.post("/refresh", refreshLimiter, authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
