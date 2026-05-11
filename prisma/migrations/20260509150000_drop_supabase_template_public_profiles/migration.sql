-- Supabase ships a template `public.profiles` with FK → `auth.users`. That
-- cross-schema constraint forces `auth` into Prisma’s `schemas` and breaks
-- `db push` when combined with minimal `auth.*` stubs. Match Fit does not use
-- this table (see `scripts/supabase-clear-conflicting-public.sql`).

DROP TABLE IF EXISTS public.profiles CASCADE;
