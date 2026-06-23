import Link from "next/link";
import type { ReactNode } from "react";
import {
  HomeAudienceGroupHeader,
  HomeCollapsibleSection,
} from "@/components/home-collapsible-section";
import { HomeCtaLogoutBar } from "@/components/home-cta-logout-bar";
import { HomeBetaSlotWarning } from "@/components/home-beta-slot-warning";
import { HomeFitProTypesSection } from "@/components/home-fit-pro-types-section";
import { HomeFitProDebriefSection } from "@/components/home-fit-pro-debrief-section";
import { HomeTrainerServiceTypesSection } from "@/components/home-trainer-service-types-section";
import { HomeClientPricingSection } from "@/components/home-client-pricing-section";
import { MatchFitSocialLinks } from "@/components/match-fit-social-links";
import { clientVipPriceLabel } from "@/lib/client-plan-copy";
import {
  FP_ELITE_PRO_DEBRIEF,
  FP_INDEPENDENT_PRO_DEBRIEF,
  FP_MATCH_FIT_PRO_DEBRIEF,
} from "@/lib/fp-tier-debrief-copy";
import { FP_SERVICE_CATALOGUE_DISCLAIMER } from "@/lib/fp-tier-marketing-copy";
import {
  CLIENT_SIGN_UP_PATH,
  TRAINER_SIGN_UP_PATH,
  type HomePageAuth,
} from "@/lib/home-page-auth";

function ServiceCard({
  title,
  gradientBar,
  children,
}: {
  title: string;
  gradientBar: string;
  children: ReactNode;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0E1016]/90 p-6 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.75)] transition-colors duration-300 hover:border-[#FF7E00]/25 sm:p-7">
      <div className={`h-1 w-14 shrink-0 rounded-full bg-gradient-to-r ${gradientBar}`} />
      <h4 className="mt-5 text-lg font-bold uppercase tracking-wide text-white">{title}</h4>
      <div className="mt-3 flex-1 space-y-3 text-sm leading-relaxed text-white/60 sm:text-[15px]">
        {children}
      </div>
    </article>
  );
}

export function HomeInfoSections({ homeAuth }: { homeAuth: HomePageAuth }) {
  const loggedIn = homeAuth.clientLoggedIn || homeAuth.trainerLoggedIn;

  return (
    <div className="mt-20 space-y-8 sm:mt-24 sm:space-y-10">
      <HomeCollapsibleSection
        id="what-is-match-fit"
        eyebrow="The platform"
        eyebrowClass="text-[#FF7E00]"
        title="What Match Fit is—and why it exists"
        accent="left"
        defaultOpen
      >
        <p>
          Match Fit connects serious clients with serious coaches—without expensive gym memberships you never
          asked for, referrals that fizzle out, or digging through social DMs hoping someone replies.
        </p>
        <p>
          You get one place to explore personalities, specialties, and coaching styles that feel like{" "}
          <span className="italic text-white/80">you</span>, then move forward with clarity.
        </p>
        <ul className="list-none space-y-3 border-t border-white/[0.08] pt-4">
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FFD34E,#FF7E00)]"
              aria-hidden
            />
            <span>
              <span className="font-semibold text-white/85">Choose Free or VIP client plans.</span> Start on the Free
              plan or upgrade to VIP for{" "}
              <span className="font-bold text-[#FFD34E]">{clientVipPriceLabel()}/month</span> for full discovery, chat,
              booking, and FitHub.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FF7E00,#E32B2B)]"
              aria-hidden
            />
            <span>
              <span className="font-semibold text-white/85">Fitness pros set their own rates.</span> Each purchase
              includes a <span className="font-bold text-[#FF7E00]">20% service charge</span> plus applicable{" "}
              <span className="font-bold text-[#FF7E00]">transaction fees</span>, so pricing stays transparent
              and coaches stay in control of their brand.
            </span>
          </li>
        </ul>
      </HomeCollapsibleSection>

      <div className="space-y-6 sm:space-y-8">
        <HomeAudienceGroupHeader
          id="for-clients-section"
          eyebrow="For clients"
          eyebrowClass="text-[#E32B2B]"
          title="Find your coach, your way"
          description="Everything below is written for people looking for the right coach—discovery, session types, matching, and FitHub."
        />

        <HomeCollapsibleSection
          id="discover-trainers"
          eyebrow="Discovery"
          eyebrowClass="text-[#FFD34E]"
          title='The "Tinder" of the personal training industry'
          accent="right"
        >
          <p>
            Match Fit borrows the clarity of modern dating apps and applies it to coaching: clients{" "}
            <span className="font-semibold text-white/85">swipe right on coaches they want to work with</span> and{" "}
            <span className="font-semibold text-white/85">swipe left</span> on coaches who are not the right fit—fast,
            human, and honest.
          </p>
          <p>
            Refine what you see with filters for <span className="font-semibold text-white/85">distance</span>,{" "}
            <span className="font-semibold text-white/85">specialties</span>,{" "}
            <span className="font-semibold text-white/85">algorithmic influence</span>,{" "}
            <span className="font-semibold text-white/85">interests</span>,{" "}
            <span className="font-semibold text-white/85">demographics</span>, and more—then scroll a living list of
            coaches who still match after every tweak.
          </p>
          <p>
            When <span className="font-semibold text-white/85">new fitness pros join</span>, they are added to your
            swipe stack and scroll list so the marketplace stays fresh. Want a heads-up?{" "}
            <span className="font-semibold text-white/85">Turn on notifications</span> when a new coach becomes
            available—you control how often we nudge you.
          </p>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="services"
          eyebrow="How it works"
          eyebrowClass="text-[#FFD34E]"
          title="Training on your terms"
          accent="left"
        >
          <p className="text-center text-sm text-white/55 sm:text-base">
            Every relationship on Match Fit is different—choose how you move, how you meet, and how often you
            check in. Here are the main ways coaches show up for you.
          </p>
          <div className="grid gap-5 pt-2 lg:grid-cols-2">
            <ServiceCard title="Mobile & in-person" gradientBar="from-[#FFD34E] via-[#FF7E00] to-[#E32B2B]">
              <p>
                Your coach can meet you where you choose—home, office, park, or another spot that fits your day.
                Sessions flex around real life, not the other way around.
              </p>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45 sm:text-[13px]">
                <span className="font-semibold text-[#FF7E00]/90">Note:</span> If you train at a gym that requires a
                membership or guest pass, those details are between you and your coach. Match Fit does not
                coordinate or guarantee facility access.
              </p>
            </ServiceCard>

            <ServiceCard title="Virtual sessions" gradientBar="from-[#FF7E00] to-[#E32B2B]">
              <p>
                For virtual coaching, your coach shares a{" "}
                <span className="font-semibold text-white/75">Zoom</span>,{" "}
                <span className="font-semibold text-white/75">Microsoft Teams</span>, or{" "}
                <span className="font-semibold text-white/75">Google Meet</span> link in app chat so you can join
                the session and train together from wherever you are.
              </p>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45 sm:text-[13px]">
                <span className="font-semibold text-[#FF7E00]/90">Important:</span> Clients cannot send{" "}
                <span className="font-semibold text-white/60">FaceTime</span> requests or meeting invites that rely on
                personal <span className="font-semibold text-white/60">phone numbers</span> or{" "}
                <span className="font-semibold text-white/60">email addresses</span> outside Match Fit. Keep virtual
                sessions on the approved links shared in chat so everyone stays protected and on-platform.
              </p>
            </ServiceCard>

            <ServiceCard title="DIY workout programs" gradientBar="from-[#E32B2B] via-[#FF7E00] to-[#FFD34E]">
              <p>
                Your coach writes workouts built for you—your equipment, injuries or limitations, and the pace you
                need—so you can train on your own time. Many coaches add scheduled touchpoints each month to adjust
                the plan and keep you accountable.
              </p>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45 sm:text-[13px]">
                <span className="font-semibold text-[#FF7E00]/90">Disclaimer:</span> You are responsible for giving your
                coach accurate and complete information needed to build a safe, effective DIY program. Pricing is set by
                each coach and will vary based on the scope of work and the monthly workload required to create, update,
                and support your plan.
              </p>
            </ServiceCard>

            <ServiceCard title="Nutrition plans" gradientBar="from-[#FFD34E] to-[#FF7E00]">
              <p>
                Work with a nutrition professional on a steady cadence to support eating habits, fueling for your
                goals, and changes that fit your life—not generic meal templates copied from someone else&apos;s
                program.
              </p>
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45 sm:text-[13px]">
                <span className="font-semibold text-[#FF7E00]/90">Disclaimer:</span> Only{" "}
                <span className="font-semibold text-white/60">certified nutritionists</span> may offer nutrition plans
                and related coaching services on Match Fit.
              </p>
            </ServiceCard>
          </div>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="smarter-matching"
          eyebrow="Smarter pairing"
          eyebrowClass="text-[#E32B2B]"
          title="Matching that goes deeper than a questionnaire"
          accent="right"
        >
          <p>
            Match Fit uses structured signals and algorithmic ranking to suggest coaches who fit more than a checklist
            of goals. Your profile, how you use the app, and patterns in chat help surface tendencies—communication
            style, consistency, what motivates you—so recommendations feel personal, not random.
          </p>
          <p>
            If you allow it, signals from activity on your mobile device can refine suggestions over time—always
            optional, always disclosed, and meant to support your individuality, not flatten it.
          </p>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="your-lane"
          eyebrow="Your lane"
          eyebrowClass="text-[#FFD34E]"
          title="Built for people who refuse a cookie-cutter fitness story"
          accent="left"
        >
          <p>
            Whether you are rebuilding after an injury, chasing a performance milestone, or finally putting
            yourself first between shifts and family life, Match Fit respects that your path is yours. Coaches
            bring their philosophies; you bring your reality—and the platform connects you, it does not dictate
            your story.
          </p>
          <p>
            You keep agency over where you train, how you communicate, and who earns your trust. That mutual
            respect between client and coach is the point.
          </p>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="fithub-clients"
          eyebrow="FitHub"
          eyebrowClass="text-[#FFD34E]"
          title="Scroll coach posts before you book"
          accent="left"
        >
          <p>
            <span className="font-semibold text-white/88">FitHub</span> is your in-app feed of posts from
            coaches on Match Fit—quick tips, workouts, mindset checks, and moments from their coaching life
            in <span className="font-semibold text-white/80">text, photos, or video</span>. Scroll to see who
            resonates with you, then like, comment, or repost when something clicks. It is a low-pressure way
            to learn how coaches think and train before you ever book a session.
          </p>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="for-clients"
          eyebrow="Get started"
          eyebrowClass="text-[#E32B2B]"
          title="Your match. Your pace."
          accent="left"
        >
          <p>
            Compare coaching styles, book sessions that fit your week, and grow with someone who gets how you
            operate—not a one-size program shipped to thousands.
          </p>
          <p>
            Start on the Free plan when you are ready, or upgrade to VIP when you want unlimited discovery and
            messaging.
          </p>
        </HomeCollapsibleSection>

        <HomeClientPricingSection loggedIn={loggedIn} />
      </div>

      <div className="space-y-6 sm:space-y-8">
        <HomeAudienceGroupHeader
          id="for-trainers-section"
          eyebrow="For fitness pros"
          eyebrowClass="text-[#FF7E00]"
          title="Grow your brand on Match Fit"
          description="Everything below is written for coaches—account types, client interest, services you can list, and FitHub publishing."
        />

        <HomeCollapsibleSection
          id="types-of-fit-pros"
          eyebrow="Account types"
          eyebrowClass="text-[#FFD34E]"
          title="Types of Fit Pros"
          accent="left"
          defaultOpen
        >
          <HomeFitProTypesSection />
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="interest-clients"
          eyebrow="Client interest"
          eyebrowClass="text-[#E32B2B]"
          title="When a client swipes right, that is a green light"
          accent="left"
        >
          <p>
            A <span className="font-semibold text-white/85">swipe right</span> is not idle browsing—it means a
            client wants to work with you. That intent lands in your workflow so you can follow up with
            confidence instead of guessing who is serious.
          </p>
          <p>
            Those clients appear on your <span className="font-semibold text-white/85">Interest clients</span> page
            in your dashboard. From there you can approach them, open a conversation, and review{" "}
            <span className="font-semibold text-white/85">basic information about their goals</span> before you
            book a session—so your first message is informed, not generic.
          </p>
        </HomeCollapsibleSection>

        <details
          id="trainer-service-types"
          className="group scroll-mt-28 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 shadow-[0_34px_90px_-50px_rgba(227,43,43,0.45)] backdrop-blur-xl"
        >
          <summary className="flex w-full cursor-pointer list-none items-start gap-3 p-7 text-left [-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7E00]/70 sm:p-9">
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] text-xs font-bold text-white/45 transition-transform duration-200 group-open:rotate-90"
              aria-hidden
            >
              ▸
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Service catalogue</p>
              <h3 className="mt-3 text-balance text-xl font-black uppercase leading-tight tracking-wide text-white sm:text-2xl md:text-[1.65rem]">
                Services you can list on Match Fit
              </h3>
              <p className="mt-3 text-sm text-white/50">Expand to browse every catalogue template and requirement.</p>
              <p className="mt-3 rounded-xl border border-[#FFD34E]/20 bg-[#FFD34E]/[0.06] p-3 text-xs leading-relaxed text-white/50 sm:text-[13px]">
                <span className="font-semibold text-[#FFD34E]/90">Disclaimer:</span> {FP_SERVICE_CATALOGUE_DISCLAIMER}
              </p>
            </div>
          </summary>
          <div className="border-t border-white/[0.08]">
            <HomeTrainerServiceTypesSection embedded />
          </div>
        </details>

        <HomeCollapsibleSection
          id={FP_MATCH_FIT_PRO_DEBRIEF.id}
          eyebrow={FP_MATCH_FIT_PRO_DEBRIEF.eyebrow}
          eyebrowClass="text-[#FF7E00]"
          title={FP_MATCH_FIT_PRO_DEBRIEF.title}
          accent="left"
        >
          <HomeFitProDebriefSection section={FP_MATCH_FIT_PRO_DEBRIEF} />
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id={FP_INDEPENDENT_PRO_DEBRIEF.id}
          eyebrow={FP_INDEPENDENT_PRO_DEBRIEF.eyebrow}
          eyebrowClass="text-[#FFD34E]"
          title={FP_INDEPENDENT_PRO_DEBRIEF.title}
          accent="right"
        >
          <HomeFitProDebriefSection section={FP_INDEPENDENT_PRO_DEBRIEF} />
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id={FP_ELITE_PRO_DEBRIEF.id}
          eyebrow={FP_ELITE_PRO_DEBRIEF.eyebrow}
          eyebrowClass="text-[#E32B2B]"
          title={FP_ELITE_PRO_DEBRIEF.title}
          accent="left"
        >
          <HomeFitProDebriefSection section={FP_ELITE_PRO_DEBRIEF} />
        </HomeCollapsibleSection>
      </div>

      <div className="space-y-6 sm:space-y-8">
        <HomeAudienceGroupHeader
          id="platform-details"
          eyebrow="Overview"
          eyebrowClass="text-[#FF7E00]"
          title="Platform details"
          description="Big-picture positioning, liability notice, and ways to stay connected."
        />

        <HomeCollapsibleSection
          id="why-revolutionary"
          eyebrow="Big picture"
          eyebrowClass="text-[#FF7E00]"
          title="Why Match Fit is a different kind of marketplace"
          accent="left"
        >
          <p>
            Most fitness marketplaces behave like static directories: filter once, read a wall of text, and hope
            the chemistry lands. Match Fit combines{" "}
            <span className="font-semibold text-white/85">swipe-first discovery</span>,{" "}
            <span className="font-semibold text-white/85">transparent economics</span> for both sides,{" "}
            <span className="font-semibold text-white/85">algorithmic matching</span> that learns how you actually
            behave, and <span className="font-semibold text-white/85">tiered tools for Fitness Pros</span> who want
            chat, nudges, or premium visibility on their terms.
          </p>
          <p>
            Clients get momentum instead of paralysis; fitness pros get qualified intent instead of cold DMs. DIY
            plans, nutrition support, mobile sessions, virtual rooms, and swipe-based interest live in one
            ecosystem built for the individualized relationship training was always meant to be.
          </p>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="liability-notice"
          eyebrow="Liability notice"
          eyebrowClass="text-[#FFD34E]"
          title="General liability and platform responsibility statement"
          accent="right"
        >
          <p>
            Match Fit maintains business insurance, including general liability coverage, to support platform
            operations and promote a safer environment for clients and fitness pros.
          </p>
          <p>
            Match Fit is a technology marketplace that connects independent fitness pros and clients. Coaches are
            responsible for their own professional services, credentials, programming decisions, and in-session
            conduct. Clients are responsible for providing accurate health and training information, following
            professional guidance appropriately, and obtaining any required medical clearance before participating
            in fitness activities.
          </p>
          <p>
            By using Match Fit, users acknowledge that fitness and nutrition activities carry inherent risks. To
            the fullest extent permitted by law, Match Fit disclaims liability for injuries, losses, or damages
            arising from coach-client services, third-party facilities, or off-platform interactions. This
            statement is a general informational notice and does not replace the full Terms of Service.
          </p>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          id="follow-match-fit"
          eyebrow="Stay connected"
          eyebrowClass="text-[#FFD34E]"
          title="Follow Match Fit for launch updates and community wins"
          accent="left"
        >
          <p className="mx-auto max-w-2xl text-center">
            We share real progress, coach spotlights, and launch news on our official channels — so you always know Match
            Fit is active, responsive, and building with you.
          </p>
          <MatchFitSocialLinks variant="footer" className="mx-auto mt-4 max-w-md" />
        </HomeCollapsibleSection>
      </div>

      {loggedIn ? (
        <div id="cta" className="mx-auto w-full max-w-xl">
          <HomeCtaLogoutBar />
        </div>
      ) : (
        <div id="cta" className="mx-auto w-full max-w-xl space-y-4">
          <HomeBetaSlotWarning />
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href={CLIENT_SIGN_UP_PATH}
              title="Client sign up"
              className="group relative isolate flex min-h-[3.75rem] flex-1 items-center justify-center overflow-hidden rounded-2xl px-6 text-center text-base font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_24px_60px_-18px_rgba(227,43,43,0.55)] transition duration-200 active:translate-y-px sm:min-h-[4rem] sm:flex-none sm:min-w-[220px] sm:text-[0.95rem]"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
              />
              <span
                aria-hidden
                className="absolute inset-px rounded-[0.9rem] bg-white/10 opacity-0 transition group-hover:opacity-100"
              />
              <span className="relative">Find My Match</span>
            </Link>

            <Link
              href={TRAINER_SIGN_UP_PATH}
              title="Fitness Pro sign up"
              className="group relative flex min-h-[3.75rem] flex-1 items-center justify-center overflow-hidden rounded-2xl px-6 text-center text-base font-black uppercase tracking-[0.08em] text-white shadow-[0_20px_60px_-22px_rgba(0,0,0,0.9)] transition duration-200 active:translate-y-px sm:min-h-[4rem] sm:flex-none sm:min-w-[240px] sm:text-[0.95rem]"
            >
              <span aria-hidden className="absolute inset-0 rounded-2xl bg-[#12151C]" />
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(255,211,78,0.35),rgba(255,126,0,0.2),rgba(227,43,43,0.35))] opacity-70 blur-xl transition group-hover:opacity-100"
              />
              <span className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,#FFD34E,#FF7E00,#E32B2B)] p-[1.5px]">
                <span className="flex h-full w-full items-center justify-center rounded-[0.925rem] bg-[#0E1016] px-2">
                  Build My Fitness Brand
                </span>
              </span>
            </Link>
          </div>
        </div>
      )}

      <MatchFitSocialLinks variant="footer" className="mx-auto w-full max-w-3xl pt-2" />

      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5 pt-4 sm:gap-2">
        <Link
          href="/promos"
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-[#FF7E00]/30 bg-[#FF7E00]/[0.07] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#FF7E00]/90 transition hover:border-[#FF7E00]/55 hover:text-[#FFD34E]"
        >
          Current Promos
        </Link>
        <Link
          href="/#what-is-match-fit"
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
        >
          Pricing
        </Link>
        <Link
          href="/privacy"
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
        >
          Terms Of Service
        </Link>
        <Link
          href="/share-idea"
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
        >
          Share An Idea
        </Link>
        <Link
          href="/report-bug"
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
        >
          Report A Bug
        </Link>
      </div>
    </div>
  );
}
