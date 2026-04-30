/**
 * Full document navigation via `location.assign`, deferred to the next macrotask so React and
 * Next.js can finish the current commit. Navigating synchronously from async handlers (especially
 * right before/after `setState`) has been observed to leave the dev shell stuck on a dark overlay.
 */
export function navigateWithFullLoad(url: string): void {
  window.setTimeout(() => {
    window.location.assign(url);
  }, 0);
}
