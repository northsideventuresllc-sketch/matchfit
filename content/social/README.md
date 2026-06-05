# Match Fit social content calendar

Canonical source for AI-assisted social posts and campaign planning.

## File

| Path | Purpose |
|------|---------|
| `matchfit-content-calendar.jsx` | Pillars, schedule, hooks, and platform notes (read by agents before drafting) |

## Sync from parent hub (local Mac)

If the calendar lives in the Match Fit parent hub (sibling to `match-fit-app`):

```bash
npm run content:calendar:sync
```

Or copy manually from:

`/Users/jonnybooth/Desktop/Desktop/Northside Ventures/Northside Intellegence/Sector 1-Non-Autonomous Agents/Sector 1A (Non Autonomous)/Match Fit/matchfit-content-calendar.jsx`

into this directory as `matchfit-content-calendar.jsx`, then commit.

## Agent usage

Cursor loads `.cursor/skills/matchfit-social-content/SKILL.md` when you ask for social copy, captions, reels scripts, or content calendars. Agents must read `matchfit-content-calendar.jsx` first and use `MATCH_FIT_OFFICIAL_SOCIAL_LINKS` from `@/lib/match-fit-official-social` for URLs (never hardcode handles).

## Until the file is committed

Cloud agents cannot read your Mac-only path. After the first sync + commit, every agent session in this repo can use the calendar directly.
