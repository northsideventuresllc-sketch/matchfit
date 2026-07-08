import {
  CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  repurposePostLength,
} from "@/lib/content-calendar/content-rules";

export function ContentCaptionCharLimit(props: { caption: string; hashtags: string[] }) {
  const charCount = repurposePostLength(props.caption, props.hashtags);
  const withinLimit = charCount <= CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT;

  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px]">
      {!withinLimit ? (
        <span className="font-bold uppercase tracking-[0.12em] text-amber-300">MAY NOT FIT IN CAPTION</span>
      ) : (
        <span className="text-white/30">Caption + hashtags (Threads repurpose limit)</span>
      )}
      <span className={withinLimit ? "text-white/40" : "font-semibold text-amber-300"}>
        {charCount}/{CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT}
      </span>
    </div>
  );
}
