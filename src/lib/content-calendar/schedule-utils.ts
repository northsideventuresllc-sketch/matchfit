/** End of calendar day in US Eastern (handles EST/EDT via Intl). */
export function endOfDayEstMs(isoDate: string, now = new Date()): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const match = offsetPart.match(/GMT([+-]\d+)/);
  const offsetHours = match ? Number.parseInt(match[1], 10) : -5;
  const utcEnd = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetHours * 60 * 60 * 1000;
  void now;
  return utcEnd;
}

export function estDateString(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function isPostMissed(args: {
  postDate: string;
  posted: boolean;
  now?: Date;
}): boolean {
  if (args.posted) return false;
  if (!args.postDate?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(args.postDate.trim())) return false;
  const now = args.now ?? new Date();
  return now.getTime() > endOfDayEstMs(args.postDate.trim(), now);
}

/** Show missed-post bubble on the calendar day after the scheduled post date (EST). */
export function shouldShowMissedPrompt(args: {
  postDate: string;
  posted: boolean;
  missedPromptDismissed: boolean;
  now?: Date;
}): boolean {
  if (args.posted || args.missedPromptDismissed) return false;
  if (!isPostMissed({ postDate: args.postDate, posted: args.posted, now: args.now })) return false;
  const todayEst = estDateString(args.now);
  return todayEst > args.postDate;
}
