/**
 * Full document navigation via `location.assign`, deferred past the current frame so React and
 * Next.js can finish the current commit. Navigating too early from async handlers has been observed
 * to leave the dev shell stuck on a dark overlay (tinted black, “frozen” UI).
 */
export function navigateWithFullLoad(url: string): void {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    window.setTimeout(() => {
      window.location.assign(url);
    }, 16);
  });
}
