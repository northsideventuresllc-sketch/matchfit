---
name: matchfit-marketing-workflow
description: >-
  JB's LOCKED 19-step Match Fit marketing workflow — daily 8am generation, his
  approval, browser-based Google Gemini/Flow media generation, white-frame
  cropping, upload to the publishing page, then the exact posting order across
  Facebook, Threads, Instagram and TikTok — all in Mac mini Chrome. Use whenever
  Match Fit social content is being generated, produced, uploaded, approved or
  posted. NEVER ask JB to re-explain any of this.
---

# Match Fit Marketing Workflow — 19 Steps (JB LOCKED)

> **NEVER ASK JB FOR THIS AGAIN.** He dictated it once, furious, because no agent had saved it.
> Image generation is **browser-driven Google Gemini / Google Flow** on JB's own accounts — **not an API.**
> The **GEMINI FLOW** button in the Match Fit admin Content Calendar opens it.
> Every **white frame is scaffolding to be CROPPED OUT** before upload. Never publish the frame.

## Generation + approval

1. Posts generate at **8am**. Make sure the prompts for **carousel, static, and video** all have the **white frame** in there.
2. **JB edits and approves** for drafting.

## Media production (the Mac mini's browser agent does this, unattended — corrected 2026-09-03, Decision #1722 item 4)

> **No Claude Cowork AI session is involved in media generation at all.** JB direct order,
> live 2026-09-03: "media generation is NEVER the Gemini API — it is my Gemini subscription in
> Chrome on the Mac mini." Steps 3–9 below used to say "open Cowork and paste the prompt" — that
> line described a person/agent doing it by hand in a chat session, which is not what actually
> runs. What actually runs is `scripts/gemini-media-automation.mjs` on the Mac mini: a script
> that drives Chrome directly over CDP against JB's own logged-in Gemini web session, queued via
> `queueMiniChromeAgentJob()` (`@/lib/content-calendar/cowork-jobs.ts`). It is fired automatically
> by Content Calendar v2's Approve Day / "FIRE COWORK" / "SUBMIT FOR GENERATION" / "Send To Agent"
> buttons, or by hand with `node gemini-media-automation.mjs --ids=<uuid>,...`. There is still no
> image or video generation API anywhere in this loop — free or paid.

3. **VIDEO** prompt is generated in **Google Gemini** by the mini's browser agent, in a fresh
   conversation per post.
4. The agent **crops the white frame out** itself (`sharp` `.trim()` on the copied image).
5. The agent uploads the cropped asset straight to Supabase Storage and writes it onto the post
   row — no manual download/upload step.
6. **STATIC** and **CAROUSEL** prompts are generated the same way, each post type in its own
   fresh Gemini conversation so one post's context never bleeds into the next.
7. Generate (same agent, same session, no separate "generate" step for a human to trigger).
8. Crop the white frames out (same automatic step as #4, per asset).
9. The agent writes the finished media straight onto the post row and marks the matching job
   complete — no manual download/upload to the publishing page.
10. Make sure each post is ready for each site and **PING JB** when ready to look over pre-publish.
11. **JB approves to post.**

## Posting sequence

> **CORRECTED 2026-09-05 (JB live, NI-Brain Decision #1770 — supersedes Decision #486 and every "emulator is dead / do not reinstate" line in this file).** The Android emulator on the Mac mini is **back and logged in** (JB, 2026-09-05). Rule now: **probe the emulator at boot** from a CSP-free control (adb / emulator ports) and log the result every run. Running → Instagram (and the TikTok carousel photo-mode) go through the emulator per the live WF1 nodes. Not running → Mac mini Chrome per `nvg-browser-publishing`, and the miss is reported to PULSE as a bug, never as "dead". The wrong-workflow drift JB keeps seeing comes from agents trusting whichever of these files they read last — the probe result is the only truth.

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
18. **TikTok — CAROUSEL: MANUAL PACK TO JB. That is the only route.**
    **DEAD ROUTE, DO NOT REINSTATE — the Android emulator.** This step previously
    read "emulator only, or the manual pack" while `nvg-four-workflows` in this same
    repo said the opposite. The emulator route is **dead, not merely unchecked**:
    Decision #486 (2026-07-31) — `adb` not found, every emulator port refused under a
    known-good control, `nvg_mini_heartbeat` empty. TikTok web has **no photo-mode
    path** for @theofficialmatchfit (Decision #482) and that is where the automated
    attempt **STOPS**. JB's travel hold on this step ran to **2026-08-03** and closes
    on its own terms.
    **NEVER render the slides to a slideshow video and NEVER substitute the
    format** — a carousel stays a carousel (**JB locked**; he had to delete a
    slideshow posted in error on 2026-07-29).
19. **PING JB after each post TYPE**, and again **when all posts are done**, so he
    can check and edit.

> **Never flip an account-level setting to get a post out**, and **never use a
> third-party publisher** (Higgsfield or similar) on JB's accounts — he rejected
> that outright.

## Standing details that live inside this workflow

- Never change a post's format. A carousel stays a carousel.
- Instagram crop must be set to **Original** — the editor defaults to 1:1 and cuts headlines off.
- Audio is chosen **at posting time** because trending tracks change daily. Never publish a silent video.
- **OUTREACH ONLY: never send outreach to a fake or fabricated person / lead.** This does **NOT** apply to content creation — a generated marketing graphic may show an illustrative persona with a name (e.g. a Fitness Pro card reading "Sarah Jenkins, Fitness Pro" is **correct, approved content**). Two agents have blocked good assets over the old blanket wording — see NI-Brain Decision #384.
