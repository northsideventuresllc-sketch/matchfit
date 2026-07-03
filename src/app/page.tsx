import Image from "next/image";
import Link from "next/link";
import { HomeMeetOurCoachesSection } from "@/components/home-meet-our-coaches-section";
import { FeaturedTrainersCarousel } from "@/components/featured-trainers-carousel";
import { HomeBetaPromoBanner } from "@/components/home-beta-promo-banner";
import { HomeBrandBanner } from "@/components/home-brand-banner";
import { HomeInfoSections } from "@/components/home-info-sections";
import { HomeLoginMenu } from "@/components/home-login-menu";
import { MatchFitSocialLinks } from "@/components/match-fit-social-links";
import {
  MatchFitBrandPageBackground,
  matchFitBrandPageMainClass,
} from "@/components/match-fit-brand-page-background";
import type { FeaturedTrainerCard } from "@/lib/featured-homepage-data";
import { getFeaturedTrainersForHomepage } from "@/lib/featured-homepage-data";
import { getMeetOurCoachesForHomepage } from "@/lib/home-meet-coaches-data";
import { MATCH_FIT_PRODUCT_VERSION_LABEL } from "@/lib/match-fit-product-version";
import { prisma } from "@/lib/prisma";
import { redirectStayLoggedInClientToDashboard } from "@/lib/redirect-stay-logged-in-client";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

type HomeProps = { searchParams?: Promise<{ zip?: string }> };

/** Always render fresh homepage copy/version from package.json (no ISR/CDN stale shell). */
export const revalidate = 0;

export default async function Home({ searchParams }: HomeProps) {
  // DATABASE_URL is required for all DB calls. Preview deployments may omit it;
  // skip DB-dependent work so the page still renders rather than returning 500.
  const hasDb = Boolean(process.env.DATABASE_URL);

  if (hasDb) await redirectStayLoggedInClientToDashboard();

  const sp = searchParams ? await searchParams : {};
  const zipFromQuery = typeof sp.zip === "string" && sp.zip.trim() ? sp.zip.trim() : null;

  const [clientId, trainerId] = await Promise.all([getSessionClientId(), getSessionTrainerId()]);
  const homeAuth = {
    clientLoggedIn: Boolean(clientId),
    trainerLoggedIn: Boolean(trainerId),
  };

  let featuredTrainers: FeaturedTrainerCard[] = [];
  let meetOurCoaches: Awaited<ReturnType<typeof getMeetOurCoachesForHomepage>> = [];

  if (hasDb) {
    let zipForFeatured = zipFromQuery;
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { zipCode: true },
      });
      if (client?.zipCode?.trim()) zipForFeatured = client.zipCode.trim();
    }

    [featuredTrainers, meetOurCoaches] = await Promise.all([
      getFeaturedTrainersForHomepage({ zipInput: zipForFeatured }),
      getMeetOurCoachesForHomepage(8),
    ]);
  }

  return (
    <main className={matchFitBrandPageMainClass}>
      <MatchFitBrandPageBackground />

      <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-6xl flex-col items-stretch px-4 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:px-10">
        <header className="flex w-full min-w-0 items-center justify-between gap-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl sm:h-16 sm:w-16">
              <Image
                src="/logo.png"
                alt="Match Fit"
                fill
                className="object-contain"
                priority
                sizes="64px"
              />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight sm:text-base">
                <span className="text-[#E8EAEF]">Match</span>{" "}
                <span className="text-[#E32B2B]">Fit</span>
              </p>
              <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#FF7E00]/80">
                Version {MATCH_FIT_PRODUCT_VERSION_LABEL}
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
            <MatchFitSocialLinks variant="compact" showLabel={false} className="hidden sm:block" />
            <HomeLoginMenu homeAuth={homeAuth} />
          </div>
        </header>

        <div className="mt-6 min-w-0 sm:mt-8">
          <HomeBetaPromoBanner />
        </div>

        <div className="mt-4">
          <Link
            href="/promos"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#FF7E00] transition hover:border-[#FF7E00]/55 hover:bg-[#FF7E00]/20"
          >
            Current Promos
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        <HomeBrandBanner />

        <section className="mt-14 flex flex-1 flex-col items-center text-center sm:mt-20 lg:mt-24">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-10 rounded-[2.5rem] bg-[conic-gradient(from_200deg_at_50%_50%,#FFD34E,#FF7E00,#E32B2B,#FF7E00,#FFD34E)] opacity-25 blur-3xl"
            />
            <div className="relative mx-auto flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#FFD34E]/25 via-[#FF7E00]/15 to-[#E32B2B]/20 blur-xl" />
              <div className="relative h-full w-full overflow-hidden rounded-[2rem] p-3 sm:p-4">
                <Image
                  src="/logo.png"
                  alt="Match Fit logo"
                  width={512}
                  height={512}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          <p className="mt-10 max-w-3xl text-balance font-black tracking-[-0.045em] text-[2.1rem] leading-[1.05] sm:text-5xl sm:leading-[1.02] lg:text-[3.35rem]">
            <span className="bg-gradient-to-r from-[#FFD34E] via-[#FF7E00] to-[#E32B2B] bg-clip-text text-transparent">
              The Perfect Match
            </span>{" "}
            <span className="text-[#F4F6FA]">for Your Fitness Journey.</span>
          </p>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
            The fitness matchmaking platform that connects clients with the right coaches—and gives fitness pros
            the tools to grow their brands and client base without the usual friction.
          </p>
          <p className="mt-4 text-sm text-white/40">
            <a
              href="#what-is-match-fit"
              className="font-semibold text-[#FF7E00] underline-offset-4 transition hover:text-[#FFD34E] hover:underline"
            >
              Learn how it works
            </a>{" "}
            or scroll to explore coaches, pricing, and session types.
          </p>
        </section>

        <FeaturedTrainersCarousel trainers={featuredTrainers} />

        <HomeMeetOurCoachesSection coaches={meetOurCoaches} />

        <HomeInfoSections homeAuth={homeAuth} />
      </div>
    </main>
  );
}
