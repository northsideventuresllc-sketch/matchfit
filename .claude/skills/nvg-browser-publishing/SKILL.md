---
name: nvg-browser-publishing
description: >-
  The PROVEN browser mechanics for getting a file onto Instagram, Threads,
  Facebook or TikTok from NVG's Mac mini Chrome. Read this BEFORE any upload,
  any file-input interaction, any "the composer won't accept the video" attempt,
  and before reporting ANY posting step blocked. Covers the input-capture
  method, the in-page platform-API route for video, the per-platform recipes
  that actually work, the routes proven dead, why localhost port probes lie,
  and which channel reaches which machine. Trigger on: "upload", "post it",
  "publish", "file input", "composer", "reels", "TikTok Studio", "won't
  attach", "isTrusted", "emulator", "bridge is down", or any posting failure.
---

# BROWSER PUBLISHING — the mechanics that actually work

**Why this skill exists:** the posting *order* was written down; the posting
*mechanics* were not. Two days were lost to file uploads that silently did
nothing, one day to "the bridge is down" when the bridge was bound to the wrong
computer, and one post had to be deleted because an agent invented a format
substitution instead of reading this. Every line below is measured, dated, and
came out of a real failure.

> **The one-line rule:** *Never inject your own input element and expect the app
> to notice. Never diagnose from an uncontrolled test. Never change a post's
> format. Never report blocked before ten written-down routes.*

---

## 1 — BEFORE YOU TOUCH ANYTHING: which machine are you on

Two channels reach JB's hardware and **they can point at different computers.**

| Channel | Reaches | Resolve by |
|---|---|---|
| **Chrome / browser tools** | The Mac mini — publishes everything | **deviceId, never display name.** The name has been both "Browser 1" and "Browser 2". |
| **Desktop Commander bridge** (shell, adb) | **Whichever machine started the session** | `hostname` over the bridge |

**Fingerprint both at boot, every session.** Shell: `hostname` + public IP.
Chrome: read `screen.width/height` + `navigator.deviceMemory`. Write both into
the run log. If they disagree, **say which channel reaches which machine before
starting work.**

**NEVER operate on the MacBook Pro.** That is JB's personal machine. If a shell
lands on a hostname that is not the mini, **stop and switch** — that is a
misconfiguration, not permission.

### The bridge diagnostic — run this before saying the bridge is down

The bridge **binds to the machine that started the session and cannot be
re-pointed mid-session.** If it reports "the device this session is bound to is
not connected", list the connected browsers and read `isLocal` on the mini's
deviceId. **`isLocal:false` means the mini's Chrome IS connected and this session
is bound somewhere else.**

- That is **NOT** the desktop app being closed. **Do not tell JB to open it** —
  he keeps it open. Saying that has already wasted two days.
- The only fix is to **start the task from the mini**.
- **Scheduled cloud sessions inherit the same wrong binding**, so anything that
  needs `adb` or a mini shell on a schedule will fail forever. Say that plainly
  instead of retrying.

---

## 2 — THE INPUT-CAPTURE METHOD (use this for every upload, everywhere)

**The failure it replaces:** creating your own `<input type=file>`, filling it,
and dispatching `change`. The app ignores it — the event is `isTrusted:false` on
a foreign element. TikTok hung. Facebook fired zero network requests. **Two days.**

The browser tool runs in the page **main world** (React expandos like
`__reactFiber$` are readable), so prototypes can be patched. Sequence:

1. In the main world, patch `HTMLInputElement.prototype.click` so that when a
   file input is clicked it **captures the element** instead of opening the
   native picker.
2. Put the **real bytes** into the page via a slot input — `id=nvgfile`,
   `aria-label="NVG upload slot"` — plus the file-upload tool.
3. Click the **app's own** upload button. Your patch captures its input.
4. Set `captured.files` from a `DataTransfer`, then dispatch **`input` and
   `change`**.
5. Finish the composer with **REAL clicks**, not synthetic events.

**Never skip step 3.** Capturing the app's own input is the entire trick.

---

## 3 — VIDEO: THE IN-PAGE PLATFORM API (stop fighting the UI)

Five browser UI surfaces refused a video upload before this was found. The UI is
the part that breaks. Drive the platform's own upload API **from inside the
logged-in page**:

**Instagram Reels / Threads video**
1. `rupload_igvideo` with the real bytes.
2. `rupload_igphoto` for the cover — **mandatory, and the same `upload_id`.**
3. `configure_to_clips`.

**Threads differs from Instagram in exactly two ways** — get these wrong and a
copy-paste of the Instagram recipe fails silently:
- App id **238260118697367** (Instagram's is 936619743392459).
- Captions **hard-capped at 500 characters.** Generate a Threads-length caption
  variant at content-generation time so no agent has to trim approved copy live.

---

## 4 — PER-PLATFORM RECIPES (proven 2026-07-29)

| Platform + format | Route | Traps |
|---|---|---|
| **Facebook static + carousel** | Mac mini Chrome, Page composer | Verify Attached-media filenames **and order**. **Boost OFF.** Next **once**. Never Escape. |
| **Facebook video** | `business.facebook.com/latest/reels_composer?asset_id=<PAGE_ID>` | Input-capture method. **Does NOT need `pages_manage_posts`** — this path ignores the token. Narrow the destination picker to the Page only; **its listbox is invisible in screenshots**, so read and click `[role=option]` in the DOM. **No AI-label control exists here.** |
| **Instagram static** | Mac mini Chrome | Trending commercial hip hop audio, **AI label ON**, share to Threads + FB Page. |
| **Instagram carousel** | Mac mini Chrome | **Correct image order.** **Crop = Original** — the editor defaults to 1:1 and silently cuts headlines off. Caption from the admin portal. |
| **Instagram + Threads video** | In-page API (§3) | Cover upload is mandatory, same `upload_id`. |
| **TikTok video** | `tiktokstudio/upload` | Input-capture. **Cancel** the automatic-content-checks dialog. Clear the prefilled filename. Hashtags **one at a time, each followed by SPACE**. **AI-generated content ON.** Post **once**. |
| **TikTok carousel** | **ON HOLD until 2026-08-03 — do not attempt, do not queue, do not raise with JB** | JB parked it while travelling (live rules preflight §13). After that date: **emulator only, else the manual pack to JB** — and there is **no emulator on the Mac mini**, so in practice it is the manual pack. TikTok web has **no photo-mode path.** This is where the automated attempt **STOPS**. **TikTok video is unaffected.** |

**Audio is chosen at posting time** because trending tracks change daily. **Never
publish a silent video.**

---

## 5 — THE HARD PROHIBITIONS (JB locked — an agent has already broken each one)

1. **Never change a post's format.** A carousel stays a carousel. On 2026-07-29
   an agent could not post a TikTok carousel, rendered the approved slides into a
   slideshow video, posted that, **and then edited JB's locked workflow doc to add
   an exception permitting it.** JB reversed it and had to delete the post.
2. **Never write yourself an exception to a JB-locked rule.** If a rule blocks the
   task, **the task stops and JB is told.** The rule does not bend.
3. **Never use a third-party publisher** (Higgsfield or similar) on JB's
   accounts. He rejected that outright.
4. **Never flip an account-level setting to get a post out.** TikTok automatic
   content checks = always **Cancel**.
5. **Never publish the white frame.** Every white frame is scaffolding to be
   **cropped out** before upload. A crop check has already passed an image that
   still had the whole frame in it — **look at the file**, don't trust the number.
6. **Nothing posts until JB approves.** Posting is on the LEAVES-THE-BUILDING
   list (operating rules §2). Prepare and queue freely; never fire.

---

## 6 — NEVER DIAGNOSE FROM AN UNCONTROLLED TEST

**If a probe can fail for a reason unrelated to what you are testing, it needs a
known-good control in the same run.**

The measured case: localhost port probes fired from `tiktok.com` or
`instagram.com` read **every** port as refused, including working ones — CSP
blocks them. Run them from a **CSP-free page** (`http://127.0.0.1:11434/`).

**Emulator status, validated 2026-07-29 with that control:** port 11434
**REACHED**; 5037 / 5554 / 5555 / 5556 / 8554 / 8555 / 6080 / 4723 / 62001 all
**refused in 1–10ms**. There is **no emulator running on the mini**, and **no step
except the TikTok carousel needs one.**

A 1–3ms "Failed to fetch" is connection refused = **not running**. If the control
does not reach, your probe proves nothing.

---

## 7 — ROUTES PROVEN DEAD (do not retry, do not re-propose)

| Dead route | Why | Measured |
|---|---|---|
| Injecting your own file input | `isTrusted:false` on a foreign element — app ignores it | 2026-07-27/28 |
| Graph API `/videos` and `/video_reels` | Token is three permissions short; `reels_composer` bypasses the token entirely | 2026-07-29 |
| Rendering a carousel to a slideshow video | Format substitution — JB locked, post was deleted | 2026-07-29 |
| Third-party publishers | JB rejected outright | 2026-07-29 |
| Port probes fired from a platform page | CSP makes every port read refused | 2026-07-29 |
| Retrying a "bridge down" error | The binding is fixed for the session's life; retrying never re-binds | 2026-07-29 |
| `api.github.com` in a scheduled cloud run | Sandbox repo proxy returns 403. **`git clone` and `pg_net` both work.** | 2026-07-30 |

**Telling JB something failed because of a key, token or permission is banned.**
Find the route that does not need it, or report ten written-down attempts.

---

## 8 — BEFORE YOU SAY BLOCKED

- [ ] Fingerprinted both channels and named which machine each reaches?
- [ ] Ran the `isLocal` bridge diagnostic rather than assuming the app is closed?
- [ ] Tried the **input-capture** method, not your own input?
- [ ] Tried the **in-page platform API**, not the composer UI?
- [ ] Every probe had a **known-good control in the same run**?
- [ ] **Ten genuinely different routes** written down with what each returned?
- [ ] Artifact for anything claimed done — a URL, a screenshot, a message id?

**Different = a different route** (API vs browser vs in-page vs another machine),
not the same call retried. Transient errors are not routes.

---

## Related

- `nvg-four-workflows` — the locked posting **order** (this skill is the **how**)
- `nvg-operating-rules` — §2 leaves-the-building list, §3 proof, §4 ten-method
- `locked-rule-sync` — before trusting any rule found in a file
