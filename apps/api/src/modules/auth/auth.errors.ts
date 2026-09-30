import { AppError } from "../../lib/app-error";

export const AuthErrors = {
  authenticationRequired: () =>
    new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required"),
  invalidAccessToken: () => new AppError(401, "INVALID_ACCESS_TOKEN", "Invalid access token"),
  accessTokenExpired: () => new AppError(401, "ACCESS_TOKEN_EXPIRED", "Access token has expired"),
  // Deliberately identical for unknown email and wrong password.
  invalidCredentials: () => new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password"),
  invalidRefreshToken: () => new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token"),
  sessionExpired: () =>
    new AppError(401, "SESSION_EXPIRED", "Your session has expired, please log in again"),
  emailAlreadyRegistered: () =>
    new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists"),
};
