# Agent dispatch queue — Match Fit

| Item | Repo | Status | Lane | Next action |
|------|------|--------|------|-------------|
| AT1 Ad Tracker (campaign registry + TikTok UTM) | matchfit | **SHIPPED** — PR #289 | — | Verify `/admin/ad-tracking` live |
| AT2 Ad Tracker phase 2 (Meta/Google API, CAPI, GA4, TikTok sync) | matchfit | **SHIPPED** — PR #290 | — | Push env via `vercel:env:ad-platform` |
| MF-META-SPEND Insights spend sync (ads_read + act_ account) | matchfit | **SHIPPED** — PR #295 | — | JB: System User ads_read if Insights still blocked; then Sync now |
| F1 RLS-8 (8 exposed tables) | matchfit | **SHIPPED** — PR #291 | — | Verify Supabase advisor clears 8 warnings |
| M1 Align marketing to 8-step model | matchfit | **SHIPPED** — PR #292 | — | Playbook live in admin surfaces |
| B1 B2C runbook 5b–6b | matchfit | **SHIPPED** — PR #293 | — | Live at `/admin/ad-tracking` |
| MF-OUT-COWORK Cowork autonomy (brief API + intent + underfill/save) | matchfit | **SHIPPED** — PR #296 | — | Use `/admin/outreach` Cowork Brief; JB live send only |
| MF-ADS-ADMIN Admin default ads surface (HQ + dashboard panel) | matchfit | **SHIPPED** — PR #297 | — | Use `/admin/ad-tracking`; dashboard Ad performance visible by default |
| F2 Prisma migration | matchfit | Merged | — | Smoke deploy if JB asks |
| J6 outreach DMs (10–15/day) | matchfit | — | JB | Live send only after Cowork brief |
| J5 Tue client tip IG post | matchfit | — | JB | Theme: 3 questions before you hire a trainer |
