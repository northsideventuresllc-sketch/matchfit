import type { OutreachPlatform, OutreachTargetGroup } from "@/lib/outreach-types";

export const OUTREACH_BRAND_FACTS = [
  "Match Fit (match-fit.net) is a US fitness marketplace for trainers and clients.",
  "Clients: $10/mo, 14-day free trial, no card upfront.",
  "Trainers: beta founding pricing, athletes find and book you.",
  "Founder voice: Jonny / JB — direct, real, confident, not salesy.",
  "Beta roster is selective; early trainers get visibility before public launch.",
  "Focus on US-based fitness professionals and clients nationwide.",
].join("\n");

export function genericInviteTail(platform: OutreachPlatform, group: OutreachTargetGroup): string {
  if (platform === "instagram") {
    return group === "ATL_LOCAL"
      ? "We're launching Match Fit in Atlanta — a platform where serious trainers get found by athletes ready to book. In beta and hand-selecting ATL trainers. Worth a quick convo? — JB @ Match Fit"
      : "We're building Match Fit — a marketplace connecting virtual trainers with athletes actively looking to book. You list, they find you. Beta roster is selective. Interested in an early spot? — JB @ Match Fit";
  }
  if (platform === "facebook") {
    return "Founding perks: first-mover visibility, beta pricing, direct client leads. Apply → match-fit.net | DM with questions. — Jonny, Founder @ Match Fit";
  }
  if (platform === "email") {
    return group === "ATL_LOCAL"
      ? "Clients come to you. Takes 5 min to apply: match-fit.net\n\n— Jonny, Founder @ Match Fit"
      : "Virtual clients discover you through Match Fit — no cold outreach on your end. Apply: match-fit.net\n\n— Jonny, Founder @ Match Fit";
  }
  return "Learn more at match-fit.net — Jonny @ Match Fit";
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
    ? "ATL trainers wanted — founding spot on Match Fit"
    : "Virtual coaches — early roster on Match Fit";
}

export function followUpEmailSubject(): string {
  return "Re: Match Fit — still a few spots left";
}

export function followUpEmailBody(name: string): string {
  const first = name.split(" ")[0] || "there";
  return `Subject: ${followUpEmailSubject()}\n\nHey ${first},\n\nFollowing up on Match Fit. Spots capped at 30 for beta — wanted to make sure you saw this before they fill.\n\nHappy to answer questions.\n\n— Jonny`;
}
