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
  if (platform === "instagram") {
    return group === "ATL_LOCAL"
      ? `We're launching Match Fit in Atlanta — Fitness Pros get found by athletes ready to book. First 30 Fitness Pros get 60 days Premium free; first 10 get onboarding fees waived. Early ATL spots: ${MATCH_FIT_COACH_SIGNUP_URL} — JB @ Match Fit`
      : `We're building Match Fit — Fitness Pros list, athletes find and book you. Founding window: first 30 Fitness Pros get 60 days Premium free; first 10 get onboarding fees waived. Early spot: ${MATCH_FIT_COACH_SIGNUP_URL} — JB @ Match Fit`;
  }
  if (platform === "facebook") {
    return `Founding window for Fitness Pros: 60 days Premium free (first 30) · onboarding fees waived (first 10). Apply → ${MATCH_FIT_COACH_SIGNUP_URL} | DM with questions. — Jonny, Founder @ Match Fit`;
  }
  if (platform === "email") {
    return group === "ATL_LOCAL"
      ? `Clients come to you. Founding Fitness Pro perks while spots last. Apply (~5 min): ${MATCH_FIT_COACH_SIGNUP_URL}\n\n— Jonny, Founder @ Match Fit`
      : `Virtual clients discover you through Match Fit — no cold outreach on your end. Founding Fitness Pro window still open. Apply: ${MATCH_FIT_COACH_SIGNUP_URL}\n\n— Jonny, Founder @ Match Fit`;
  }
  return `Learn more / apply: ${MATCH_FIT_COACH_SIGNUP_URL} — Jonny @ Match Fit`;
}

export function instagramPersonalizedOpener(group: OutreachTargetGroup, name: string, hook: string): string {
  const greeting = name ? `Hey ${name} 👋` : "Hey 👋";
  // If the hook is already a full sentence (ends with period, !, or ?) use it directly as the opener body.
  const hookIsSentence = /[.!?]$/.test(hook.trim());
  if (group === "ATL_LOCAL") {
    if (hookIsSentence) {
      return `${greeting}\n\n${hook}\n\n`;
    }
    return `${greeting}\n\nCame across your page — ${hook}. Your training content and how you push your athletes is exactly what we're building around.\n\n`;
  }
  if (hookIsSentence) {
    return `${greeting}\n\n${hook}\n\n`;
  }
  return `${greeting}\n\nYour online coaching content stands out — especially ${hook}. You clearly know how to get real results remotely.\n\n`;
}

export function emailSubject(group: OutreachTargetGroup): string {
  return group === "ATL_LOCAL"
    ? "ATL Fitness Pros — founding spot on Match Fit"
    : "Virtual Fitness Pros — early roster on Match Fit";
}

export function followUpEmailSubject(): string {
  return "Re: Match Fit — still a few spots left";
}

export function followUpEmailBody(name: string): string {
  const first = name.split(" ")[0] || "there";
  return `Subject: ${followUpEmailSubject()}\n\nHey ${first},\n\nFollowing up on Match Fit. First 30 Fitness Pros still get 60 days Premium free, and the first 10 get onboarding fees waived — wanted to make sure you saw it before those fill.\n\nHappy to answer questions: ${MATCH_FIT_COACH_SIGNUP_URL}\n\n— Jonny`;
}
