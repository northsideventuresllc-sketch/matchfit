---
name: matchfit-social-content
description: >-
  Match Fit social media content planning and copywriting. Use when drafting posts,
  captions, reels/TikTok scripts, Threads copy, carousel outlines, hashtag sets,
  content calendars, campaign ideas, or scheduling against brand pillars.
---

# Match Fit social content

## Before you write anything

1. **Read the calendar** — `content/social/matchfit-content-calendar.jsx` (required). If missing, tell the user to run `npm run content:calendar:sync` from the parent hub or paste the file into that path, then stop until it exists.
2. **Official links** — Import `MATCH_FIT_OFFICIAL_SOCIAL_LINKS` from `@/lib/match-fit-official-social` (or read that file). Never invent or hardcode profile URLs.
3. **Live promos** — For founding-member / beta caps / trial offers, align with `/promos` and `HomeBetaPromoBanner` messaging; do not contradict slot counts. The admin portal periodically scans the live site — use that context when available.
4. **Brand voice** — Direct, athletic, confident; uppercase eyebrows sparingly; gradient accent colors `#FFD34E` → `#FF7E00` → `#E32B2B` on dark `#0B0C0F` / `#12151C` backgrounds when describing visual direction.

## Audiences (strict)

Only two target groups in the schedule and copy:

| Audience | Use for |
|----------|---------|
| **Fitness Pros** | Recruitment, Fit Hub, premium tools, session economics |
| **Clients** | Discovery, matching, pricing, outcomes |

Do **not** split marketing by Atlanta vs virtual or lead with geography. In-person sessions are Atlanta-only operationally — never a campaign hook.

## Universal language

- Always **Fitness Pros** (never "trainers", "personal trainers", or "coaches" as the primary label).
- **Match Fit**, **Fit Hub**, **Premium Hub** — title case in UI-facing copy.

## Content rules (strict)

| Rule | Value |
|------|--------|
| Hashtags | **Max 5** per post |
| Character budget | **500** chars total (caption + hashtags) — Threads repurpose limit |
| Promos | Match live `/promos` scan — do not invent caps or pricing |

## Output format (default)

Deliver per platform when relevant:

| Field | Notes |
|-------|--------|
| **Platform** | Instagram, Threads, TikTok, Facebook |
| **Format** | Reel, carousel, static, story, thread |
| **Hook** | First line / first 3 seconds |
| **Body** | Full caption or script |
| **CTA** | One clear action (waitlist, sign-up path, /promos) |
| **Visual / video prompt** | Required for video, carousel, static — editable in Content Hub |
| **Hashtags** | Max 5; keep short on Threads |

## Scheduling

Use dates, themes, and pillars **exactly** as defined in `matchfit-content-calendar.jsx`. Rotation alternates **Fitness Pros** and **Clients** across post types (Carousel, Static, Video, Text) M–F.

## Do not

- Hardcode social URLs in app code (use `MatchFitSocialLinks` / `MATCH_FIT_OFFICIAL_SOCIAL_LINKS`).
- Promise features or pricing not in the app or promos page.
- Market Atlanta or local geography outwardly.
- Use stale copies under `~/.cursor/projects/empty-window/match-fit`.

## Parent hub (local only)

On the owner's Mac, the same file may exist at:

`/Users/jonnybooth/Desktop/Desktop/Northside Ventures/Northside Intellegence/Sector 1-Non-Autonomous Agents/Sector 1A (Non Autonomous)/Match Fit/matchfit-content-calendar.jsx`

Repo path `content/social/matchfit-content-calendar.jsx` is canonical for agents in this workspace.
