import type { AiMatchProfileDisplayBlock } from "@/lib/ai-match-profile-parse";

type ClientLevelBucket = "beginner" | "intermediate" | "advanced";

function clientLevelBucketsFromRaw(raw: string): Set<ClientLevelBucket> {
  const s = raw.toLowerCase();
  const set = new Set<ClientLevelBucket>();
  if (/beginner|new to structured/.test(s)) set.add("beginner");
  if (/\bintermediate\b/.test(s)) set.add("intermediate");
  if (/advanced|experienced athlete/.test(s)) set.add("advanced");
  return set;
}

/**
 * Natural-language ideal client copy (no questionnaire dump after a colon).
 */
export function idealClientNarrativeFromMatchLevels(displayName: string, raw: string): string | null {
  const trimmed = raw.trim().replace(/\.\s*$/, "");
  if (!trimmed) return null;
  const b = clientLevelBucketsFromRaw(trimmed);
  if (b.size === 0) {
    return `${displayName} shapes each relationship around the person in front of them, adapting tone and programming so coaching still feels personal—not copied from a template.`;
  }
  if (b.size === 3) {
    return `${displayName} is comfortable meeting clients wherever they are, from the first few weeks of structured training through high-level, performance-focused work, so sessions feel dialed in rather than one-size-fits-all.`;
  }
  if (b.has("beginner") && b.size === 1) {
    return `${displayName} especially loves helping people who are newer to structured training build habits that stick, with patience, clarity, and a plan that grows with them.`;
  }
  if (b.has("intermediate") && b.size === 1) {
    return `${displayName} often works with clients who already feel at home in the gym and want smarter programming, steady accountability, and a coach who can refine what they are already doing.`;
  }
  if (b.has("advanced") && b.size === 1) {
    return `${displayName} gravitates toward experienced athletes who want thoughtful progressions, honest feedback, and a training partner who respects how seriously they take their sport or goals.`;
  }
  if (b.has("beginner") && b.has("intermediate")) {
    return `${displayName} splits time between newcomers finding their footing and intermediate clients tightening routines, keeping workouts challenging without ever feeling out of reach.`;
  }
  if (b.has("beginner") && b.has("advanced")) {
    return `${displayName} bridges the gap between first-time structure-seekers and seasoned athletes, adjusting complexity and coaching style so every session still feels like it was built for that day.`;
  }
  if (b.has("intermediate") && b.has("advanced")) {
    return `${displayName} does some of their strongest work with intermediate through advanced clients who want sharper coaching, direct feedback, and programming that respects how hard they already train.`;
  }
  return `${displayName} shapes each relationship around the person in front of them, drawing on the backgrounds their clients bring in so the work stays grounded in real life.`;
}

export type PublicCoachMatchProfileResult = {
  highlightBlocks: AiMatchProfileDisplayBlock[];
  idealClientParagraph: string | null;
};

/**
 * Client-facing coach profile: drop grouped goals, remove ideal-client from card list (render as prose elsewhere).
 */
export function mapMatchProfileBlocksForPublicClientPage(
  blocks: AiMatchProfileDisplayBlock[],
  coachDisplayName: string,
): PublicCoachMatchProfileResult {
  let idealRaw: string | null = null;
  const filtered = blocks.filter((b) => {
    if (b.kind === "kv" && b.title === "Primary client goals") return false;
    if (b.kind === "kv" && b.title === "Ideal Client Profile") {
      idealRaw = b.value;
      return false;
    }
    return true;
  });

  const idealClientParagraph =
    idealRaw != null ? idealClientNarrativeFromMatchLevels(coachDisplayName, idealRaw) : null;

  return { highlightBlocks: filtered, idealClientParagraph };
}
