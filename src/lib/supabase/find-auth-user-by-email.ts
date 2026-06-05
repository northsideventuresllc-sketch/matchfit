import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

export type SupabaseAuthUserSummary = {
  id: string;
  email_confirmed_at: Date | null;
  raw_user_meta_data: Record<string, unknown> | null;
};

type GoTrueAdminUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function mapGoTrueUser(user: GoTrueAdminUser): SupabaseAuthUserSummary {
  return {
    id: user.id,
    email_confirmed_at: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
    raw_user_meta_data: user.user_metadata ?? null,
  };
}

async function findViaGoTrueEmailFilter(email: string): Promise<SupabaseAuthUserSummary | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !serviceKey || !anonKey) return null;

  const res = await fetch(
    `${baseUrl}/auth/v1/admin/users?per_page=1&page=1&filter=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: anonKey,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.warn("[findSupabaseAuthUserByEmail] GoTrue filter lookup failed", res.status);
    return null;
  }

  const json = (await res.json()) as { users?: GoTrueAdminUser[] };
  const match =
    json.users?.find((user) => user.email?.trim().toLowerCase() === email) ?? json.users?.[0] ?? null;
  return match?.id ? mapGoTrueUser(match) : null;
}

async function findViaAdminListUsers(email: string): Promise<SupabaseAuthUserSummary | null> {
  const admin = createSupabaseAdminClient();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[findSupabaseAuthUserByEmail] listUsers", error);
      return null;
    }
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match?.id) return mapGoTrueUser(match);
    if (data.users.length < 200) break;
  }
  return null;
}

/** Resolve a Supabase Auth user by email using GoTrue admin APIs (no auth-schema SQL). */
export async function findSupabaseAuthUserByEmail(email: string): Promise<SupabaseAuthUserSummary | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const viaFilter = await findViaGoTrueEmailFilter(normalized);
    if (viaFilter) return viaFilter;
  } catch (e) {
    console.warn("[findSupabaseAuthUserByEmail] GoTrue filter lookup error", e);
  }

  try {
    return await findViaAdminListUsers(normalized);
  } catch (e) {
    console.error("[findSupabaseAuthUserByEmail] listUsers lookup error", e);
    return null;
  }
}
