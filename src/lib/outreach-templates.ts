import type { OutreachPlatform, OutreachTargetGroup } from "@/lib/outreach-types";
import { MATCH_FIT_COACH_SIGNUP_URL } from "@/lib/content-calendar/content-rules";

/** Locked outreach / social craft facts — same meaning every time; AI must vary wording. */
export const OUTREACH_CRAFT_LOCK_RULES = `Outreach craft lock (strict — JB 2026-07-20):
- Say Fitness Pros / Fitness Pro in outbound copy — never "Coaches" / "coach" as the public label.
- Canonical Fitness Pro CTA: ${MATCH_FIT_COACH_SIGNUP_URL} (never invent paths; never use /trainer/signup in outbound).
- Founding promo meaning (vary wording every message — do not regurgitate the same sentence):
  1) First 30 Fitness Pros get 60 days of Premium access free — all tools / maximize opportunity.
  2) First 10 Fitness Pros get onboarding fees waived completely.
- Tone: direct founder voice (JB) — real, confident, not salesy brochure paste.`;

export const OUTREACH_BRAND_FACTS = [
  "Match Fit (match-fit.net) is a US fitness marketplace connecting Fitness Pros with clients.",
  "Clients: $10/mo, 60-day free trial, no card upfront.",
  "Fitness Pros join at match-fit.net/trainer/sign-up.",
  "Founding promo (exact meaning; vary wording): first 30 Fitness Pros get 60 days Premium access free; first 10 Fitness Pros get onboarding fees waived completely.",
  "Founder voice: Jonny / JB — direct, real, confident, not salesy.",
  "Beta roster is selective; early Fitness Pros get visibility before public launch.",
  "Focus on US-based Fitness Pros and clients nationwide.",
  OUTREACH_CRAFT_LOCK_RULES,
].join("\n");

export function genericInviteTail(platform: OutreachPlatform, group: OutreachTargetGroup): string {
  // `group` is kept on the signature for call-site compatibility, but no longer branches copy:
  // recruiting is nationwide, so every group gets the same geo-free message (Decision #342).
  void group;
  if (platform === "instagram") {
    return `We're building Match Fit — Fitness Pros list, athletes find and book you. Founding window: first 30 Fitness Pros get 60 days Premium free; first 10 get onboarding fees waived. Early spot: ${MATCH_FIT_COACH_SIGNUP_URL} — JB @ Match Fit`;
  }
  if (platform === "facebook") {
    return `Founding window for Fitness Pros: 60 days Premium free (first 30) · onboarding fees waived (first 10). Apply → ${MATCH_FIT_COACH_SIGNUP_URL} | DM with questions. — Jonny, Founder @ Match Fit`;
  }
  if (platform === "email") {
    return `Virtual clients discover you through Match Fit — no cold outreach on your end. Founding Fitness Pro window still open. Apply: ${MATCH_FIT_COACH_SIGNUP_URL}\n\n— Jonny, Founder @ Match Fit`;
  }
  return `Learn more / apply: ${MATCH_FIT_COACH_SIGNUP_URL} — Jonny @ Match Fit`;
}

export function instagramPersonalizedOpener(group: OutreachTargetGroup, name: string, hook: string): string {
  void group;
  const greeting = name ? `Hey ${name} 👋` : "Hey 👋";
  // If the hook is already a full sentence (ends with period, !, or ?) use it directly as the opener body.
  const hookIsSentence = /[.!?]$/.test(hook.trim());
  if (hookIsSentence) {
    return `${greeting}\n\n${hook}\n\n`;
  }
  return `${greeting}\n\nYour online coaching content stands out — especially ${hook}. You clearly know how to get real results remotely.\n\n`;
}

export function emailSubject(group: OutreachTargetGroup): string {
  void group;
  return "Virtual Fitness Pros — early roster on Match Fit";
}

export function followUpEmailSubject(): string {
  return "Re: Match Fit — still a few spots left";
}

export function followUpEmailBody(name: string): string {
  const first = name.split(" ")[0] || "there";
  return `Subject: ${followUpEmailSubject()}\n\nHey ${first},\n\nFollowing up on Match Fit. First 30 Fitness Pros still get 60 days Premium free, and the first 10 get onboarding fees waived — wanted to make sure you saw it before those fill.\n\nHappy to answer questions: ${MATCH_FIT_COACH_SIGNUP_URL}\n\n— Jonny`;
}
