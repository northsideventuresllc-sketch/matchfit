import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrainerClientNudgePanel } from "@/components/client/trainer-client-nudge-panel";
import { parseClientMatchPreferencesJson } from "@/lib/client-match-preferences";
import { parseClientOptionalProfileVisibility } from "@/lib/optional-profile-visibility";
import { prisma } from "@/lib/prisma";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username);
  const client = await prisma.client.findUnique({
    where: { username: handle },
    select: { preferredName: true, allowTrainerDiscovery: true },
  });
  if (!client || !client.allowTrainerDiscovery) {
    return { title: "Client | Match Fit" };
  }
  return {
    title: `${client.preferredName} (@${handle}) | Match Fit`,
    description: "Client profile on Match Fit.",
  };
}

export default async function ClientPublicProfilePage({ params }: Props) {
  const { username } = await params;
  const handle = decodeURIComponent(username);

  const client = await prisma.client.findUnique({
    where: { username: handle },
    select: {
      id: true,
      preferredName: true,
      username: true,
      bio: true,
      profileImageUrl: true,
      allowTrainerDiscovery: true,
      matchPreferencesCompletedAt: true,
      matchPreferencesJson: true,
      optionalProfileVisibilityJson: true,
      deidentifiedAt: true,
    },
  });

  if (!client || client.deidentifiedAt) {
    notFound();
  }

  const sessionClientId = await getSessionClientId();
  const sessionTrainerId = await getSessionTrainerId();
  const isOwner = sessionClientId === client.id;

  if (!client.allowTrainerDiscovery && !isOwner) {
    notFound();
  }

  const prefs = parseClientMatchPreferencesJson(client.matchPreferencesJson);
  const vis = parseClientOptionalProfileVisibility(client.optionalProfileVisibilityJson);
  const bioForDisplay =
    isOwner || vis.showBioOnPublicProfile ? (client.bio?.trim() ? client.bio.trim() : "—") : null;
  const showNudge = Boolean(sessionTrainerId) && !isOwner && client.allowTrainerDiscovery && client.matchPreferencesCompletedAt;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#07080C] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,126,0,0.12),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-lg space-y-8">
        <Link
          href={sessionTrainerId ? "/trainer/dashboard" : sessionClientId ? "/client/dashboard" : "/"}
          className="text-xs font-bold uppercase tracking-[0.14em] text-white/40 transition hover:text-white/65"
        >
          ← Back
        </Link>

        <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-white/10 bg-[#0E1016]">
              {client.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-black text-white/30">
                  {client.preferredName.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight">{client.preferredName}</h1>
            <p className="text-sm text-white/45">@{client.username}</p>
            {bioForDisplay !== null ? (
              <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75">{bioForDisplay}</p>
            ) : (
              <p className="mt-5 max-w-md text-center text-sm text-white/45">
                This member chose not to show a bio on their public page.
              </p>
            )}
            {isOwner && !vis.showBioOnPublicProfile ? (
              <p className="mt-2 text-center text-[11px] text-amber-200/70">
                You turned off your public bio—only you still see it while signed in.
              </p>
            ) : null}
          </div>

          {isOwner || vis.showMatchSnapshotOnPublicProfile ? (
            <div className="mt-8 border-t border-white/[0.08] pt-6">
              <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Match snapshot</h2>
              {isOwner && !vis.showMatchSnapshotOnPublicProfile ? (
                <p className="mt-3 text-center text-[11px] text-amber-200/75">
                  Hidden from visitors—you still see your snapshot while signed in.
                </p>
              ) : null}
              <dl className="mt-4 space-y-3 text-sm text-white/70">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Goals</dt>
                  <dd className="mt-1">{prefs.goals.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Services</dt>
                  <dd className="mt-1 capitalize">{prefs.serviceTypes.join(", ").replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">How they want to work</dt>
                  <dd className="mt-1 capitalize">{prefs.deliveryModes.join(", ").replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Niches</dt>
                  <dd className="mt-1">{prefs.fitnessNiches.trim() || "—"}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="mt-6 text-center text-xs text-white/40">Match preferences are hidden on this public page.</p>
          )}
        </div>

        {showNudge ? <TrainerClientNudgePanel clientUsername={client.username} /> : null}

        {!client.allowTrainerDiscovery && isOwner ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-100">
            Trainer discovery is off—only you can see this page right now. Turn it back on from Match preferences when
            you want coaches to find you.
          </p>
        ) : null}
      </div>
    </main>
  );
}
