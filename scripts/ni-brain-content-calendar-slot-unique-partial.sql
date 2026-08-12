-- NI Brain Supabase: partial unique index for match_fit_content_calendar_posts slot uniqueness
-- (project kxijunwgbrlfzvgkhklo). Idempotent, safe to re-run.
--
-- Fixes MF-CAPTION-CRON-CONSTRAINT-BLOCK-0812: a plain UNIQUE(week_start, day_index, post_type)
-- index/constraint counted soft-deleted rows (deleted_at IS NOT NULL) as occupying a slot. A
-- bulk soft-delete ("wipe") left zombie rows behind that collided with the natural key on every
-- future insert for the same week/day/post-type combo, blocking the MF Caption Draft cron from
-- inserting any new draft for that slot. This scopes uniqueness to live rows only, matching how
-- the app already reads/writes the table (deleted_at IS NULL == live).
--
-- This table lives in NI-Brain (kxijunwgbrlfzvgkhklo), NOT in this app's own Postgres
-- (qtesdsxrfggdlxdaraaq) and NOT in prisma/schema.prisma -- match-fit reads/writes it through
-- src/lib/ni-brain-client.ts, a separate Supabase service-role client pointed at NI-Brain. Run
-- this script (not `prisma migrate`) against NI-Brain, same as the other scripts in this
-- directory (see ni-brain-content-hub-migration.sql, ni-brain-content-calendar-v2-migration.sql).

-- Defensively drop any legacy non-partial unique constraint/index on the same natural key, so a
-- from-scratch restore of this table doesn't end up with both a blocking plain unique index and
-- the partial one below.
DO $$
DECLARE
  legacy record;
BEGIN
  FOR legacy IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'match_fit_content_calendar_posts'::regclass
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%week_start%day_index%post_type%'
  LOOP
    EXECUTE format('ALTER TABLE match_fit_content_calendar_posts DROP CONSTRAINT %I', legacy.conname);
  END LOOP;

  FOR legacy IN
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'match_fit_content_calendar_posts'
      AND indexname <> 'match_fit_calendar_posts_slot_unique'
      AND indexdef ILIKE '%UNIQUE INDEX%'
      AND indexdef ILIKE '%week_start%day_index%post_type%'
      AND indexdef NOT ILIKE '%WHERE%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', legacy.indexname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS match_fit_calendar_posts_slot_unique
  ON match_fit_content_calendar_posts (week_start, day_index, post_type)
  WHERE deleted_at IS NULL;
