import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clientPublishedProfilePath } from "@/lib/client-public-profile-route";
import { parseClientMatchPreferencesJson } from "@/lib/client-match-preferences";
import { prisma } from "@/lib/prisma";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

export const metadata: Metadata = {
  title: "My profile | Client | Match Fit",
};

export default async function ClientDashboardProfilePreviewPage() {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/client");
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      preferredName: true,
      username: true,
      bio: true,
      profileImageUrl: true,
      matchPreferencesJson: true,
      allowTrainerDiscovery: true,
    },
  });
  if (!client) redirect(staleClientSessionInvalidateRedirect("/client"));

  const prefs = parseClientMatchPreferencesJson(client.matchPreferencesJson);
  const publicHref = clientPublishedProfilePath(client.username);

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Visibility</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Your profile</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          This is how you appear on your public page (minus private account data). Open the live link in a new tab to
          share with a coach.
        </p>
      </header>

      <div className="flex justify-center">
        <Link
          href={publicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[3rem] w-full max-w-md items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50"
        >
          Open public profile
        </Link>
      </div>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
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
          <h2 className="mt-5 text-xl font-black text-white">{client.preferredName}</h2>
          <p className="text-sm text-white/45">@{client.username}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/75">{client.bio?.trim() || "No bio yet."}</p>
          <p className="mt-4 text-xs text-white/40">
            Trainer discovery:{" "}
            <span className="font-semibold text-white/70">{client.allowTrainerDiscovery ? "On" : "Off"}</span>
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h3 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Goals snapshot</h3>
        <div className="mx-auto mt-4 max-w-lg space-y-3 text-sm text-white/70">
          <p>
            <span className="text-white/40">Goals: </span>
            {prefs.goals.trim() || "—"}
          </p>
          <p>
            <span className="text-white/40">Services: </span>
            {prefs.serviceTypes.join(", ").replaceAll("_", " ")}
          </p>
          <p>
            <span className="text-white/40">Delivery: </span>
            {prefs.deliveryModes.join(", ").replaceAll("_", " ")}
          </p>
          <p>
            <span className="text-white/40">Niches: </span>
            {prefs.fitnessNiches.trim() || "—"}
          </p>
        </div>
      </section>
    </div>
  );
}
