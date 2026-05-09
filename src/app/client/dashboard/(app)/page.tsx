import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientDashboardLogoutButton } from "@/components/client/client-dashboard-logout-button";
import { ClientDashboardQuickActions } from "@/components/client/client-dashboard-quick-actions";
import { ClientDashboardHomeSection } from "@/components/client/client-dashboard-home-section";
import { getFeaturedTrainersForHomepage } from "@/lib/featured-homepage-data";
import { clientZipToPrefix } from "@/lib/featured-region";
import {
  parseClientDashboardQuickLinkIdsJson,
  type ClientDashboardQuickLinkId,
} from "@/lib/client-dashboard-quick-links";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingColumnError, isPrismaUnknownModelFieldError } from "@/lib/prisma-missing-column";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";

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

  const QUICK_LINKS_JSON_COL = "dashboardQuickLinkIdsJson";
  let dashboardQuickLinkIds: ClientDashboardQuickLinkId[] = [];
  try {
    const row = await prisma.client.findUnique({
      where: { id: clientId },
      select: { dashboardQuickLinkIdsJson: true },
    });
    dashboardQuickLinkIds = parseClientDashboardQuickLinkIdsJson(row?.dashboardQuickLinkIdsJson ?? null);
  } catch (e) {
    if (!isPrismaMissingColumnError(e, QUICK_LINKS_JSON_COL) && !isPrismaUnknownModelFieldError(e, QUICK_LINKS_JSON_COL)) {
      throw e;
    }
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      preferredName: true,
      username: true,
      bio: true,
      zipCode: true,
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

  const zipPrefix = clientZipToPrefix(client.zipCode);
  const featuredCoaches = zipPrefix ? await getFeaturedTrainersForHomepage({ zipInput: client.zipCode }) : [];

  const recentMatchRows = await prisma.trainerClientConversation.findMany({
    where: { clientId, officialChatStartedAt: { not: null } },
    orderBy: { officialChatStartedAt: "desc" },
    take: 3,
    include: {
      trainer: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          profileImageUrl: true,
          profile: {
            select: {
              dashboardActivatedAt: true,
              hasSignedTOS: true,
              hasUploadedW9: true,
              backgroundCheckStatus: true,
              backgroundCheckClearedAt: true,
              onboardingTrackCpt: true,
              onboardingTrackNutrition: true,
              onboardingTrackSpecialist: true,
              certificationReviewStatus: true,
              nutritionistCertificationReviewStatus: true,
              specialistCertificationReviewStatus: true,
            },
          },
        },
      },
    },
  });
  const recentMatches = recentMatchRows.filter(
    (row) => row.trainer.profile && isTrainerComplianceComplete(row.trainer.profile),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">CLIENT HOME</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">WELCOME BACK</h1>
        <p className="text-lg font-semibold text-white/90">{displayName}</p>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Signed in as <span className="text-white/75">@{client.username}</span>
        </p>
      </header>

      <ClientDashboardHomeSection title="Quick Actions">
        <ClientDashboardQuickActions quickLinkIds={dashboardQuickLinkIds} />
      </ClientDashboardHomeSection>

      <ClientDashboardHomeSection
        title="Recent Matches"
        titleClassName="text-[#FF7E00]"
        subtitle="The three coaches you most recently opened an official chat with. Open a thread to pick up where you left off."
      >
        {recentMatches.length === 0 ? (
          <p className="text-center text-sm text-white/40">
            No official chats yet. Save a coach or reply to a nudge to open a conversation.
          </p>
        ) : (
          <ul className="mx-auto max-w-xl space-y-3">
            {recentMatches.map((row) => {
              const t = row.trainer;
              const name = coachDisplayName(t);
              const chatHref = `/client/messages/${encodeURIComponent(t.username)}`;
              const profileHref = `/trainers/${encodeURIComponent(t.username)}`;
              return (
                <li key={row.id}>
                  <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3 transition hover:border-[#FF7E00]/35">
                    <Link
                      href={chatHref}
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#12151C]"
                    >
                      {t.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 text-left">
                      <Link href={chatHref} className="block truncate text-sm font-semibold text-white/90 hover:underline">
                        {name}
                      </Link>
                      <Link
                        href={profileHref}
                        className="mt-0.5 inline-block text-xs font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
                      >
                        @{t.username}
                      </Link>
                      <Link href={chatHref} className="mt-1 block text-xs text-white/40 hover:text-white/55">
                        Open Chat →
                      </Link>
                    </div>
                    <Link
                      href={chatHref}
                      className="shrink-0 text-white/35 hover:text-white/55"
                      aria-label={`Open chat with ${name}`}
                    >
                      →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ClientDashboardHomeSection>

      <ClientDashboardHomeSection title="Featured Coaches in Your Area">
        {!zipPrefix ? (
          <p className="text-center text-sm text-white/40">
            Add a valid U.S. ZIP code on your account so we can match you to a regional featured pool.
          </p>
        ) : featuredCoaches.length === 0 ? (
          <p className="text-center text-sm text-white/40">No featured coaches are scheduled for your region today.</p>
        ) : (
          <>
            <ul className="mx-auto max-w-xl space-y-3">
              {featuredCoaches.map((c) => {
                const profileHref = `/trainers/${encodeURIComponent(c.username)}`;
                return (
                  <li key={c.username}>
                    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3 transition hover:border-[#FF7E00]/35">
                      <Link
                        href={profileHref}
                        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#12151C]"
                      >
                        {c.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                            {c.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1 text-left">
                        <Link href={profileHref} className="block truncate text-sm font-semibold text-white/90 hover:underline">
                          {c.displayName}
                        </Link>
                        <Link
                          href={profileHref}
                          className="mt-0.5 inline-block text-xs font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
                        >
                          @{c.username}
                        </Link>
                        <Link href={profileHref} className="mt-1 block line-clamp-2 text-xs text-white/55 hover:text-white/70">
                          {c.specialtyLine}
                        </Link>
                      </div>
                      <span className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white/50">
                        {c.source === "PAID_BID" ? "Paid" : "Raffle"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-center text-xs text-white/40">
              <Link href="/client/dashboard/find-trainers" className="text-[#FF7E00] underline-offset-2 hover:underline">
                Browse all coaches
              </Link>
            </p>
          </>
        )}
      </ClientDashboardHomeSection>

      <ClientDashboardHomeSection
        title="Coach Nudges"
        titleClassName="text-[#FF7E00]"
        subtitle="Coaches who want to work with you can send you a nudge. Trainers who nudged you will appear here."
      >
        {nudges.length === 0 ? (
          <p className="text-center text-sm text-white/40">
            No nudges yet.{" "}
            <Link href="/client/dashboard/preferences" className="text-[#FF7E00] underline-offset-2 hover:underline">
              Update your Match Preferences
            </Link>{" "}
            and browse coaches to get discovered.
          </p>
        ) : (
          <ul className="mx-auto max-w-xl space-y-3">
            {nudges.map((n) => {
              const name = coachDisplayName(n.trainer);
              const chatHref = `/client/messages/${encodeURIComponent(n.trainer.username)}`;
              const profileHref = `/trainers/${encodeURIComponent(n.trainer.username)}`;
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <div
                    className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition ${
                      unread
                        ? "border-[#FF7E00]/35 bg-[#FF7E00]/10 hover:border-[#FF7E00]/50"
                        : "border-white/[0.06] bg-[#0E1016]/50 hover:border-white/15"
                    }`}
                  >
                    <Link
                      href={chatHref}
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#12151C]"
                    >
                      {n.trainer.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.trainer.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 text-left">
                      <Link href={chatHref} className="block truncate text-sm font-semibold text-white/90 hover:underline">
                        {name}
                      </Link>
                      <Link
                        href={profileHref}
                        className="mt-0.5 inline-block text-xs font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
                      >
                        @{n.trainer.username}
                      </Link>
                      <Link href={chatHref} className="mt-1 block">
                        {n.message ? (
                          <p className="line-clamp-2 text-xs text-white/55 hover:text-white/70">{n.message}</p>
                        ) : (
                          <p className="text-xs text-white/40 hover:text-white/55">Thought you might be a great fit.</p>
                        )}
                      </Link>
                    </div>
                    <Link
                      href={chatHref}
                      className="shrink-0 text-white/35 hover:text-white/55"
                      aria-label={`Open chat with ${name}`}
                    >
                      →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ClientDashboardHomeSection>

      <ClientDashboardHomeSection title="Your Bio">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4 text-left">
          <p className="text-sm font-medium leading-relaxed text-white/85">{client.bio?.trim() ? client.bio : "—"}</p>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-white/45">
          Edit your story in{" "}
          <Link href="/client/settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Account Settings
          </Link>{" "}
          under Profile. Trainers only see what you place on your public client page.
        </p>
      </ClientDashboardHomeSection>

      <ClientDashboardLogoutButton />
    </div>
  );
}
