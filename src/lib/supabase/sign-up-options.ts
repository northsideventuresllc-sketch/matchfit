/**
 * Supabase Auth signUp `options` including Turnstile CAPTCHA when configured.
 * @see https://supabase.com/docs/guides/auth/auth-captcha
 */
export type SupabaseSignUpOptionsInput = {
  emailRedirectTo: string;
  /** Turnstile response token from the widget (`getResponse`). */
  turnstileToken?: string | null;
  data?: Record<string, unknown>;
};

export function buildSupabaseSignUpOptions(input: SupabaseSignUpOptionsInput): {
  emailRedirectTo: string;
  data?: Record<string, unknown>;
  captchaToken?: string;
} {
  const options: {
    emailRedirectTo: string;
    data?: Record<string, unknown>;
    captchaToken?: string;
  } = {
    emailRedirectTo: input.emailRedirectTo,
  };
  if (input.data) options.data = input.data;
  const token = input.turnstileToken?.trim();
  if (token) options.captchaToken = token;
  return options;
}
