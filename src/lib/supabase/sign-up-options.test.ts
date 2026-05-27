import { describe, expect, it } from "vitest";
import { buildSupabaseSignUpOptions } from "@/lib/supabase/sign-up-options";

describe("buildSupabaseSignUpOptions", () => {
  it("includes captchaToken when turnstile token is present", () => {
    expect(
      buildSupabaseSignUpOptions({
        emailRedirectTo: "http://localhost:3000/auth/callback",
        turnstileToken: "abc123",
        data: { match_fit_role: "client" },
      }),
    ).toEqual({
      emailRedirectTo: "http://localhost:3000/auth/callback",
      data: { match_fit_role: "client" },
      captchaToken: "abc123",
    });
  });

  it("omits captchaToken when turnstile is disabled", () => {
    expect(
      buildSupabaseSignUpOptions({
        emailRedirectTo: "https://match-fit.net/auth/callback",
      }),
    ).toEqual({
      emailRedirectTo: "https://match-fit.net/auth/callback",
    });
  });
});
