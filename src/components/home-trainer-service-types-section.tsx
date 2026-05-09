import {
  MATCH_SERVICE_CATALOG,
  MATCH_SERVICE_IDS_NUTRITION_OFFERING,
  type MatchServiceId,
} from "@/lib/trainer-match-questionnaire";

function deliverySummary(s: (typeof MATCH_SERVICE_CATALOG)[number]): string {
  if (s.virtual && s.inPerson) {
    return "Match Fit supports virtual sessions, in-person / mobile sessions at locations you cover, or both—depending on how you configure each published package.";
  }
  if (s.virtual) {
    return "This template is built for virtual delivery (for example live video sessions or ongoing remote coaching, depending on how you price the package).";
  }
  return "This template is built for in-person or mobile sessions within the travel radius you publish from your base ZIP code.";
}

function credentialTrack(id: MatchServiceId): "nutrition" | "personal_training" {
  return MATCH_SERVICE_IDS_NUTRITION_OFFERING.includes(id) ? "nutrition" : "personal_training";
}

function trackRequirementBullets(track: "nutrition" | "personal_training"): string[] {
  if (track === "nutrition") {
    return [
      "Select the nutrition professional path during trainer onboarding and upload the nutrition credentials Match Fit requests.",
      "Your nutrition credential review must reach APPROVED before you can publish Nutrition & Accountability Coaching or Custom Online Program / Plan Design packages.",
    ];
  }
  return [
    "Select the CPT personal-training path or an approved specialist path (for example CSCS, CES, or group fitness) during onboarding and upload the credentials Match Fit requests.",
    "Certification review for that training track must reach APPROVED before you can publish these training-style catalogue packages.",
  ];
}

const SERVICE_NARRATIVE: Record<
  MatchServiceId,
  { description: string; specifics: string[] }
> = {
  one_on_one_pt: {
    description:
      "Private, individualized coaching sessions—strength, conditioning, accountability, or general fitness—scheduled directly with a client. You set the length, cadence, and whether sessions are virtual, in-person, or a mix.",
    specifics: [
      "Typical billing templates include per session, per hour, or multi-session bundles when enabled for this service type.",
    ],
  },
  small_group: {
    description:
      "Semi-private coaching for two to eight participants. Ideal for couples, friends, or small teams who want shared energy while still getting coach attention.",
    specifics: [
      "Billing can include per-session, per-hour, multi-session packs, or per-person pricing when you configure a small-group line item.",
    ],
  },
  nutrition_coaching: {
    description:
      "Ongoing nutrition and accountability coaching delivered virtually—habit coaching, check-ins, education, and structured support that complements (or stands apart from) live training.",
    specifics: [
      "Cadence-style billing is supported (for example weekly, twice weekly, or monthly packages), consistent with how recurring coaching is sold in the dashboard.",
      "This catalogue entry is virtual-only; you cannot mark it solely as a traveling in-person nutrition visit.",
    ],
  },
  online_program: {
    description:
      "Written or hybrid DIY programming that clients execute on their own time—progressions, swaps, and updates you deliver through Match Fit's DIY workflows rather than only live appointments.",
    specifics: [
      "Match Fit groups this template with the nutrition catalogue for publishing controls, so the nutrition professional path and approved nutrition credential are required—even when the programming itself is training-focused.",
      "Cadence-style billing is supported (weekly, twice weekly, or monthly) because the product is structured as an ongoing program, not a single drop-in session.",
      "First-deliverable timelines, client attestations, and extension rules follow the DIY sections of Match Fit's Terms when those flows apply to a purchase.",
    ],
  },
  sports_specific: {
    description:
      "Performance-oriented coaching tied to a sport or competitive goal—speed, agility, return-to-play prep, off-season work, or event-specific peaking.",
    specifics: [
      "You are expected to stay within the scope of credentials you were approved for (CPT or specialist track) and represent sport experience honestly in your questionnaire and listings.",
    ],
  },
  mobility_recovery: {
    description:
      "Hands-on or guided mobility, tissue work, breath, and recovery strategies meant to improve range of motion, reduce discomfort, and support return-to-training—delivered where you meet clients in person.",
    specifics: [
      "Because this template is in-person / mobile only in Match Fit's catalogue, you must actually offer on-site or travel-to-client sessions inside the radius you publish.",
    ],
  },
  hiit_conditioning: {
    description:
      "High-intensity interval and metabolic conditioning blocks for clients who want efficient cardio, engine work, or structured metabolic finishers alongside their strength plan.",
    specifics: [
      "Virtual, in-person, or hybrid delivery is supported when your account and package settings allow it.",
    ],
  },
  yoga_pilates_style: {
    description:
      "Mindful movement, breath-led flows, or Pilates-style core and postural work for clients seeking lower-impact training days, active recovery, or dedicated mobility-focused sessions.",
    specifics: [
      "Virtual, in-person, or hybrid delivery is supported when your account and package settings allow it.",
    ],
  },
};

/** Sub-section `<summary>` rows: explicit casing (no `uppercase` transform). */
const innerDetailsClass =
  "rounded-xl border border-white/[0.06] bg-black/20 px-3 py-0.5 [&>summary]:min-h-[2.75rem] [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:select-none [&>summary]:items-center [&>summary]:gap-2 [&>summary]:pr-1 [&>summary]:text-sm [&>summary]:font-semibold [&>summary]:text-white/80 [&>summary]:[-webkit-details-marker]:hidden [&>summary]:focus-visible:outline [&>summary]:focus-visible:outline-2 [&>summary]:focus-visible:outline-offset-2 [&>summary]:focus-visible:outline-[#FF7E00]/70";

const innerSummaryRowClass = "flex w-full items-center gap-2";

const chevronClass =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/[0.1] text-[10px] font-bold text-white/45 transition-transform duration-200";

export function HomeTrainerServiceTypesSection() {
  return (
    <section
      id="trainer-service-types"
      className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 p-7 shadow-[0_34px_90px_-50px_rgba(227,43,43,0.45)] backdrop-blur-xl sm:p-9"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,126,0,0.22),transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-12 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(227,43,43,0.18),transparent_72%)]"
      />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">For trainers</p>
        <h2 className="mt-3 text-balance text-xl font-black uppercase leading-tight tracking-wide text-white sm:text-2xl md:text-[1.65rem]">
          Trainer services you can list on Match Fit
        </h2>

        <details className="group/intro mt-4 rounded-2xl border border-white/[0.07] bg-[#0E1016]/60">
          <summary
            className={`${innerSummaryRowClass} cursor-pointer list-none px-4 py-3 text-left text-sm font-semibold text-white/80 [-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70 sm:px-5 sm:py-3.5 sm:text-[15px]`}
          >
            <span
              className={`${chevronClass} group-open/intro:rotate-90`}
              aria-hidden
            >
              ▸
            </span>
            About This Section
          </summary>
          <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 text-pretty text-[15px] leading-relaxed text-white/65 sm:px-5 sm:text-base">
            Every line item below maps to a catalogue template inside your dashboard. Descriptions explain what clients
            should expect; requirements mirror what Match Fit enforces before a package can publish and be purchased.
            Expand each template to read details at your own pace.
          </div>
        </details>

        <div className="mt-8 space-y-4 border-t border-white/[0.08] pt-8">
          {MATCH_SERVICE_CATALOG.map((svc) => {
            const track = credentialTrack(svc.id);
            const narrative = SERVICE_NARRATIVE[svc.id];
            const catalogueBadge = track === "nutrition" ? "Nutrition Catalogue" : "Training Catalogue";
            return (
              <details
                key={svc.id}
                className="group/svc rounded-2xl border border-white/[0.07] bg-[#0E1016]/90"
              >
                <summary
                  className={`${innerSummaryRowClass} min-h-[3.25rem] cursor-pointer list-none px-4 py-3 [-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70 sm:px-5 sm:py-4`}
                >
                  <span className={`${chevronClass} mt-0.5 group-open/svc:rotate-90`} aria-hidden>
                    ▸
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="text-lg font-bold leading-snug text-white">{svc.label}</span>
                    <span className="w-fit shrink-0 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-white/55">
                      {catalogueBadge}
                    </span>
                  </span>
                </summary>

                <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                  <details className={`group/t1 ${innerDetailsClass}`}>
                    <summary className={innerSummaryRowClass}>
                      <span className={`${chevronClass} group-open/t1:rotate-90`} aria-hidden>
                        ▸
                      </span>
                      Template Overview
                    </summary>
                    <p className="mt-2 border-t border-white/[0.05] pt-3 text-sm leading-relaxed text-white/60 sm:text-[15px]">
                      {narrative.description}
                    </p>
                  </details>

                  <details className={`group/t2 ${innerDetailsClass}`}>
                    <summary className={innerSummaryRowClass}>
                      <span className={`${chevronClass} group-open/t2:rotate-90`} aria-hidden>
                        ▸
                      </span>
                      How Delivery Works on Match Fit
                    </summary>
                    <p className="mt-2 border-t border-white/[0.05] pt-3 text-sm leading-relaxed text-white/55 sm:text-[15px]">
                      {deliverySummary(svc)}
                    </p>
                  </details>

                  {narrative.specifics.length ? (
                    <details className={`group/t3 ${innerDetailsClass}`}>
                      <summary className={innerSummaryRowClass}>
                        <span className={`${chevronClass} group-open/t3:rotate-90`} aria-hidden>
                          ▸
                        </span>
                        Service-Specific Notes
                      </summary>
                      <ul className="mt-2 list-disc space-y-1.5 border-t border-white/[0.05] pt-3 pl-5 text-sm leading-relaxed text-white/55 sm:text-[15px]">
                        {narrative.specifics.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <details className={`group/t4 ${innerDetailsClass}`}>
                    <summary className={innerSummaryRowClass}>
                      <span className={`${chevronClass} group-open/t4:rotate-90`} aria-hidden>
                        ▸
                      </span>
                      Requirements to Offer This Template
                    </summary>
                    <ul className="mt-2 list-disc space-y-1.5 border-t border-white/[0.05] pt-3 pl-5 text-sm leading-relaxed text-white/55 sm:text-[15px]">
                      {trackRequirementBullets(track).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                      <li>
                        Complete the Match Fit match questionnaire so clients understand your coaching philosophy, goals,
                        languages, and service area before purchases unlock.
                      </li>
                      <li>
                        Satisfy marketplace compliance for your account (for example trainer agreements, tax documentation,
                        and background screening where required) so your dashboard can stay active for payouts.
                      </li>
                      <li>
                        If you sell in-person or hybrid packages, publish a valid U.S. ZIP for your base and a travel
                        radius (up to 150 miles) that covers where you actually meet clients.
                      </li>
                      <li>
                        Each published package needs a clear client-facing description, an allowed billing unit for that
                        template, and pricing within Match Fit&apos;s published limits at checkout.
                      </li>
                    </ul>
                  </details>
                </div>
              </details>
            );
          })}
        </div>

        <details className="group/outro mt-8 rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <summary
            className={`${innerSummaryRowClass} cursor-pointer list-none px-4 py-3 text-left text-xs font-semibold text-white/70 [-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70 sm:px-5 sm:text-[13px]`}
          >
            <span className={`${chevronClass} text-[9px] group-open/outro:rotate-90`} aria-hidden>
              ▸
            </span>
            Catalogue Summary
          </summary>
          <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 text-xs leading-relaxed text-white/45 sm:px-5 sm:text-[13px]">
            Match Fit splits catalogue publishing into{" "}
            <span className="font-semibold text-white/70">training-style</span> versus{" "}
            <span className="font-semibold text-white/70">nutrition-style</span> offerings. Training-style templates require
            an approved CPT or approved specialist credential; nutrition-style templates require an approved nutrition
            credential. The platform may decline or unpublish listings that misrepresent credentials, delivery modes, or
            geographic coverage.
          </div>
        </details>
      </div>
    </section>
  );
}
