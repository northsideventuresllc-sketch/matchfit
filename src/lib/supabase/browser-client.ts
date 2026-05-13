import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/supabase/email-callback-url";

export function createMatchFitSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  return createBrowserClient(url, anon);
}

export function tryCreateMatchFitSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  try {
    return createMatchFitSupabaseBrowserClient();
  } catch {
    return null;
  }
}
