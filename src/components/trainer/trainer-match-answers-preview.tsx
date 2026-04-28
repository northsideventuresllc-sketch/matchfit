import type { AiMatchProfileDisplayBlock } from "@/lib/ai-match-profile-parse";

export function TrainerMatchAnswersPreview(props: {
  blocks: AiMatchProfileDisplayBlock[];
  /** Public coach profile: calmer “bio” styling for long text (no faux input scroll box). */
  variant?: "dashboard" | "public";
}) {
  const variant = props.variant ?? "dashboard";
  if (props.blocks.length === 0) {
    return <p className="text-sm text-white/45">No answers on file yet.</p>;
  }

  const titleClass = "text-xs font-semibold text-[#FF7E00]/95";

  return (
    <div className="space-y-4">
      {props.blocks.map((b, idx) => {
        if (b.kind === "kv") {
          return (
            <div
              key={`${b.title}-${idx}`}
              className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,211,78,0.06)_0%,rgba(18,21,28,0.92)_38%,rgba(14,16,22,0.98)_100%)] p-4 sm:p-5"
            >
              <p className={titleClass}>{b.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/88">{b.value}</p>
            </div>
          );
        }
        if (b.kind === "list") {
          return (
            <div
              key={`${b.title}-${idx}`}
              className="rounded-2xl border border-white/[0.07] bg-[#0E1016]/75 p-4 sm:p-5"
            >
              <p className={titleClass}>{b.title}</p>
              <ul className="mt-3 space-y-2.5">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-sm leading-snug text-white/85">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7E00]/80" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (variant === "public") {
          return (
            <div key={`${b.title}-${idx}`} className="pt-1">
              <h3 className={titleClass}>{b.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-[1.75] text-white/85">{b.body}</p>
            </div>
          );
        }
        return (
          <div
            key={`${b.title}-${idx}`}
            className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 p-4 sm:p-6"
          >
            <p className={titleClass}>{b.title}</p>
            <div className="mt-3 max-h-[min(24rem,55vh)] overflow-y-auto rounded-xl border border-white/[0.05] bg-[#07080C]/80 p-4">
              <p className="whitespace-pre-wrap text-sm leading-[1.65] text-white/82">{b.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
