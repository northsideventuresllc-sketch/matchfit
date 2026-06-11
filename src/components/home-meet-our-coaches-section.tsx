import Link from "next/link";
import type { MeetOurCoachCard } from "@/lib/home-meet-coaches-data";
import { TrainerVerificationBadgePill } from "@/components/trainer/trainer-verification-badge";

function coachInitial(firstName: string): string {
  const c = firstName.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

export function HomeMeetOurCoachesSection({ coaches }: { coaches: MeetOurCoachCard[] }) {
  if (!coaches.length) return null;

  return (
    <section className="mt-16 border-t border-white/[0.06] pt-14 sm:mt-20 sm:pt-16">
      <div className="text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#FF7E00]/80">The platform</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-[#F4F6FA] sm:text-3xl">Meet Our Coaches</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/55">
          Real Match Fit coaches building their profiles now — message them today; booking opens once verification is
          complete.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {coaches.map((coach) => (
          <li key={coach.username}>
            <Link
              href={coach.profileHref}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12151C]/90 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.85)] transition hover:border-[#FF7E00]/30"
            >
              <div className="relative aspect-[4/3] w-full bg-[#0E1016]">
                {coach.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coach.profileImageUrl.split("?")[0]}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white/25">
                    {coachInitial(coach.firstName)}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-white/90">{coach.firstName}</p>
                  <TrainerVerificationBadgePill badge={coach.verificationBadge} />
                </div>
                <p className="text-xs font-semibold text-[#FF7E00]/90">{coach.specialtyLine}</p>
                {coach.regionLabel ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    {coach.regionLabel}
                  </p>
                ) : null}
                <p className="mt-auto pt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FF7E00]/80 group-hover:text-[#FF7E00]">
                  View profile →
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 text-center">
        <Link
          href="/client/sign-up"
          className="inline-flex min-h-[3rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FF7E00_0%,#E32B2B_100%)] px-8 text-sm font-black uppercase tracking-[0.1em] text-white shadow-[0_16px_40px_-12px_rgba(255,126,0,0.45)] transition hover:brightness-110"
        >
          Find My Match
        </Link>
      </div>
    </section>
  );
}
