import Image from "next/image";
import { FeaturedTrainersCarousel } from "@/components/featured-trainers-carousel";
import { HomeBrandBanner } from "@/components/home-brand-banner";
import { HomeInfoSections } from "@/components/home-info-sections";
import { HomeLoginMenu } from "@/components/home-login-menu";
import { getFeaturedTrainersForHomepage } from "@/lib/featured-homepage-data";
import { prisma } from "@/lib/prisma";
import { redirectStayLoggedInClientToDashboard } from "@/lib/redirect-stay-logged-in-client";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

type HomeProps = { searchParams?: Promise<{ zip?: string }> };

export default async function Home({ searchParams }: HomeProps) {
  await redirectStayLoggedInClientToDashboard();

  const sp = searchParams ? await searchParams : {};
  const zipFromQuery = typeof sp.zip === "string" && sp.zip.trim() ? sp.zip.trim() : null;

  const [clientId, trainerId] = await Promise.all([getSessionClientId(), getSessionTrainerId()]);
  const homeAuth = {
    clientLoggedIn: Boolean(clientId),
    trainerLoggedIn: Boolean(trainerId),
  };

  let zipForFeatured = zipFromQuery;
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { zipCode: true },
    });
    if (client?.zipCode?.trim()) zipForFeatured = client.zipCode.trim();
  }

  const featuredTrainers = await getFeaturedTrainersForHomepage({ zipInput: zipForFeatured });

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.18),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.12),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.1),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(45,52,64,0.35)_0%,transparent_35%,transparent_70%,rgba(11,12,15,0.9)_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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
            </div>
          </div>
          <HomeLoginMenu homeAuth={homeAuth} />
        </header>

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
            The fitness matchmaking platform that connects clients with the right coaches—and gives trainers
            the tools to grow their brands and client base without the usual friction.
          </p>
          <p className="mt-4 text-sm text-white/40">
            <a
              href="#what-is-match-fit"
              className="font-semibold text-[#FF7E00] underline-offset-4 transition hover:text-[#FFD34E] hover:underline"
            >
              Learn how it works
            </a>{" "}
            or scroll to explore trainers, pricing, and session types.
          </p>
        </section>

        <FeaturedTrainersCarousel trainers={featuredTrainers} />

        <HomeInfoSections homeAuth={homeAuth} />
      </div>
    </main>
  );
}
