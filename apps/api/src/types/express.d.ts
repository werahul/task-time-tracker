import type { AuthenticatedUser } from "../modules/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. Read it via `getAuthenticatedUser(req)`. */
      user?: AuthenticatedUser;
    }
  }
}

export {};
