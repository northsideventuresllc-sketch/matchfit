# Runbook: make BasiaFitness and Kmfitness public

Ticket: `MF-HIDDEN-COACHES-0924`
JB: "Yes, make them public" (approved).

## Diagnosis (code-level, done in this PR)
Both accounts were checked directly against the live prod DB (Supabase
`qtesdsxrfggdlxdaraaq`) and against every visibility rule in
`src/lib/match-fit-public-marketplace-hidden.ts`:

- `hiddenFromPublicMarketplace` = `false` for both — not the DB per-account switch.
- `hasSignedTOS` = `true`, dashboard unlocked, no `internalQaSyntheticPersona`,
  no `/dev/fake-*` cert paths, `accountTier = null` (legacy trainers auto-pass
  the tier-based discovery check).
- Every code-level rule that `NOT { OR: hiddenTrainerOr() }`
  (`publicMarketplaceVisibleTrainerWhere` in the file above) checks says these
  two **should** already appear in public search.

That rules out a code bug. The one remaining rule this session cannot read is
env-based: `hiddenTrainerOr()` also excludes trainers whose email is in
`getOwnerHiddenLiveTrainerEmails()` — built-ins
(`MATCH_FIT_BUILTIN_OWNER_HIDDEN_LIVE_TRAINER_EMAILS`, currently just
`jb@northsideventures.com`) **plus** whatever is in the Vercel prod env var
`MATCH_FIT_OWNER_HIDDEN_LIVE_TRAINER_EMAILS` (comma-separated emails — see
`src/lib/match-fit-public-marketplace-hidden.ts`, `getOwnerHiddenLiveTrainerEmails`).
That env var's own doc comment is the exact match for this symptom: "Owner
production test portals — remain in launch/home totals but invisible on
public discovery" — which is precisely what's reported (both accounts are
counted/pre-verified but invisible in search). A second, lower-probability
candidate is a username-prefix match via `MATCH_FIT_TEST_TRAINER_USERNAMES`
(`getMatchFitLaunchExcludeTrainerUsernames`).

Reading the Vercel env directly (`filter_project_envs` on
`prj_f0fI7Sv3jbDWahMjrteYyJAQuFxy`) returns 403 for this session — dashboard-only,
per this repo's own standing rule ("ask JB only for net-new or dashboard-only
values"). No code change is needed or being made; this is an env value, not a bug.

## Exact env var change (Vercel dashboard, production)
1. Open the `matchfit` Vercel project → Settings → Environment Variables (production).
2. Find `MATCH_FIT_OWNER_HIDDEN_LIVE_TRAINER_EMAILS`.
3. Remove `basiafitness6@gmail.com` and `kmfitcoaching@gmail.com` from its
   comma-separated value (if present) and redeploy.
4. If that var does not contain them, check `MATCH_FIT_TEST_TRAINER_USERNAMES`
   for a prefix match against their usernames and remove it there instead.
5. Verify: public search for "Basia" / "Km" on match-fit.net now returns them.

No secret value, no DDL, no DB write — a plain env-list edit.
