import { z } from "zod";

export const clientFithubFeedStyleSchema = z.enum(["ALGORITHMIC", "NEWEST", "SAVED_COACHES_ONLY"]);

export const clientFithubPrefsSchema = z.object({
  feedStyle: clientFithubFeedStyleSchema.default("ALGORITHMIC"),
  /** Prefer coaches you have saved (proxy for “your circle” until regional matching ships). */
  prioritizeSavedCoaches: z.boolean().default(true),
  /** Extra boost for saved coaches in the algorithmic mix (treated as “in your area” until zip-based routing exists). */
  onlyTrainersInYourArea: z.boolean().default(false),
  showTextPosts: z.boolean().default(true),
  showImagePosts: z.boolean().default(true),
  showVideoPosts: z.boolean().default(true),
  autoplayVideo: z.boolean().default(false),
  showHighIntensityContent: z.boolean().default(true),
  hideRepeatedTrainers: z.boolean().default(false),
});

export type ClientFithubFeedStyle = z.infer<typeof clientFithubFeedStyleSchema>;
export type ClientFithubPrefs = z.infer<typeof clientFithubPrefsSchema>;

export const defaultClientFithubPrefs: ClientFithubPrefs = {
  feedStyle: "ALGORITHMIC",
  prioritizeSavedCoaches: true,
  onlyTrainersInYourArea: false,
  showTextPosts: true,
  showImagePosts: true,
  showVideoPosts: true,
  autoplayVideo: false,
  showHighIntensityContent: true,
  hideRepeatedTrainers: false,
};

export function parseClientFithubPrefsJson(raw: string | null | undefined): ClientFithubPrefs {
  if (!raw?.trim()) return { ...defaultClientFithubPrefs };
  try {
    const parsed = clientFithubPrefsSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : { ...defaultClientFithubPrefs };
  } catch {
    return { ...defaultClientFithubPrefs };
  }
}

export function serializeClientFithubPrefs(p: ClientFithubPrefs): string {
  return JSON.stringify(clientFithubPrefsSchema.parse(p));
}
