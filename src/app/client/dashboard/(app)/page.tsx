import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientDashboardLogoutButton } from "@/components/client/client-dashboard-logout-button";
import { ClientDashboardQuickActions } from "@/components/client/client-dashboard-quick-actions";
import { prisma } from "@/lib/prisma";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard | Client | Match Fit",
};

function coachDisplayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach"
  );
}

export default async function ClientDashboardHomePage() {
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect("/client");
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      preferredName: true,
      username: true,
      bio: true,
      trainerNudges: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          trainer: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              profileImageUrl: true,
            },
          },
        },
      },
    },
  });
  if (!client) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }

  const displayName = client.preferredName?.trim() || "there";
  const nudges = client.trainerNudges;

  return (
    <div className="space-y-8">
      <header className="space-y-1 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">CLIENT HOME</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">WELCOME BACK</h1>
        <p className="text-lg font-semibold text-white/90">{displayName}</p>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          SIGNED IN AS <span className="text-white/75">@{client.username}</span>
        </p>
      </header>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">QUICK ACTIONS</h2>
        <div className="mt-6">
          <ClientDashboardQuickActions />
        </div>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]">COACH NUDGES</h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-white/50">
          Coaches who want to work with you can send you a nudge. Trainers who nudged you will appear here.
        </p>
        {nudges.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/40">
            No nudges yet.{" "}
            <Link href="/client/dashboard/preferences" className="text-[#FF7E00] underline-offset-2 hover:underline">
              Update your match preferences
            </Link>{" "}
            and browse coaches to get discovered.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {nudges.map((n) => {
              const name = coachDisplayName(n.trainer);
              const href = `/client/messages/${encodeURIComponent(n.trainer.username)}`;
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition ${
                      unread
                        ? "border-[#FF7E00]/35 bg-[#FF7E00]/10 hover:border-[#FF7E00]/50"
                        : "border-white/[0.06] bg-[#0E1016]/50 hover:border-white/15"
                    }`}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#12151C]">
                      {n.trainer.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.trainer.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-white/90">{name}</p>
                      <p className="text-xs text-white/45">@{n.trainer.username}</p>
                      {n.message ? (
                        <p className="mt-1 line-clamp-2 text-xs text-white/55">{n.message}</p>
                      ) : (
                        <p className="mt-1 text-xs text-white/40">Thought you might be a great fit.</p>
                      )}
                    </div>
                    <span className="text-white/35" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">YOUR BIO</h2>
        <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4 text-left">
          <p className="text-sm font-medium leading-relaxed text-white/85">{client.bio?.trim() ? client.bio : "—"}</p>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-white/45">
          EDIT YOUR STORY IN{" "}
          <Link href="/client/settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            ACCOUNT SETTINGS
          </Link>{" "}
          UNDER PROFILE. TRAINERS ONLY SEE WHAT YOU PLACE ON YOUR PUBLIC CLIENT PAGE.
        </p>
      </section>

      <ClientDashboardLogoutButton />
    </div>
  );
}
