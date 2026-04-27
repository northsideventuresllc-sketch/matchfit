/**
 * Client-facing trainer profile URL.
 * Keep in sync with `src/app/trainers/[username]/page.tsx`.
 */
export function trainerPublishedProfilePath(username: string): string {
  const u = username.trim();
  return `/trainers/${encodeURIComponent(u)}`;
}
