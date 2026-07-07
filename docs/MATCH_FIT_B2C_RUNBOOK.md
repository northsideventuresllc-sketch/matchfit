# Match Fit B2C runbook (client acquisition)

Operator runbook for **client** (B2C) growth. Canonical phase definitions for **5b–6b** live in `src/lib/match-fit-b2c-runbook.ts`.

Cross-reference: [Marketing playbook (8 steps)](./MATCH_FIT_MARKETING_PLAYBOOK.md)

## Product funnel

| Stage | Route |
|-------|--------|
| Waitlist (cap full) | `/waitlist/client` |
| Sign-up | `/client/sign-up` |
| VIP trial / subscribe | `/client/subscribe` |
| Match preferences | `/client/dashboard/preferences` |

Admin: `/admin/beta-waitlists`, `/promos`, `/admin/ad-tracking`

## Phases 5b–6b (paid measurement — client)

These run in **Ad Tracking HQ** immediately before playbook step 7 (launch paid in Meta / Google / TikTok).

| Phase | Playbook step | Action |
|-------|---------------|--------|
| **5b** | 5 — Confirm tags | Verify pixels + **client signup** conversion (Google + Meta Subscribe) |
| **6b** | 6 — Build links | UTM URLs to `/client/sign-up` (or waitlist); preset `client_beta_launch` |

### 5b checklist

1. Meta pixel ID matches Events Manager
2. Google tag ID matches Google Ads
3. Client signup conversion shows **Connected**
4. Meta CAPI + GA4 recommended (server-side backup)

### 6b checklist

1. Landing = Client sign-up (or waitlist if cap full)
2. Use **Meta — client beta** preset or `utm_campaign=client_beta_launch`
3. Copy final URL before pasting into ad creative
4. Never run paid traffic to untagged homepage

## After 6b

- **Playbook 7** — Launch client campaign in ad platform (JB lane)
- **Playbook 8** — Register campaign ID + sync performance in Ad Tracking HQ

## Related queue items

| ID | Phase |
|----|--------|
| AT1 / AT2 | 5b–8 tooling |
| M1 | Playbook numbering |
| J5 | Organic (playbook 3) |
