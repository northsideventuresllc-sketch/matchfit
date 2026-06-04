# Supabase Auth + Cloudflare Turnstile

Match Fit uses Turnstile on **Match Fit API routes** (`turnstileToken` in JSON) and on **Supabase Auth** (`captchaToken` in `signUp` options) when Supabase is enabled.

## Local development (`.env.local`)

Copy [`.env.local.example`](../.env.local.example) to `.env.local`:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

These are [Cloudflare’s documented test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) — the widget always succeeds and siteverify accepts any token.

Restart `npm run dev` after changing env vars so `NEXT_PUBLIC_*` reloads.

## Supabase project settings

1. Open **Authentication** → **Attack Protection** (or **Bot and Abuse Protection**).
2. Enable **CAPTCHA protection**.
3. Provider: **Cloudflare Turnstile**.
4. **Secret key**:
   - **Local:** `1x0000000000000000000000000000000AA` (dummy secret, same as `TURNSTILE_SECRET_KEY` in `.env.local`).
   - **Production:** the real secret from your Turnstile widget (same value as Vercel `TURNSTILE_SECRET_KEY`).

5. Under **URL configuration**, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://match-fit.net/auth/callback` (production)

## App behavior

- Registration UIs read `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and render [`TurnstileWidget`](../src/components/turnstile-widget.tsx).
- On submit, the token is sent to:
  - Match Fit APIs as `turnstileToken` (verified in [`verifyTurnstileToken`](../src/lib/turnstile-verify.ts)).
  - `supabase.auth.signUp({ options: { captchaToken } })` via [`buildSupabaseSignUpOptions`](../src/lib/supabase/sign-up-options.ts).

## Health check

- Local / prod: `GET /api/public/turnstile-status`  
  With dummy keys, expect `"usingDummyKeys": true` and `"healthy": true`.
- Signup verification delivery: `GET /api/public/signup-verification-email-health`  
  Expect `"deliveryConfigured": true` when `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are set in Production.

## Signup verification email delivery

Supabase Auth still creates the user on `signUp`, but Match Fit **delivers the confirmation link through Resend** (verified match-fit.net domain) when `SUPABASE_SERVICE_ROLE_KEY` is set. Without it, delivery falls back to Supabase’s built-in SMTP, which is often delayed or filtered.

After deploy, trainer sign-up shows **Resend verification email** if the first message does not arrive.
