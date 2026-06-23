import type { FpDebriefSection } from "@/lib/fp-tier-debrief-copy";

export function HomeFitProDebriefSection({ section }: { section: FpDebriefSection }) {
  return (
    <div className="space-y-8">
      {section.blocks.map((block) => (
        <div key={block.title} className="space-y-3 border-t border-white/[0.08] pt-6 first:border-t-0 first:pt-0">
          <h4 className="text-sm font-bold uppercase tracking-wide text-white/85">{block.title}</h4>
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-white/60">
              {paragraph}
            </p>
          ))}
          {block.bullets ? (
            <ul className="list-none space-y-3 pt-1">
              {block.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-sm leading-relaxed text-white/55">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF7E00]" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
