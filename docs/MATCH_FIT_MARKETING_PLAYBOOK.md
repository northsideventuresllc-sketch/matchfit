# Match Fit marketing playbook (8 steps)

Weekly operator workflow for Match Fit beta marketing. Canonical step definitions live in `src/lib/match-fit-marketing-playbook.ts`.

| Step | Title | Where |
|------|-------|--------|
| 1 | Plan the week | Ad Tracking HQ — budget + campaign registry fields |
| 2 | Generate content | `/admin/content-calendar` |
| 3 | Publish organic | JB lane — post from Content Hub |
| 4 | Outreach DMs | `/admin/outreach` (10–15/day target) |
| 5 | Confirm tags | Ad Tracking HQ — Connected Pixels |
| 6 | Build tracking links | Ad Tracking HQ — Campaign Link Builder |
| 7 | Launch paid campaign | JB lane — Meta / Google / TikTok ad platforms |
| 8 | Register campaign and review | Ad Tracking HQ — Campaign Registry + Performance sync |

## Paid vs organic

Steps **1–4** are organic and planning. Steps **5–8** are paid acquisition and measurement.

Ad Tracking HQ surfaces steps **1** (plan), **5–6** (setup), and **8** (registry + review). Step **7** runs in the ad platform UI after conversion goals match the event catalog.

## JB lane only

- Step 3 — social posts (see `content/social/matchfit-content-calendar.jsx`)
- Step 7 — create and publish ads in Meta Ads Manager, Google Ads, or TikTok Promote

## Related dispatch items

| Queue ID | Playbook step |
|----------|----------------|
| J5 | Step 3 (organic post) |
| J6 | Step 4 (outreach DMs) |
| AT1 / AT2 | Steps 5–8 (Ad Tracking HQ) |
