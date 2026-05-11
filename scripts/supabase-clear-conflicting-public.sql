-- Supabase ships a template `public.profiles` table with FK → auth.users.
-- Prisma cannot introspect/push until that cross-schema FK is gone (unless you adopt multi-schema Prisma models for auth).
-- Safe to drop if you only use Match Fit tables + Prisma (not Supabase Auth profiles).

DROP TABLE IF EXISTS public.profiles CASCADE;
