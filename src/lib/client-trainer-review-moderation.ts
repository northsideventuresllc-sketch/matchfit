import { scanChatTextForLeakageSignals } from "@/lib/chat-leakage-detection";

const MAX_TESTIMONIAL_LEN = 1_200;

/** Plain-language phrases that are never appropriate in public testimonials. */
const ZERO_TOLERANCE_PHRASES: readonly string[] = [
  "kill yourself",
  "end your life",
  "kill urself",
  "neck yourself",
  "hope you die",
  "go die",
  "terrorist attack",
  "school shooting",
  "child porn",
  "rape you",
  "rape her",
  "rape him",
];

function normalizeForScan(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

export type TestimonialModerationResult = {
  /** Stored testimonial, or null when empty or removed by policy. */
  testimonialText: string | null;
  /** True when we dropped content that violated policy. */
  testimonialModerated: boolean;
};

/**
 * Applies automated checks to client-written testimonials. Harmful or off-platform content is not stored.
 */
export function moderateClientTrainerTestimonial(raw: string | null | undefined): TestimonialModerationResult {
  if (raw == null || !String(raw).trim()) {
    return { testimonialText: null, testimonialModerated: false };
  }
  let text = String(raw).trim();
  if (text.length > MAX_TESTIMONIAL_LEN) {
    text = text.slice(0, MAX_TESTIMONIAL_LEN);
  }

  const lower = normalizeForScan(text);
  if (/\bkys\b/.test(lower)) {
    return { testimonialText: null, testimonialModerated: true };
  }
  for (const phrase of ZERO_TOLERANCE_PHRASES) {
    if (lower.includes(phrase)) {
      return { testimonialText: null, testimonialModerated: true };
    }
  }

  const leak = scanChatTextForLeakageSignals(text);
  if (leak.flagged) {
    return { testimonialText: null, testimonialModerated: true };
  }

  if (/<\s*script/i.test(text) || /javascript\s*:/i.test(text)) {
    return { testimonialText: null, testimonialModerated: true };
  }

  const urlMatches = text.match(/https?:\/\//gi);
  if (urlMatches && urlMatches.length > 2) {
    return { testimonialText: null, testimonialModerated: true };
  }

  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 40) {
    const upper = letters.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.85) {
      return { testimonialText: null, testimonialModerated: true };
    }
  }

  return { testimonialText: text, testimonialModerated: false };
}
