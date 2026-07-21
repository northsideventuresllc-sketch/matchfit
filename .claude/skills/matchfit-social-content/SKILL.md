---
name: matchfit-social-content
description: >-
  Match Fit social media content planning and copywriting. Use when drafting posts,
  captions, reels/TikTok scripts, Threads copy, carousel outlines, hashtag sets,
  content calendars, campaign ideas, or scheduling against brand pillars.
---

# Match Fit social content

## Scope (JB locked 2026-07-21)

Actual post drafting/generation always happens **in the Match Fit admin portal's Content
Calendar generator** (Bulk/Impromptu at `/admin/content-calendar`), even with Workflow 1
automation live. When asked about Match Fit social outside that portal (e.g. in a vault/Claude
Code chat), give **theme + the "Optional prompt" textarea text only** — do not draft the actual
4 daily posts (Static/Carousel/Video/Text) here. If the user explicitly asks for full drafted
captions/scripts, that's a distinct ask — confirm before producing a full batch outside the
portal flow.

## Before you write anything

1. **Read the calendar** — `content/social/matchfit-content-calendar.jsx` (required). If missing, tell the user to run `npm run content:calendar:sync` from the parent hub or paste the file into that path, then stop until it exists.
2. **Official links** — Import `MATCH_FIT_OFFICIAL_SOCIAL_LINKS` from `@/lib/match-fit-official-social` (or read that file). Never invent or hardcode profile URLs.
3. **Live promos** — For founding-member / beta caps / trial offers, align with `/promos` and `HomeBetaPromoBanner` messaging; do not contradict slot counts. **Match Fit is NATIONWIDE — online / virtual coaches only.** Never write a city, metro or radius into Match Fit copy (Decision #342, Operating Rules v2 section 7).
4. **Brand voice** — Direct, athletic, confident; uppercase eyebrows sparingly; gradient accent colors `#FFD34E` → `#FF7E00` → `#E32B2B` on dark `#0B0C0F` / `#12151C` backgrounds when describing visual direction.

## Output format (default)

Deliver per platform when relevant:

| Field | Notes |
|-------|--------|
| **Platform** | Instagram, Threads, TikTok, Facebook |
| **Format** | Reel, carousel, static, story, thread |
| **Hook** | First line / first 3 seconds |
| **Body** | Full caption or script |
| **CTA** | One clear action (waitlist, sign-up path, /promos) |
| **Visual** | Shot list or on-screen text if video |
| **Hashtags** | Only if calendar or brand guide allows; keep short on Threads |

## Scheduling

Use dates, themes, and pillars **exactly** as defined in `matchfit-content-calendar.jsx`. If the user asks for "this week" without a date, infer from calendar structure or ask once.

## Do not

- Hardcode social URLs in app code (use `MatchFitSocialLinks` / `MATCH_FIT_OFFICIAL_SOCIAL_LINKS`).
- Promise features or pricing not in the app or promos page.
- Use stale copies under `~/.cursor/projects/empty-window/match-fit`.

## Parent hub (local only)

On the owner's Mac, the same file may exist at:

`/Users/jonnybooth/Desktop/Desktop/Northside Ventures/Northside Intellegence/Sector 1-Non-Autonomous Agents/Sector 1A (Non Autonomous)/Match Fit/matchfit-content-calendar.jsx`

Repo path `content/social/matchfit-content-calendar.jsx` is canonical for agents in this workspace.
