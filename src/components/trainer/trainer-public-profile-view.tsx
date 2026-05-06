import Link from "next/link";
import type { AiMatchProfileDisplayBlock } from "@/lib/ai-match-profile-parse";
import { coachServiceCheckoutSearch } from "@/lib/trainer-service-offerings";
import { TrainerProfileClientPrivacyMenu } from "@/components/client/trainer-profile-client-privacy-menu";
import { ClientCoachReviewPanel } from "@/components/client/client-coach-review-panel";
import { TrainerMatchAnswersPreview } from "@/components/trainer/trainer-match-answers-preview";
import { TrainerProfileCopyLinkButton } from "@/components/trainer/trainer-profile-copy-link-button";
import { TrainerSocialBrandIcon } from "@/components/trainer/trainer-social-brand-icons";
import type { TrainerSocialPlatform } from "@/lib/trainer-social-urls";

export type TrainerPublicSocialLink = {
  platform: TrainerSocialPlatform;
  url: string;
  label: string;
};

const SOCIAL_PLATFORM_ORDER: Record<TrainerSocialPlatform, number> = {
  instagram: 0,
  tiktok: 1,
  facebook: 2,
  linkedin: 3,
  other: 4,
};

function orderedPublicSocialLinks(links: TrainerPublicSocialLink[]): TrainerPublicSocialLink[] {
  return [...links].sort((a, b) => SOCIAL_PLATFORM_ORDER[a.platform] - SOCIAL_PLATFORM_ORDER[b.platform]);
}

export type TrainerPublicReviewSummaryProps = {
  averageStars: number | null;
  windowCount: number;
  items: { id: string; stars: number; testimonialText: string | null; createdAt: string }[];
};

export type TrainerPublicProfileViewProps = {
  displayName: string;
  username: string;
  bio: string | null;
  profileImageUrl: string | null;
  pronouns: string | null;
  fitnessNiches: string | null;
  yearsCoaching: string | null;
  languagesSpoken: string | null;
  genderIdentity: string | null;
  ethnicity: string | null;
  certificationBadges: string[];
  socialLinks: TrainerPublicSocialLink[];
  fullProfileUrl: string;
  /** Client account, trainer dashboard, or client portal when signed out. */
  backToDashboardHref: string;
  messageHref: string;
  /** When true (coach viewing own `/trainers/...` link), client CTAs are non-interactive preview only. */
  disableClientActions?: boolean;
  servicesRates: string[] | null;
  /** Human ideal-client copy; questionnaire “levels” are not shown verbatim. */
  idealClientParagraph: string | null;
  highlightBlocks: AiMatchProfileDisplayBlock[];
  /** Latest client reviews shown on this page (up to ten). */
  reviewSummary: TrainerPublicReviewSummaryProps;
  /** Logged-in client (not the coach previewing) may rate from this page. */
  showClientReviewPanel?: boolean;
  /** Structured packages (from dashboard offerings) for browsing; checkout links depend on chat + trainer settings. */
  browseableServices:
    | { serviceId: string; variationId: string | null; bundleTierId: string | null; label: string }[]
    | null;
  /** When set, logged-in matched clients tap through to `/client/checkout/coach-service` with this context. */
  servicesCheckoutLinkContext: "profile" | "chat" | null;
  /** Viewer has an open chat thread with this coach. */
  officialChatMatched: boolean;
  trainerAllowsProfileCheckout: boolean;
  /** Session has a client id (used to route sign-in vs checkout prep page). */
  clientIsSignedIn: boolean;
  /** After Stripe return on coach service payment. */
  checkoutNotice?: "success" | "canceled" | null;
  /** Logged-in client (not previewing own link): discreet feed & privacy controls in the header. */
  showClientPrivacyMenu?: boolean;
  /** Public availability summary page (set from the trainer dashboard). */
  availabilityHref?: string;
};

function chip(text: string) {
  const t = text.trim();
  if (!t) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/80">
      {t}
    </span>
  );
}

export function TrainerPublicProfileView(props: TrainerPublicProfileViewProps) {
  const preview = Boolean(props.disableClientActions);
  const initial = props.displayName.trim().charAt(0).toUpperCase() || "?";
  const avatar = props.profileImageUrl?.split("?")[0];

  const nicheLine = props.fitnessNiches?.trim();
  const nicheChips = nicheLine
    ? nicheLine
        .split(/[,;]|(?:\s+•\s+)|(?:\s+\|\s+)/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const socialLinksOrdered = orderedPublicSocialLinks(props.socialLinks);

  return (
    <main className="min-h-dvh bg-[#07080C] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(255,126,0,0.12),transparent_50%),radial-gradient(ellipse_80%_50%_at_100%_20%,rgba(255,211,78,0.06),transparent_45%)]"
      />

      <div className="relative z-10 mx-auto max-w-lg px-4 pb-24 pt-4 sm:px-6 lg:max-w-2xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <Link
            href={props.backToDashboardHref}
            className="text-xs font-black uppercase tracking-[0.12em] text-white/45 transition hover:text-[#FF7E00]"
          >
            ← BACK TO DASHBOARD
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {props.showClientPrivacyMenu ? (
              <TrainerProfileClientPrivacyMenu trainerUsername={props.username} />
            ) : null}
            <TrainerProfileCopyLinkButton
              url={props.fullProfileUrl}
              className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-white/75 transition hover:border-white/25 hover:text-white"
            />
          </div>
        </header>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0B0C0F] shadow-[0_40px_100px_-48px_rgba(0,0,0,0.95)]">
          <div className="relative h-36 bg-[linear-gradient(135deg,#2a1810_0%,#12151C_45%,#0E1016_100%)] sm:h-44">
            <div
              aria-hidden
              className="absolute inset-0 opacity-40 mix-blend-screen"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          <div className="relative -mt-16 px-5 pb-8 pt-0 sm:px-8">
            {preview ? (
              <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.12] px-3 py-2.5 text-center text-[11px] font-semibold leading-relaxed text-amber-100/95">
                You&apos;re previewing your client-facing profile. Message and checkout stay inactive here so you
                aren&apos;t sent through the client sign-in flow by mistake.
              </p>
            ) : null}
            {!preview && props.checkoutNotice === "success" ? (
              <p
                className="mb-5 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.12] px-3 py-2.5 text-center text-[11px] font-semibold leading-relaxed text-emerald-100/95"
                role="status"
              >
                Payment received. You’ll get a Billing notification here; email or SMS receipt follows your notification
                settings when configured.
              </p>
            ) : null}
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left">
              <div className="relative h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-[1.35rem] border-[3px] border-[#0B0C0F] bg-[#12151C] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local upload path
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white/35">
                    {initial}
                  </div>
                )}
              </div>
              <div className="mt-4 min-w-0 flex-1 sm:mt-0 sm:pb-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Coach</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{props.displayName}</h1>
                <p className="mt-1 text-sm font-semibold text-white/50">@{props.username}</p>
                {props.reviewSummary.windowCount > 0 && props.reviewSummary.averageStars != null ? (
                  <p className="mt-2 inline-flex items-center rounded-full border border-[#FFD34E]/35 bg-[#FFD34E]/[0.1] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]">
                    {props.reviewSummary.averageStars.toFixed(1)}★ trainer · {props.reviewSummary.windowCount} recent
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-white/45">No reviews posted yet.</p>
                )}
                {props.pronouns?.trim() ? (
                  <p className="mt-1 text-xs text-white/40">{props.pronouns.trim()}</p>
                ) : null}
              </div>
            </div>

            {props.certificationBadges.length > 0 ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
                {props.certificationBadges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-[#FF7E00]/35 bg-[#FF7E00]/[0.12] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#FFD34E]"
                  >
                    {b}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-center text-xs text-white/35 sm:text-left">Match Fit Coach</p>
            )}

            <div className="mt-6">
              {preview ? (
                <div
                  role="presentation"
                  aria-hidden
                  className="inline-flex min-h-[3.25rem] w-full cursor-not-allowed select-none items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.06] px-5 text-sm font-black uppercase tracking-[0.1em] text-white/40 sm:max-w-md"
                >
                  Message coach
                </div>
              ) : (
                <Link
                  href={props.messageHref}
                  className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FF7E00_0%,#E32B2B_100%)] px-5 text-sm font-black uppercase tracking-[0.1em] text-white shadow-[0_16px_40px_-12px_rgba(255,126,0,0.55)] transition hover:brightness-110 sm:max-w-md"
                >
                  Message coach
                </Link>
              )}
            </div>
            {props.availabilityHref && !preview ? (
              <p className="mt-3 text-center sm:text-left">
                <Link
                  href={props.availabilityHref}
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FF9A4A] underline-offset-2 hover:underline"
                >
                  See availability
                </Link>
              </p>
            ) : null}
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40 sm:text-left">
              {preview
                ? "On your live link, clients tap here to open chat with you. This control is preview-only while you are signed in as the coach."
                : "Questions about packages or scheduling? Start a conversation—coaches reply here first."}
            </p>

            {props.servicesRates && props.servicesRates.length > 0 ? (
              <section className="mt-8 border-t border-white/[0.06] pt-8">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#FF7E00]">Services and rates</h2>
                <p className="mt-2 text-xs text-white/45">
                  {preview
                    ? "Transparent pricing on your live profile. Clients tap a row to review totals and pay when checkout is enabled for them."
                    : props.browseableServices && props.browseableServices.length > 0
                      ? !props.clientIsSignedIn
                        ? "Sign in to message this coach and purchase packages once your chat is open."
                        : !props.officialChatMatched
                          ? "Message the coach to connect first. After your chat opens, you can purchase here (or use a checkout link they send in chat)."
                          : !props.trainerAllowsProfileCheckout
                            ? "Your chat is open—tap a package to review totals and pay, or use a checkout link your coach sends in Messages."
                            : "Tap a package to review totals, then complete payment on Stripe. Message the coach for custom bundles."
                      : "Transparent pricing. Tap Message if you want a custom bundle or a payment link from your coach."}
                </p>
                <ul className="mt-5 space-y-3">
                  {(props.browseableServices && props.browseableServices.length > 0
                    ? props.browseableServices
                    : props.servicesRates.map((label, i) => ({
                        serviceId: `legacy-${i}`,
                        variationId: null as string | null,
                        bundleTierId: null as string | null,
                        label,
                      }))
                  ).map((row, i) => {
                    const canLinkCheckout =
                      props.servicesCheckoutLinkContext != null &&
                      Boolean(props.browseableServices && props.browseableServices.length > 0) &&
                      !preview &&
                      !row.serviceId.startsWith("legacy-");
                    const innerPath = canLinkCheckout
                      ? `/client/checkout/coach-service?${coachServiceCheckoutSearch(
                          props.username,
                          {
                            serviceId: row.serviceId,
                            variationId: row.variationId,
                            bundleTierId: row.bundleTierId,
                          },
                          { checkoutContext: props.servicesCheckoutLinkContext! },
                        )}`
                      : "";
                    const href = canLinkCheckout
                      ? props.clientIsSignedIn
                        ? innerPath
                        : `/client?next=${encodeURIComponent(innerPath)}`
                      : "";

                    const rowClass =
                      "flex gap-3 rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,126,0,0.08)_0%,rgba(14,16,22,0.95)_42%)] px-4 py-3.5 text-sm leading-snug text-white/88" +
                      (canLinkCheckout ? " transition hover:border-[#FF7E00]/45 hover:bg-[linear-gradient(145deg,rgba(255,126,0,0.14)_0%,rgba(14,16,22,0.95)_42%)]" : "");

                    const rowKey = `${row.serviceId}-${row.variationId ?? ""}-${row.bundleTierId ?? ""}-${i}`;

                    return (
                      <li key={rowKey}>
                        {canLinkCheckout ? (
                          <Link href={href} className={`${rowClass} min-h-[3.25rem] items-center`}>
                            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF7E00]/20 text-[11px] font-black text-[#FFD34E]">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1">{row.label}</span>
                            <span className="shrink-0 self-center text-[10px] font-black uppercase tracking-[0.12em] text-[#FF7E00]">
                              Checkout →
                            </span>
                          </Link>
                        ) : (
                          <div className={rowClass}>
                            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF7E00]/20 text-[11px] font-black text-[#FFD34E]">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1">{row.label}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-center text-[10px] leading-relaxed italic text-white/38 sm:text-left">
                  {preview
                    ? "Clients who are logged in and connected can open checkout from each row when your settings allow."
                    : "Match Fit applies a 20% administrative fee on coach packages at checkout (separate Stripe line, non-refundable), plus payment processing fees. Your $5/month platform subscription is managed under "}
                  {!preview ? (
                    <>
                      <Link
                        href={props.clientIsSignedIn ? "/client/dashboard/billing" : `/client?next=${encodeURIComponent("/client/dashboard/billing")}`}
                        className="font-semibold text-[#FF7E00]/90 underline-offset-2 hover:underline"
                      >
                        Billing
                      </Link>
                      .
                    </>
                  ) : null}
                </p>
              </section>
            ) : (
              <section className="mt-8 border-t border-white/[0.06] pt-8">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Services and rates</h2>
                <p className="mt-3 text-sm text-white/55">
                  This coach has not listed packages here yet. Message them for session types and current rates.
                </p>
              </section>
            )}

            {(props.yearsCoaching?.trim() || nicheChips.length > 0) && (
              <div className="mt-8 flex flex-wrap justify-center gap-2 border-t border-white/[0.06] pt-8 sm:justify-start">
                {props.yearsCoaching?.trim() ? chip(`${props.yearsCoaching.trim()} experience`) : null}
                {nicheChips.slice(0, 8).map((n) => {
                  const c = chip(n);
                  return c ? <span key={n}>{c}</span> : null;
                })}
              </div>
            )}

            <section className="mt-10 border-t border-white/[0.06] pt-8">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">About</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/82">
                {props.bio?.trim() ? props.bio.trim() : "This coach is finishing their bio—say hello and ask how they can help you reach your goals."}
              </p>
            </section>

            <section className="mt-10 border-t border-white/[0.06] pt-8">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Client reviews</h2>
              {props.reviewSummary.windowCount > 0 && props.reviewSummary.averageStars != null ? (
                <p className="mt-3 text-sm font-semibold text-white/85">
                  <span className="text-[#FFD34E]">{props.reviewSummary.averageStars.toFixed(1)}★</span>{" "}
                  <span className="text-white/50">
                    average from {props.reviewSummary.windowCount} recent review
                    {props.reviewSummary.windowCount === 1 ? "" : "s"} (rolling window of up to ten).
                  </span>
                </p>
              ) : (
                <p className="mt-3 text-sm text-white/50">No reviews posted yet.</p>
              )}
              {props.reviewSummary.items.some((it) => it.testimonialText?.trim()) ? (
                <ul className="mt-5 space-y-4">
                  {props.reviewSummary.items
                    .filter((it) => it.testimonialText?.trim())
                    .map((it) => (
                      <li
                        key={it.id}
                        className="rounded-2xl border border-white/[0.07] bg-[#0E1016]/70 px-4 py-3.5 text-sm leading-relaxed text-white/82"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#FF7E00]/90">
                          {it.stars}★ testimonial
                        </p>
                        <p className="mt-2 whitespace-pre-wrap">{it.testimonialText!.trim()}</p>
                      </li>
                    ))}
                </ul>
              ) : props.reviewSummary.windowCount > 0 ? (
                <p className="mt-4 text-xs text-white/45">Recent ratings are star-only—clients chose not to add written testimonials.</p>
              ) : null}
            </section>

            {!preview && props.showClientReviewPanel ? (
              <section className="mt-10 border-t border-white/[0.06] pt-8">
                <ClientCoachReviewPanel trainerUsername={props.username} />
              </section>
            ) : null}

            {(props.languagesSpoken?.trim() ||
              props.genderIdentity?.trim() ||
              props.ethnicity?.trim()) && (
              <section className="mt-8">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Background</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  {props.languagesSpoken?.trim() ? (
                    <div className="flex flex-col gap-0.5 rounded-xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-white/35">Languages</dt>
                      <dd className="text-white/80">{props.languagesSpoken.trim()}</dd>
                    </div>
                  ) : null}
                  {props.genderIdentity?.trim() ? (
                    <div className="flex flex-col gap-0.5 rounded-xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-white/35">Identity</dt>
                      <dd className="text-white/80">{props.genderIdentity.trim()}</dd>
                    </div>
                  ) : null}
                  {props.ethnicity?.trim() ? (
                    <div className="flex flex-col gap-0.5 rounded-xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-white/35">Heritage</dt>
                      <dd className="text-white/80">{props.ethnicity.trim()}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            )}

            {props.highlightBlocks.length > 0 || props.idealClientParagraph ? (
              <section className="mt-10 border-t border-white/[0.06] pt-8">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Coach Information</h2>
                <p className="mt-2 text-xs text-white/45">From their Match Fit questionnaire—so you know what to expect.</p>
                {props.idealClientParagraph ? (
                  <p className="mt-5 text-sm leading-relaxed text-white/82">{props.idealClientParagraph}</p>
                ) : null}
                {props.highlightBlocks.length > 0 ? (
                  <p
                    className={
                      props.idealClientParagraph
                        ? "mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#FF7E00]"
                        : "mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-[#FF7E00]"
                    }
                  >
                    COACH PREFERENCES
                  </p>
                ) : null}
                {props.highlightBlocks.length > 0 ? (
                  <div className="mt-3">
                    <TrainerMatchAnswersPreview blocks={props.highlightBlocks} variant="public" />
                  </div>
                ) : null}
              </section>
            ) : null}

            {socialLinksOrdered.length > 0 ? (
              <section className="mt-10 border-t border-white/[0.06] pt-6" aria-label="Social media links">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Social Links
                </p>
                <p className="mt-2 text-center text-xs text-white/40">Tap a platform to open it in a new tab.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
                  {socialLinksOrdered.map((s, i) => (
                    <a
                      key={`${s.platform}-${i}-${s.url}`}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-white/55 underline-offset-2 transition hover:text-[#FF7E00] hover:underline"
                    >
                      {s.platform === "other" ? null : (
                        <TrainerSocialBrandIcon
                          platform={s.platform as Exclude<typeof s.platform, "other">}
                          className="h-4 w-4"
                        />
                      )}
                      <span>{s.label}</span>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            <footer className="mt-10 border-t border-white/[0.06] pt-6 text-center">
              <p className="text-[11px] leading-relaxed text-white/45">
                All Match Fit coaches are background-checked and vetted before their profile is shown to you. Sessions
                and logistics are coordinated in app for your safety.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
