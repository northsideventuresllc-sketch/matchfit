import Link from "next/link";
import type { ReactNode } from "react";
import { HomeCtaLogoutBar } from "@/components/home-cta-logout-bar";
import {
  CLIENT_SIGN_UP_PATH,
  TRAINER_SIGN_UP_PATH,
  type HomePageAuth,
} from "@/lib/home-page-auth";

function SectionShell({
  id,
  eyebrow,
  eyebrowClass,
  title,
  children,
  accent = "left",
}: {
  id?: string;
  eyebrow: string;
  eyebrowClass: string;
  title: string;
  children: ReactNode;
  accent?: "left" | "right";
}) {
  return (
    <section
      id={id}
      className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/75 p-7 shadow-[0_34px_90px_-50px_rgba(227,43,43,0.45)] backdrop-blur-xl sm:p-9"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute ${accent === "left" ? "-left-24 -top-28" : "-right-20 -bottom-32"} h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,126,0,0.22),transparent_68%)]`}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-12 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(227,43,43,0.18),transparent_72%)]"
      />
      <div className="relative">
        <p className={`text-xs font-bold uppercase tracking-[0.22em] ${eyebrowClass}`}>{eyebrow}</p>
        <h2 className="mt-3 text-balance text-xl font-black uppercase leading-tight tracking-wide text-white sm:text-2xl md:text-[1.65rem]">
          {title}
        </h2>
        <div className="mt-6 space-y-4 text-pretty text-[15px] leading-relaxed text-white/65 sm:text-base">
          {children}
        </div>
      </div>
    </section>
  );
}

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
      <h3 className="mt-5 text-lg font-bold uppercase tracking-wide text-white">{title}</h3>
      <div className="mt-3 flex-1 space-y-3 text-sm leading-relaxed text-white/60 sm:text-[15px]">
        {children}
      </div>
    </article>
  );
}

export function HomeInfoSections({ homeAuth }: { homeAuth: HomePageAuth }) {
  const loggedIn = homeAuth.clientLoggedIn || homeAuth.trainerLoggedIn;

  return (
    <div className="mt-20 space-y-6 sm:mt-24 sm:space-y-8">
      {/* 1 — Value first: why the product exists + economics (retention: answer “why stay” early) */}
      <SectionShell
        id="what-is-match-fit"
        eyebrow="The platform"
        eyebrowClass="text-[#FF7E00]"
        title="What Match Fit is—and why it exists"
        accent="left"
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
              <span className="font-semibold text-white/85">Browse the full trainer directory</span> for{" "}
              <span className="font-bold text-[#FFD34E]">$5.00 per month</span>—explore profiles and find coaches
              who fit your goals before you book a session.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FF7E00,#E32B2B)]"
              aria-hidden
            />
            <span>
              <span className="font-semibold text-white/85">Trainers set their own rates.</span> Each purchase
              includes a <span className="font-bold text-[#FF7E00]">20% service charge</span> plus applicable{" "}
              <span className="font-bold text-[#FF7E00]">transaction fees</span>, so pricing stays transparent
              and coaches stay in control of their brand.
            </span>
          </li>
        </ul>
      </SectionShell>

      {/* 2 — Differentiated product story (retention: novelty + scannable story) */}
      <SectionShell
        id="discover-trainers"
        eyebrow="Discovery"
        eyebrowClass="text-[#FFD34E]"
        title='The "Tinder" of the personal training industry'
        accent="right"
      >
        <p>
          Match Fit borrows the clarity of modern dating apps and applies it to coaching: clients{" "}
          <span className="font-semibold text-white/85">swipe right on trainers they want to work with</span> and{" "}
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
          When <span className="font-semibold text-white/85">new trainers join</span>, they are added to your
          swipe stack and scroll list so the marketplace stays fresh. Want a heads-up?{" "}
          <span className="font-semibold text-white/85">Turn on notifications</span> when a new trainer becomes
          available—you control how often we nudge you.
        </p>
      </SectionShell>

      {/* 3 — Trainer-side loop right after client discovery (both audiences stay oriented) */}
      <SectionShell
        id="interest-clients"
        eyebrow="Trainers"
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
      </SectionShell>

      {/* 4 — Concrete modalities once motivation is established */}
      <div id="services" className="scroll-mt-28 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#FFD34E]">How it works</p>
        <h2 className="mx-auto mt-2 max-w-3xl text-balance text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          Training on{" "}
          <span className="bg-gradient-to-r from-[#FFD34E] via-[#FF7E00] to-[#E32B2B] bg-clip-text text-transparent">
            your terms
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-white/55 sm:text-base">
          Every relationship on Match Fit is different—choose how you move, how you meet, and how often you
          check in. Here are the main ways coaches show up for you.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ServiceCard title="Mobile & in-person" gradientBar="from-[#FFD34E] via-[#FF7E00] to-[#E32B2B]">
          <p>
            Your trainer can meet you where you choose—home, office, park, or another spot that fits your day.
            Sessions flex around real life, not the other way around.
          </p>
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45 sm:text-[13px]">
            <span className="font-semibold text-[#FF7E00]/90">Note:</span> If you train at a gym that requires a
            membership or guest pass, those details are between you and your trainer. Match Fit does not
            coordinate or guarantee facility access.
          </p>
        </ServiceCard>

        <ServiceCard title="Virtual sessions" gradientBar="from-[#FF7E00] to-[#E32B2B]">
          <p>
            For virtual coaching, your trainer shares a{" "}
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
            Your trainer writes workouts built for you—your equipment, injuries or limitations, and the pace you
            need—so you can train on your own time. Many coaches add scheduled touchpoints each month to adjust
            the plan and keep you accountable.
          </p>
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45 sm:text-[13px]">
            <span className="font-semibold text-[#FF7E00]/90">Disclaimer:</span> You are responsible for giving your
            trainer accurate and complete information needed to build a safe, effective DIY program. Pricing is set by
            each trainer and will vary based on the scope of work and the monthly workload required to create, update,
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

      <SectionShell
        id="fithub"
        eyebrow="FitHub"
        eyebrowClass="text-[#FFD34E]"
        title="Where clients scroll and trainers show up between sessions"
        accent="left"
      >
        <div className="grid gap-8 border-t border-white/[0.08] pt-2 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E32B2B]">For clients</p>
            <p className="mt-3">
              <span className="font-semibold text-white/88">FitHub</span> is your in-app feed of posts from
              trainers on Match Fit—quick tips, workouts, mindset checks, and moments from their coaching life
              in <span className="font-semibold text-white/80">text, photos, or video</span>. Scroll to see who
              resonates with you, then like, comment, or repost when something clicks. It is a low-pressure way
              to learn how coaches think and train before you ever book a session.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]">For trainers</p>
            <p className="mt-3">
              <span className="font-semibold text-white/88">FitHub</span> is your publishing lane inside Match
              Fit: share short-form content from your dashboard so clients (and future clients) see your voice,
              expertise, and personality between appointments. Posts can carry{" "}
              <span className="font-semibold text-white/80">captions, write-ups, and media</span> that reinforce
              your brand, spark conversation through comments and engagement, and keep you visible without living
              on another social network.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* 5 — Trust / intelligence layer */}
      <SectionShell
        id="smarter-matching"
        eyebrow="Smarter pairing"
        eyebrowClass="text-[#E32B2B]"
        title="Matching that goes deeper than a questionnaire"
        accent="right"
      >
        <p>
          Match Fit uses algorithms and AI to suggest coaches who fit more than a checklist of goals. Your
          profile, how you use the app, and patterns in chat help surface tendencies—communication style,
          consistency, what motivates you—so recommendations feel personal, not random.
        </p>
        <p>
          If you allow it, signals from activity on your mobile device can refine suggestions over time—always
          optional, always disclosed, and meant to support your individuality, not flatten it.
        </p>
      </SectionShell>

      {/* 6 — Trainer monetization depth */}
      <SectionShell
        id="trainer-premium"
        eyebrow="For coaches"
        eyebrowClass="text-[#FF7E00]"
        title="Trainer premium—$20 per month"
        accent="right"
      >
        <p>
          Trainers can opt into{" "}
          <span className="font-bold text-[#FFD34E]">premium access at $20.00 per month</span> when they want the
          platform to work harder on visibility and workflow.
        </p>
        <ul className="list-none space-y-3 border-t border-white/[0.08] pt-4">
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FFD34E,#FF7E00)]"
              aria-hidden
            />
            <span>
              Eligibility to appear on the <span className="font-semibold text-white/85">featured trainers</span>{" "}
              surface so new clients discover you faster.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FF7E00,#E32B2B)]"
              aria-hidden
            />
            <span>
              <span className="font-semibold text-white/85">Upload content directly to your dashboard</span> so
              your brand and programming stay current without juggling extra tools.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#E32B2B,#FFD34E)]"
              aria-hidden
            />
            <span>
              <span className="font-semibold text-white/85">Stronger algorithmic surfacing</span> than
              non-premium profiles—your profile can reach the right clients more often when the system ranks
              matches.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#FFD34E,#E32B2B)]"
              aria-hidden
            />
            <span>
              <span className="font-semibold text-white/85">Unlimited approaches to clients</span> on the
              platform—no counting down a daily cap every 24 hours when you are ready to start real
              conversations.
            </span>
          </li>
        </ul>
      </SectionShell>

      {/* 7 — Emotional positioning */}
      <SectionShell
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
          Trainers keep their voice, pricing, and delivery model. Clients keep agency over where they train,
          how they communicate, and who earns their trust. That mutual respect is the point.
        </p>
      </SectionShell>

      {/* 8 — Summary before role split + CTA (recency effect before conversion) */}
      <SectionShell
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
          <span className="font-semibold text-white/85">AI-assisted matching</span> that learns how you actually
          behave, and <span className="font-semibold text-white/85">premium tools for coaches</span> who want to
          grow without burning out on outreach limits.
        </p>
        <p>
          Clients get momentum instead of paralysis; trainers get qualified intent instead of cold DMs. DIY
          plans, nutrition support, mobile sessions, virtual rooms, and swipe-based interest live in one
          ecosystem built for the individualized relationship training was always meant to be.
        </p>
      </SectionShell>

      <SectionShell
        id="liability-notice"
        eyebrow="Liability notice"
        eyebrowClass="text-[#FFD34E]"
        title="General liability and platform responsibility statement"
        accent="right"
      >
        <p>
          Match Fit maintains business insurance, including general liability coverage, to support platform
          operations and promote a safer environment for clients and trainers.
        </p>
        <p>
          Match Fit is a technology marketplace that connects independent trainers and clients. Trainers are
          responsible for their own professional services, credentials, programming decisions, and in-session
          conduct. Clients are responsible for providing accurate health and training information, following
          professional guidance appropriately, and obtaining any required medical clearance before participating
          in fitness activities.
        </p>
        <p>
          By using Match Fit, users acknowledge that fitness and nutrition activities carry inherent risks. To
          the fullest extent permitted by law, Match Fit disclaims liability for injuries, losses, or damages
          arising from trainer-client services, third-party facilities, or off-platform interactions. This
          statement is a general informational notice and does not replace the full Terms of Service.
        </p>
      </SectionShell>

      <div className="grid gap-5 lg:grid-cols-2">
        <article
          id="for-clients"
          className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#12151C]/80 p-7 shadow-[0_30px_80px_-40px_rgba(227,43,43,0.35)] backdrop-blur-xl sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -bottom-28 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(227,43,43,0.28),transparent_68%)]"
          />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-[#E32B2B]">For clients</p>
          <h2 className="relative mt-3 text-balance text-lg font-bold uppercase leading-snug tracking-wide text-white sm:text-xl">
            Your match. Your pace.
          </h2>
          <p className="relative mt-4 text-pretty text-[15px] leading-relaxed text-white/60 sm:text-base">
            Compare coaching styles, book sessions that fit your week, and grow with someone who gets how you
            operate—not a one-size program shipped to thousands.
          </p>
        </article>

        <article
          id="for-trainers"
          className="relative scroll-mt-28 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#12151C]/80 p-7 shadow-[0_30px_80px_-40px_rgba(255,126,0,0.25)] backdrop-blur-xl sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,126,0,0.35),transparent_65%)]"
          />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]">For trainers</p>
          <h2 className="relative mt-3 text-balance text-lg font-bold uppercase leading-snug tracking-wide text-white sm:text-xl">
            Your brand. Your business.
          </h2>
          <p className="relative mt-4 text-pretty text-[15px] leading-relaxed text-white/60 sm:text-base">
            Show how you coach, offer the modalities you believe in, and spend less energy on discovery
            logistics—so you can stay focused on the work that changes people.
          </p>
        </article>
      </div>

      {loggedIn ? (
        <div id="cta" className="mx-auto w-full max-w-xl">
          <HomeCtaLogoutBar />
        </div>
      ) : (
        <div
          id="cta"
          className="mx-auto flex w-full max-w-xl flex-col gap-4 sm:flex-row sm:justify-center"
        >
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
            title="Trainer sign up"
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
      )}

      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5 pt-1 sm:gap-2">
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
          href="/report-bug"
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:border-white/[0.22] hover:text-white/85"
        >
          Report A Bug
        </Link>
      </div>
    </div>
  );
}
