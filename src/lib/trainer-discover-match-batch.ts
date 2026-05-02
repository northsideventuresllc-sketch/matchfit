export const STANDARD_MATCH_BATCH_SIZE = 10;
export const MATCH_BATCH_WINDOW_MS = 12 * 60 * 60 * 1000;

export function currentTrainerDiscoverBucket(): number {
  return Math.floor(Date.now() / MATCH_BATCH_WINDOW_MS);
}
