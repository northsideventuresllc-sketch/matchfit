import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost && !forwardedHost.includes("localhost")) {
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

function resolvePostVerifyPath(user: { user_metadata?: Record<string, unknown> } | null): string {
  const meta = user?.user_metadata ?? {};
  const role = typeof meta.match_fit_role === "string" ? meta.match_fit_role : null;
  const pending = Boolean(meta.pending_match_fit_profile);

  if (role === "trainer") {
    return pending ? "/trainer/signup/complete" : "/trainer/onboarding";
  }
  if (role === "client") {
    return pending ? "/client/sign-up/complete" : "/client/subscribe";
  }
  return "/client/subscribe";
}

/**
 * Supabase Auth PKCE callback: exchanges `code` for a session and sets auth cookies on the response.
 * Redirects by `user.user_metadata.match_fit_role` and `pending_match_fit_profile`, or `?next=` when safe.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  const cookieStore = await cookies();
  const provisionalPath = "/client/subscribe";
  const response = NextResponse.redirect(new URL(provisionalPath, origin));

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession", error);
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = resolvePostVerifyPath(user);
  response.headers.set("Location", new URL(path, origin).toString());
  return response;
}
