import { describe, expect, it } from "vitest";
import { buildAuthCookieOptions } from "../../src/modules/auth/auth.cookies";

describe("auth cookie options", () => {
  it("are HttpOnly and Secure in production", () => {
    const { access, refresh } = buildAuthCookieOptions({ nodeEnv: "production", sameSite: "lax" });

    for (const options of [access, refresh]) {
      expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    }
  });

  it("are HttpOnly but not Secure on http://localhost in development", () => {
    const { access } = buildAuthCookieOptions({ nodeEnv: "development", sameSite: "lax" });

    expect(access).toMatchObject({ httpOnly: true, secure: false });
  });

  it("scope the refresh token to the auth endpoints only", () => {
    const { access, refresh } = buildAuthCookieOptions({
      nodeEnv: "production",
      sameSite: "strict",
    });

    expect(access.path).toBe("/");
    expect(refresh.path).toBe("/api/v1/auth");
    expect(refresh.sameSite).toBe("strict");
  });
});
