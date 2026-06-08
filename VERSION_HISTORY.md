# Match Fit version history

Automated log from `npm run version:bump`. UI labels derive from `package.json` via `src/lib/match-fit-product-version.ts`.

## Entries

- **2026-06-08** `1.3.2-beta` → `1.4.0-beta` (**minor** — Admin portal tracking cleanup: member overview, pipelines, site activity, support inbox, email stats)
- **2026-06-08** `1.3.1-beta` → `1.3.2-beta` (**minor** — Admin Ad Tracking HQ, Outreach HQ, content calendar, and platform growth analytics merged with signup flow)
- **2026-06-08** `1.3.0-beta` → `1.3.1-beta` (**patch** — Fix client signup enrich typing for deploy)
- **2026-06-08** `1.2.2-beta` → `1.3.0-beta` (**minor** — Form analytics events, streamlined client signup, trainer account at TOS with 7-day onboarding fee)
- **2026-06-06** `1.2.1-beta` → `1.3.0-beta` (**minor** — Admin Ad Tracking HQ, Outreach HQ, content calendar, and platform growth analytics)
- **2026-06-05** `1.2.1-beta` → `1.2.2-beta` (**patch** — Hydrate Anthropic admin assistant keys from platform_secrets)
- **2026-06-05** `1.2.0-beta` → `1.2.1-beta` (**patch** — Admin assistant uses Anthropic when ANTHROPIC_API_KEY is set)
- **2026-06-05** `1.1.17-beta` → `1.2.0-beta` (**minor** — Admin portal stats, AI assistant redesign with past chats, valuation, potential success score, stats timestamp, dashboard organization)
- **2026-06-05** `1.2.0-beta` → `1.2.1-beta` (**patch** — Hide owner test accounts from public discovery, FitHub, and daily questionnaires)
- **2026-06-05** `1.1.4-beta` → `1.2.0-beta` (**minor** — Admin AI prompt-first assistant, potential rating, and revenue projection)
- **2026-06-05** `1.1.16-beta` → `1.1.17-beta` (**patch** — Signup email health validates Resend API)
- **2026-06-05** `1.1.15-beta` → `1.1.16-beta` (**patch** — Resend health uses platform_secrets key for probe)
- **2026-06-05** `1.1.14-beta` → `1.1.15-beta` (**patch** — Resend platform_secrets hydration for 2FA email)
- **2026-06-05** `1.1.13-beta` → `1.1.14-beta` (**patch** — 2FA email health probe and OTP delivery fallback)
- **2026-06-05** `1.1.12-beta` → `1.1.13-beta` (**patch** — Read platform_secrets via session pooler SQL)
- **2026-06-05** `1.1.11-beta` → `1.1.12-beta` (**patch** — Vercel session pooler for DDL bootstrap)
- **2026-06-05** `1.1.10-beta` → `1.1.11-beta` (**patch** — Bootstrap Stripe via direct Postgres SQL)
- **2026-06-05** `1.1.9-beta` → `1.1.10-beta` (**patch** — Bootstrap platform_secrets DDL self-heal)
- **2026-06-05** `1.1.8-beta` → `1.1.9-beta` (**patch** — Live Stripe keys bootstrap and platform_secrets fallback)
- **2026-06-05** `1.1.7-beta` → `1.1.8-beta` (**patch** — Strip sslmode override for Supabase Prisma TLS)
- **2026-06-05** `1.1.6-beta` → `1.1.7-beta` (**patch** — Fix Supabase TLS for Prisma admin portal)
- **2026-06-05** `1.1.5-beta` → `1.1.6-beta` (**patch**)
- **2026-06-05** `1.1.3-beta` → `1.1.4-beta` (**patch** — Trainer signup step navigation and TikTok icon fix)
- **2026-06-04** `1.1.2-beta` → `1.1.3-beta` (**patch** — Accurate social icons, beta banner mobile layout, and sign-up DOB field clamp)
- **2026-06-04** `1.1.1-beta` → `1.1.2-beta` (**patch**) — Automatic product version policy and bump tooling (this change)
