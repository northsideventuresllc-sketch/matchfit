# Match Fit version history

Automated log from `npm run version:bump`. UI labels derive from `package.json` via `src/lib/match-fit-product-version.ts`.

## Entries

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
- **2026-06-05** `1.1.4-beta` → `1.1.5-beta` (**patch**)
- **2026-06-05** `1.1.3-beta` → `1.1.4-beta` (**patch**)
- **2026-06-04** `1.1.2-beta` → `1.1.3-beta` (**patch** — Accurate social icons, beta banner mobile layout, and sign-up DOB field clamp)
- **2026-06-04** `1.1.1-beta` → `1.1.2-beta` (**patch**) — Automatic product version policy and bump tooling (this change)
