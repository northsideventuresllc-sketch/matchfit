export type TrainerFithubFeedStyle = "ALGORITHMIC" | "NEWEST";

export type TrainerFithubPrefs = {
  feedStyle: TrainerFithubFeedStyle;
  showTextPosts: boolean;
  showImagePosts: boolean;
  showVideoPosts: boolean;
  autoplayVideo: boolean;
  hideRepeatedTrainers: boolean;
};

export const TRAINER_FITHUB_PREFS_STORAGE_KEY = "matchfit.trainer.fithub.prefs.v1";

export const defaultTrainerFithubPrefs: TrainerFithubPrefs = {
  feedStyle: "ALGORITHMIC",
  showTextPosts: true,
  showImagePosts: true,
  showVideoPosts: true,
  autoplayVideo: false,
  hideRepeatedTrainers: false,
};

export function normalizeTrainerFithubPrefs(input: unknown): TrainerFithubPrefs {
  if (!input || typeof input !== "object") return { ...defaultTrainerFithubPrefs };
  const row = input as Partial<TrainerFithubPrefs>;
  return {
    feedStyle: row.feedStyle === "NEWEST" ? "NEWEST" : "ALGORITHMIC",
    showTextPosts: row.showTextPosts ?? true,
    showImagePosts: row.showImagePosts ?? true,
    showVideoPosts: row.showVideoPosts ?? true,
    autoplayVideo: row.autoplayVideo ?? false,
    hideRepeatedTrainers: row.hideRepeatedTrainers ?? false,
  };
}
