-- Sensitive Checkr vendor references (service-role only). Apply in Supabase SQL editor or via CLI.
create table if not exists public.trainer_checkr_vault (
  trainer_id text primary key,
  checkr_candidate_id text,
  checkr_report_id text,
  checkr_invitation_id text,
  report_portal_url text,
  last_webhook_type text,
  last_webhook_payload jsonb,
  updated_at timestamptz not null default now()
);

alter table public.trainer_checkr_vault enable row level security;

-- No policies: anon/authenticated cannot read or write; server uses service role only.
