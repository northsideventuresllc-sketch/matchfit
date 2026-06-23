import {
  FP_PREMIUM_PAGE_MARKETING,
  FP_TIER_MARKETING_BETA_NOTE,
  FP_TIER_MARKETING_GROUPS,
} from "@/lib/fp-tier-marketing-copy";

function TierCard({
  title,
  feeLabel,
  summary,
  bullets,
  accent,
}: {
  title: string;
  feeLabel: string;
  summary: string;
  bullets: readonly string[];
  accent: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/90 p-5 sm:p-6">
      <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${accent}`} />
      <h4 className="mt-4 text-base font-bold uppercase tracking-wide text-white sm:text-lg">{title}</h4>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#FF7E00]">{feeLabel}</p>
      <p className="mt-3 text-sm leading-relaxed text-white/60">{summary}</p>
      <ul className="mt-4 list-none space-y-2.5 border-t border-white/[0.08] pt-4">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7E00]"
              aria-hidden
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function HomeFitProTypesSection() {
  return (
    <div className="space-y-8">
      <p>
        Match Fit offers four Fitness Pro account types grouped into three paths. Each tier sets how you reach
        clients, what you pay Match Fit, and which communication rules apply in discovery and chat.
      </p>

      {FP_TIER_MARKETING_GROUPS.map((group) => (
        <div key={group.id} className="space-y-4">
          <div>
            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-[#FFD34E]">{group.label}</h4>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{group.description}</p>
          </div>
          <div className={`grid gap-4 ${group.tiers.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {group.tiers.map((tier, index) => (
              <TierCard
                key={tier.tier}
                title={tier.title}
                feeLabel={tier.feeLabel}
                summary={tier.summary}
                bullets={tier.bullets}
                accent={
                  index % 2 === 0
                    ? "from-[#FFD34E] via-[#FF7E00] to-[#E32B2B]"
                    : "from-[#FF7E00] to-[#E32B2B]"
                }
              />
            ))}
          </div>
        </div>
      ))}

      <p className="rounded-xl border border-[#FFD34E]/20 bg-[#FFD34E]/[0.06] p-4 text-xs leading-relaxed text-white/55 sm:text-[13px]">
        <span className="font-semibold text-[#FFD34E]/90">Beta note:</span> {FP_TIER_MARKETING_BETA_NOTE}
      </p>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-[#FF7E00]">
          {FP_PREMIUM_PAGE_MARKETING.title}
        </h4>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#FFD34E]">
          {FP_PREMIUM_PAGE_MARKETING.feeLabel}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{FP_PREMIUM_PAGE_MARKETING.summary}</p>
        <ul className="mt-4 list-none space-y-2.5">
          {FP_PREMIUM_PAGE_MARKETING.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5 text-sm leading-relaxed text-white/50">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFD34E]" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
