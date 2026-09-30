import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
// Upper bound keeps Argon2 hashing cost bounded against oversized inputs.
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email is too long");

export const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  email: emailSchema,
  password: z
    .string({ required_error: "Password is required" })
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** The only user fields ever returned by the API. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}
