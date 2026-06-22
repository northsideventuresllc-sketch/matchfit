import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Reads the Supabase Auth user from request cookies for short-lived, read-mostly
 * route handlers (e.g. the trainer onboarding draft endpoint). Does not write
 * refreshed session cookies back — callers run right after `/auth/callback`
 * already established a fresh session, so refresh is not needed here.
 */
export async function getSupabaseRouteUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No-op: this helper is read-only and does not refresh session cookies.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
