# Runbook: set the missing ni-brain-sync GitHub Actions secrets

Ticket: `MATCHFIT-NI-BRAIN-SYNC-SECRETS-MISSING-0921`
JB: "Add the key" (approved).

## What's broken
`.github/workflows/*ni-brain-sync*` (matchfit) fails on every push to `main` because
two repo secrets were never set on `northsideventuresllc-sketch/matchfit`:

- `NI_BRAIN_SUPABASE_URL`
- `NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY`

Confirmed via `gh secret list` — both absent. This does **not** block Vercel prod
deploys (they don't depend on this workflow); it only means every `ni-brain:sync`
Action run has been failing silently since it was added.

## Why this PR is docs-only
Setting a live secret value is out of scope for an automated build/PR lane (no
secrets in git, no live-credential handling by this session). This runbook exists so
an attended session (or JB directly) can apply the exact fix in under a minute.

## Exact apply step (attended session only)
```bash
# Values: NI-Brain Supabase project kxijunwgbrlfzvgkhklo — same project already used
# by every other NVG repo's NI-Brain sync (northside-intelligence, AXON, nv-vault).
# Pull the values from ni_platform_secrets rather than typing them by hand:
#   select value from ni_platform_secrets where key='NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY';
#   (URL is the project's standard https://kxijunwgbrlfzvgkhklo.supabase.co)

gh secret set NI_BRAIN_SUPABASE_URL \
  --repo northsideventuresllc-sketch/matchfit \
  --body "https://kxijunwgbrlfzvgkhklo.supabase.co"

gh secret set NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY \
  --repo northsideventuresllc-sketch/matchfit \
  --body "<value from ni_platform_secrets, NOT typed into this file>"
```

## Verify
Re-run the `ni-brain-sync` workflow (Actions tab → "Run workflow", or push a trivial
commit to `main`) and confirm the job that was exiting 1 on the missing-secret check
now completes.
