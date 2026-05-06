/** Values accepted by `POST /api/safety/block` as `blockMode`. */
export type SafetyBlockMode =
  | "full"
  | "match_feed_only"
  | "fithub_only"
  | "chat_only"
  | "trainer_fithub_mute"
  | "discover_only";
