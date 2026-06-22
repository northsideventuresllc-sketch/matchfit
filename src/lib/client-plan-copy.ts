export const CLIENT_FREEMIUM_SWIPE_LIMIT = 10;
export const CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS = 12;
export const CLIENT_VIP_PRICE_USD = 10;

export const CLIENT_FREE_PLAN_LABEL = "Free";
export const CLIENT_VIP_PLAN_LABEL = "VIP";

import { CLIENT_PLATFORM_TRIAL_DAYS } from "@/lib/client-platform-trial-constants";

export const CLIENT_BETA_VIP_TRIAL_DAYS = CLIENT_PLATFORM_TRIAL_DAYS;

export function clientVipPriceLabel(): string {
  return `$${CLIENT_VIP_PRICE_USD.toFixed(2)}`;
}

export function clientBetaVipTrialSummary(): string {
  return `${CLIENT_BETA_VIP_TRIAL_DAYS}-day VIP access with no card required at sign-up`;
}

export const CLIENT_FREE_PLAN_FEATURES = [
  `Up to ${CLIENT_FREEMIUM_SWIPE_LIMIT} coach passes every ${CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS} hours`,
  "Swipe-mode discovery only (no scroll feed)",
  "View FitHub posts (likes, comments, and reposts require VIP)",
  "No in-app chat or session booking until you upgrade",
  "Match questionnaire updates require VIP",
] as const;

export const CLIENT_VIP_PLAN_FEATURES = [
  "Unlimited coach discovery — swipe and scroll feeds",
  "In-app chat with Fitness Pros",
  "Book and confirm sessions on-platform",
  "Full FitHub interactions (like, comment, repost, share)",
  "Update your match questionnaire anytime",
] as const;

export const FREEMIUM_GATE_MESSAGES: Record<string, { title: string; body: string }> = {
  FREEMIUM_NO_SCROLL: {
    title: "Scroll feed is a VIP feature",
    body: "Upgrade to VIP to browse the full scroll feed and revisit coaches you passed on.",
  },
  FREEMIUM_NO_CHAT: {
    title: "Chat requires VIP",
    body: "Upgrade to VIP to message Fitness Pros in Match Fit chat.",
  },
  FREEMIUM_NO_BOOKING: {
    title: "Booking requires VIP",
    body: "Upgrade to VIP to confirm sessions and manage bookings on-platform.",
  },
  FREEMIUM_NO_FITHUB_INTERACT: {
    title: "FitHub interactions require VIP",
    body: "Upgrade to VIP to like, comment, repost, and share FitHub posts.",
  },
  FREEMIUM_NO_QUESTIONNAIRE: {
    title: "Match questionnaire updates require VIP",
    body: "Upgrade to VIP to update your match preferences and discovery signals.",
  },
  FREEMIUM_SWIPE_LIMIT: {
    title: "Swipe limit reached",
    body: `Free plan includes ${CLIENT_FREEMIUM_SWIPE_LIMIT} coach passes every ${CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS} hours. Upgrade to VIP for unlimited discovery.`,
  },
};

export function freemiumGateMessage(code: string): { title: string; body: string } {
  return (
    FREEMIUM_GATE_MESSAGES[code] ?? {
      title: "Upgrade to VIP",
      body: `Unlock full Match Fit access with VIP for ${clientVipPriceLabel()} per month.`,
    }
  );
}
