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

The local dev database uses `postgresql://matchfit:matchfit@localhost:5432/matchfit`. After starting Postgres, apply the schema with `npx prisma db push`.

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
| Seed admin | `MATCH_FIT_BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>' node --env-file=.env scripts/seed-bootstrap-admin.js` |

### Environment variables

Copy `.env.example` to `.env`. At minimum set `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET`. Set `MATCH_FIT_COOKIE_SECURE=0` for local HTTP. External services (Stripe, Supabase Auth, Resend, OpenAI) are optional for local dev — the app gracefully degrades without them.

### Testing notes

- Unit tests (`npm run test`) mock `next/headers` and delete `DATABASE_URL` unless `TEST_DATABASE_URL` is set. Most tests are pure logic tests and pass without a database.
- The `login-2fa.integration.test.ts` suite runs `prisma db push` itself when `DATABASE_URL` (or `TEST_DATABASE_URL`) is available — it just needs a running Postgres instance.
- ESLint uses flat config (`eslint.config.mjs`) with `eslint-config-next` — run via `npm run lint`.

### Admin login for manual testing

After seeding, admin portal is at `/admin/login`. Use staff code `jobo0602` with the password you set during seeding.
