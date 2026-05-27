<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services overview

This is a Next.js 16 monolithic app (App Router + Turbopack) serving client, trainer, and admin portals. The only required local service beyond the Next.js server is PostgreSQL.

### Local PostgreSQL setup

The update script does NOT start PostgreSQL. Before running the dev server or integration tests, ensure PostgreSQL is running:

```bash
sudo pg_ctlcluster 16 main start
```

The local dev database uses `postgresql://matchfit:matchfit@localhost:5432/matchfit`. After starting Postgres, apply the schema with `npm run db:push` (runs `prisma generate` then `prisma db push`).

### Prisma ORM v7

- Client is generated to `src/generated/prisma` (`provider = "prisma-client"` in `prisma/schema.prisma`). CLI connection URLs live in `prisma.config.ts` (`DIRECT_URL` preferred, then `DATABASE_URL`).
- Runtime uses Direct TCP via `@prisma/adapter-pg` — import `prisma` only from server code (`@/lib/prisma`). Pure offering/questionnaire helpers live in `@/lib/trainer-service-offerings-document` (safe for `"use client"` modules).
- `npm run build` / `postinstall` run `prisma generate`. Builds without `DATABASE_URL` use a placeholder connection string during page-data collection only.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` (runs `prisma generate` via postinstall) |
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Tests | `npm run test` |
| Push schema | `npm run db:push` |
| Beta launch local setup | `npm run beta:setup` (creates `.env`, enables gates, `db push`) |
| Beta production env check | `npm run beta:preflight:production` (after Stripe/Resend keys in `.env`) |
| Push beta env to Vercel | `npm run beta:vercel-env` (after `npx vercel link`) |

### Scheduled jobs (waitlist + TOS cron)

`vercel.json` intentionally has **no** `crons` entry: Vercel **Hobby** rejects deploys when a cron runs more than once per day (`*/15 * * * *` fails at deploy time).

- **Hobby / default:** GitHub Actions workflow `.github/workflows/match-fit-tos-cron.yml` calls `GET /api/cron/match-fit-tos-jobs` every 15 minutes. Set repo secrets `CRON_SECRET` and `MATCH_FIT_APP_URL` (production URL, no trailing slash).
- **Vercel Pro:** You may copy `vercel.cron.pro.example.json` into `vercel.json` instead and rely on Vercel Cron.
| Seed admin | `MATCH_FIT_BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>' node --env-file=.env scripts/seed-bootstrap-admin.js` |

### Environment variables

Copy `.env.example` to `.env`. At minimum set `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET`. Set `MATCH_FIT_COOKIE_SECURE=0` for local HTTP. External services (Stripe, Supabase Auth, Resend, OpenAI) are optional for local dev — the app gracefully degrades without them.

### Testing notes

- Unit tests (`npm run test`) mock `next/headers` and delete `DATABASE_URL` unless `TEST_DATABASE_URL` is set. Most tests are pure logic tests and pass without a database.
- The `login-2fa.integration.test.ts` suite runs `prisma db push` itself when `DATABASE_URL` (or `TEST_DATABASE_URL`) is available — it just needs a running Postgres instance.
- ESLint uses flat config (`eslint.config.mjs`) with `eslint-config-next` — run via `npm run lint`.

### Admin login for manual testing

After seeding, admin portal is at `/admin/login`. Use staff code `jobo0602` with the password you set during seeding.
