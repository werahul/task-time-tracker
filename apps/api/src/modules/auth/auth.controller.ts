import type { Request, Response } from "express";
import type { LoginInput, RegisterInput } from "@task-time-tracker/shared";
import { getAuthenticatedUser } from "../../middleware/authenticate.middleware";
import { sendSuccess } from "../../utils/api-response";
import { clearAuthCookies, readCookie, REFRESH_TOKEN_COOKIE, setAuthCookies } from "./auth.cookies";
import { authService } from "./auth.service";

// Request bodies below have already been parsed by `validateBody` in the routes.
export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.register(req.body as RegisterInput);
    setAuthCookies(res, tokens);
    sendSuccess(res, { user }, 201);
  },

  async login(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.login(req.body as LoginInput);
    setAuthCookies(res, tokens);
    sendSuccess(res, { user });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const tokens = await authService.refresh(readCookie(req, REFRESH_TOKEN_COOKIE));
      setAuthCookies(res, tokens);
      sendSuccess(res, { message: "Session refreshed" });
    } catch (error) {
      // A failed refresh means the session is unusable; drop the stale cookies.
      clearAuthCookies(res);
      throw error;
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(readCookie(req, REFRESH_TOKEN_COOKIE));
    clearAuthCookies(res);
    sendSuccess(res, { message: "Logged out" });
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getCurrentUser(getAuthenticatedUser(req).id);
    sendSuccess(res, { user });
  },
};
