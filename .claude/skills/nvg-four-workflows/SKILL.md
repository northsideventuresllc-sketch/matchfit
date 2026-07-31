---
name: nvg-four-workflows
description: >-
  JB's four LOCKED daily workflows — Match Fit Marketing, Match Fit Outreach,
  NI Marketing, NI Outreach. Read this BEFORE touching any content generation,
  media production, publishing, outreach, DMs, or posting for any NVG venture.
  Covers the 8am generation, JB's approval gates, browser-based Google Gemini
  media generation, white-frame cropping, the publishing page upload, the exact
  posting order across Facebook, Threads, Instagram and TikTok (all in Mac mini
  Chrome), LinkedIn and Reddit, the per-lead outreach sequence, and the 2-hourly
  reply scan. NEVER ask JB to re-explain any of it.
---

# THE FOUR WORKFLOWS — JB LOCKED

> **These four run every day. NEVER ask JB to re-explain any of them.**
> He had to dictate all four from memory because no agent had saved them. That must never happen again.
>
> **Never mix the four.** Match Fit content lives ONLY in the Match Fit Admin Portal Content Calendar.
> Match Fit outreach lives ONLY in Match Fit Outreach HQ. NI content lives ONLY in the NI Content
> Machine. NI outreach lives ONLY in NI Outreach HQ. The AXON tool is a live read-only mirror of a
> venture's admin portal tools, with links back into the portal to make changes.
>
> **Media is generated in GOOGLE GEMINI through the browser on JB's own account — never via an API.**
> **Every white frame is scaffolding to be CROPPED OUT before upload. Never publish the frame.**
> **Approve-only: nothing sends, posts or publishes until JB presses approve. Weekdays only.**

---

## 1 — MATCH FIT MARKETING

1. Posts generate at **8am**. The **carousel, static and video prompts must all contain the white frame**.
2. JB edits and approves for drafting.
3. Open Cowork, paste the **VIDEO** prompt, generate in **Google Gemini**.
4. **Crop the white frame out.**
5. Download it and **upload to the publishing page**.
6. **Simultaneously** paste the **STATIC** prompt and the **CAROUSEL** prompt into **two different tabs**.
7. Generate.
8. **Crop the white frames out.**
9. Download and upload to the publishing page.
10. Make sure each post is ready for each site, then **PING JB** for pre-publish review.
11. **JB approves to post.**

> **CORRECTED 2026-07-30 by the daily skill check.** Steps 12–18 below previously
> ordered **"Instagram via ANDROID EMULATOR"** and **"Threads on Safari"**.
> **DEAD ROUTE, DO NOT REINSTATE.** Measured on the Mac mini 2026-07-29 from a
> CSP-free control page: **there is no Android emulator running on that machine**
> and **no step except the TikTok carousel needs one.** The logged-in Mac mini
> Chrome publishes **everything** — Instagram, Threads, Facebook and TikTok, video
> and carousel. An agent following the old wording reports Instagram as blocked
> forever. Live source of truth: workflow WF1 in NI-Brain (**19 steps**, not 18).
> **Browser mechanics live in the `nvg-browser-publishing` skill — read it before
> touching any upload.**

12. **Facebook Page — STATIC + CAROUSEL** in Mac mini Chrome, then **Threads**.
    Verify the Attached-media filenames and order, **Boost OFF**, press **Next
    once**, never Escape.
13. **Instagram — STATIC** in **Mac mini Chrome**: trending **commercial hip hop**
    audio, **AI label ON**, share to **Threads + Facebook Page**, then post.
14. **Instagram — CAROUSEL** in **Mac mini Chrome**: **images in the correct
    order**, trending commercial hip hop audio, **AI label ON**, share to Threads +
    Facebook, **caption copied from the admin portal**, **crop = Original**.
15. **Instagram + Threads — VIDEO** via the **in-page platform API** (not the UI):
    `rupload_igvideo`, then the `rupload_igphoto` cover (**mandatory, same
    upload_id**), then `configure_to_clips`. Threads app id **238260118697367**,
    caption hard-capped at **500 characters**.
16. **Facebook — VIDEO** via `business.facebook.com/latest/reels_composer` with the
    Match Fit Page asset id. Use the **input-capture method**. Narrow the
    destination picker to the Page only — its listbox is invisible in screenshots,
    so read and click `[role=option]` in the DOM. **No AI-label control exists on
    this surface.** Next once.
17. **TikTok — VIDEO** via `tiktokstudio/upload`. Input-capture method, **Cancel**
    the automatic-content-checks dialog, clear the prefilled filename, add hashtags
    **one at a time each followed by SPACE**, **AI-generated content ON**, Post
    once. *"Content under review / Only me"* for a few minutes is **normal**, not a
    failure — it flips to Everyone by itself.
18. **TikTok — CAROUSEL: ON HOLD UNTIL MONDAY 2026-08-03. Do not attempt it by any
    route, do not queue it, and do not raise it with JB** — he parked it while
    travelling (live rules preflight §13, added 2026-07-31 by the daily skill check).
    **TikTok VIDEO is unaffected.** After 2026-08-03 the route is **emulator only, or
    the manual pack to JB** — and note there is **no emulator running on the Mac mini**
    (measured 2026-07-29), so in practice it is the manual pack. TikTok web has
    **no photo-mode path** and that is where the automated attempt **STOPS**.
    **NEVER render the slides to a slideshow video and NEVER substitute the
    format** — a carousel stays a carousel (**JB locked**; he had to delete a
    slideshow posted in error on 2026-07-29). If nothing is listening on the
    emulator ports, say exactly that and ship the manual pack.
19. **PING JB after each post TYPE**, and again **when all posts are done**, so he
    can check and edit.

> **Never flip an account-level setting to get a post out**, and **never use a
> third-party publisher** (Higgsfield or similar) on JB's accounts — he rejected
> that outright.

---

## 2 — MATCH FIT OUTREACH

1. Generate **5 Instagram leads and 5 email leads**.
2. JB goes through and **edits each piece of text**.
3. **JB approves.**
4. **Emails send immediately from `jb@match-fit.net`** — respect the **two-account Resend system** (see the Resend note below).
5. Run the **Match Fit Instagram outreach method**, per lead:
   1. Open **Instagram in one tab** and the **admin portal Outreach HQ in another**.
   2. Copy the DM and paste it — **CONFIRM IT IS THE CORRECT PERSON BEFORE YOU SEND.**
   3. Send the DM.
   4. Go to their page.
   5. **Follow.**
   6. **Like the 3 most RECENT posts** — read the dates and compare them to today's date. Do not assume ordering.
   7. Copy the comment and paste it on the **correct post** — **do not guess, confirm which post you are commenting on.**
   8. Repeat for **all 5 leads**.
6. **PING JB when all 10 outreaches are sent.**
7. **Cowork scan runs every 2 hours** for DMs and emails. On an email: **ping JB on Telegram with the generated response.** He approves or gives an edit. **If he edits, send the edit exactly as formatted. If he approves, send it back.**

---

## 3 — NI MARKETING

1. Post generates at **8am**. **Stick to the NI content schedule.** If it is a **static image**, the prompt **must contain the white frame**.
2. JB edits and approves for drafting.
3. If a static image is attached to the post, **Cowork fires** — paste the **static prompt** and generate in **Google Gemini**.
4. **Crop the white frame out.**
5. Download it and **upload to the publishing page on the NI Content Machine**.
6. **JB approves to post.**
7. Post via **Chrome extension and/or Desktop Commander** to **LinkedIn, Reddit or Instagram** — same techniques as the Match Fit marketing workflow.
8. **PING JB after the post is up.**

---

## 4 — NI OUTREACH

**Identical to Match Fit Outreach (workflow 2), with two differences:**

- **DMs go through LinkedIn**, not Instagram.
- **Emails send from `jb@northsideintelligence.com`** — the **Resend two-account protocol must be wired and must not fail.**

Everything else is the same: 5 + 5 generated, JB edits every line, JB approves, emails immediately, the per-lead sequence with confirm-before-send, follow, like the 3 most recent posts by date, comment on a confirmed post, ping at 10 sent, and the 2-hourly reply scan with Telegram approval.

---

## RESEND TWO-ACCOUNT PROTOCOL (this breaks silently — check it)

- `northsideintelligence.com` is verified on the **NI account** → use `RESEND_API_KEY_NI`.
- `match-fit.net` is on the **other account** → use `RESEND_API_KEY`.
- **Sending NI mail with the Match Fit key fails silently.** Never conclude a domain is unverified before checking **both** accounts.

## OTHER STANDING DETAILS THAT LIVE INSIDE THESE WORKFLOWS

- **Never change a post's format.** A carousel stays a carousel.
- **Instagram crop must be set to Original** — the editor defaults to 1:1 and silently cuts headlines off.
- **Audio is chosen at posting time** because trending tracks change daily. Never publish a silent video.
- **OUTREACH ONLY: never send outreach to a fake or fabricated person / lead.** This does **NOT** apply to content creation — a generated marketing graphic may show an illustrative persona with a name (e.g. a Fitness Pro card reading "Sarah Jenkins, Fitness Pro" is **correct, approved content**). Two agents have blocked good assets over the old blanket wording — see NI-Brain Decision #384.
- **Hashtags must be high-follower existing tags**, chosen from real volume data. Never invent brand tags. At most one brand tag, only alongside four or more big ones. Every tag stored with the `#` prefix.
- **Match Fit targets online / virtual coaches NATIONWIDE.** No city, no polygon, no lat/long — not in search, not in copy, not in a comment.
- **LOCATION TAG on a post is per venture, never global** (Decisions #465 + #483, added here 2026-07-31 by the daily skill check). **NSSS / North-Stars = Atlanta, Georgia. Match Fit and NI carry NO city location tag** — a blank location field on those posts is correct, not an omission. Any file still ordering "LOCATION = Atlanta on every post" is stale and superseded.
- **No raw database values, status codes or jargon on any screen JB reads.**
