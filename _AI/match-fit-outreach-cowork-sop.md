# Match Fit Outreach Cowork SOP (app mirror)

Mirrored from the northside vault for dual-brain agents when vault MCP is unavailable.
Job code: **MF-OUT-COWORK**. Locked decisions: NI-Brain 2026-07-13.

## Ownership

- **Agent / Cowork:** generate leads, save to Outreach Hub, draft copy, set **intent**, update status after JB sends.
- **JB only:** live Instagram DM/comment and live email send.

## Intent (required before send)

Every Instagram and email lead must set `outreachIntent` before status can move to Outreach sent / follow-up:

| Value | Label |
|-------|--------|
| `LIST_WITH_US` | List With Us |
| `JOIN_AS_FP` | Join as Fitness Pro |
| `BOTH` | Both |

Unclear intent = do not send.

## Daily caps

- Instagram: **5**
- Email: **3**

## Instagram checklist

1. Open `profileUrl`
2. Send `dmText`
3. Follow
4. Like 4 recent posts
5. Comment `commentText` on `commentPostRef`
6. PATCH status → `OUTREACH_SENT`

## Email checklist

- From: `jb@match-fit.net`
- BCC: `support@match-fit.net` + `jb@northsideventuresgroup.com`
- Send subject/body, then PATCH status → `OUTREACH_SENT`

## App surface

- Admin UI: `/admin/outreach` → **Cowork Brief** → Load Morning Brief / Copy Runner Prompt
- API: `GET /api/admin/outreach/cowork-brief` (admin session)

## Product notes

- Generation retries until the requested lead count fills (up to 4 research passes) to reduce IG underfill.
- Hub bulk-save persists `savedToHubAt` before learning signals so email save-path drops do not drop the hub write.
