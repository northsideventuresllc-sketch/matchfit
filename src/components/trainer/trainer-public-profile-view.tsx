import Link from "next/link";
import type { AiMatchProfileDisplayBlock } from "@/lib/ai-match-profile-parse";
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
  servicesRates: string[] | null;
  /** Human ideal-client copy; questionnaire “levels” are not shown verbatim. */
  idealClientParagraph: string | null;
  highlightBlocks: AiMatchProfileDisplayBlock[];
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
          <TrainerProfileCopyLinkButton
            url={props.fullProfileUrl}
            className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-white/75 transition hover:border-white/25 hover:text-white"
          />
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
              <Link
                href={props.messageHref}
                className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FF7E00_0%,#E32B2B_100%)] px-5 text-sm font-black uppercase tracking-[0.1em] text-white shadow-[0_16px_40px_-12px_rgba(255,126,0,0.55)] transition hover:brightness-110 sm:max-w-md"
              >
                Message coach
              </Link>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40 sm:text-left">
              Questions about packages or scheduling? Start a conversation—coaches reply here first.
            </p>

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

            {props.servicesRates && props.servicesRates.length > 0 ? (
              <section className="mt-10 border-t border-white/[0.06] pt-8">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#FF7E00]">Services &amp; rates</h2>
                <p className="mt-2 text-xs text-white/45">Transparent pricing—tap message if you want a custom bundle.</p>
                <ul className="mt-5 space-y-3">
                  {props.servicesRates.map((line, i) => (
                    <li
                      key={`${i}-${line.slice(0, 24)}`}
                      className="flex gap-3 rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,126,0,0.08)_0%,rgba(14,16,22,0.95)_42%)] px-4 py-3.5 text-sm leading-snug text-white/88"
                    >
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF7E00]/20 text-[11px] font-black text-[#FFD34E]">
                        {i + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link
                    href="/client/subscribe"
                    className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border border-[#FF7E00]/45 bg-[#FF7E00]/15 px-5 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:border-[#FF7E00]/60 hover:bg-[#FF7E00]/22"
                  >
                    CHECKOUT
                  </Link>
                  <p className="mt-3 text-center text-[10px] leading-relaxed italic text-white/38 sm:text-left">
                    Match Fit applies a 20% service charge on checkout to support the platform, coaches, and secure
                    payments. Card processing may include an additional transaction fee from the payment provider.
                  </p>
                </div>
              </section>
            ) : (
              <section className="mt-10 border-t border-white/[0.06] pt-8">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Services &amp; rates</h2>
                <p className="mt-3 text-sm text-white/55">
                  This coach hasn&apos;t listed packages here yet. Message them for session types and current rates.
                </p>
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
