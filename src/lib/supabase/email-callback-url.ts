/** Production email confirmation redirect (Supabase PKCE). Override in staging with NEXT_PUBLIC_SUPABASE_EMAIL_CALLBACK_URL. */
const DEFAULT_EMAIL_CALLBACK = "https://match-fit.net/auth/callback";

export function getSupabaseEmailCallbackUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_EMAIL_CALLBACK_URL?.trim();
  if (u && /^https?:\/\//i.test(u)) return u.replace(/\/$/, "");
  return DEFAULT_EMAIL_CALLBACK;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}
