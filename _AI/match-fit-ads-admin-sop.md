# Match Fit ads — admin default surface (MF-ADS-ADMIN)

Mirrored for dual-brain agents when vault MCP is unavailable.
Job code: **MF-ADS-ADMIN**.

## Decision

**Admin Ad Tracking HQ** (`/admin/ad-tracking`) is the **default Match Fit paid-ads operator surface**.

| Surface | Role |
|---------|------|
| `/admin/ad-tracking` | Canonical HQ — pixels, UTMs, campaign registry, Insights sync, playbook 1/5–8 |
| Admin dashboard **Ad performance** section | Visible by default; summary + deep link into HQ |
| AXON `/tools/ad-tracker` | Cross-venture digest only — not the Match Fit default |
| Meta / Google / TikTok UI | JB lane for launch (playbook step 7) |

## Operator path

1. Open **Ad Tracking HQ** from admin nav (second item after Dashboard).
2. Confirm Connected Pixels / conversion labels.
3. Build UTM links → launch in ad platforms (JB).
4. Register campaign IDs → Sync now for spend.
5. Review the dashboard **Ad performance** panel for a 7-day rollup.

## Code anchors

- `src/lib/match-fit-ads-surface.ts` — `MATCH_FIT_DEFAULT_ADS_SURFACE_PATH`
- `src/app/admin/ad-tracking/` — HQ UI
- `src/lib/admin-dashboard-layout.ts` — `ad-performance` visible in default layout (v4)
