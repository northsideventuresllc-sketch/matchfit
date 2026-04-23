import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientPortalHeader } from "@/components/client/client-portal-header";
import { AccountLogoutButton } from "./logout-button";
import { prisma } from "@/lib/prisma";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

export default async function ClientAccountPage() {
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect("/client");
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      preferredName: true,
      email: true,
      profileImageUrl: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
    },
  });
  if (!client) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-lg">
        <ClientPortalHeader preferredName={client.preferredName} profileImageUrl={client.profileImageUrl} />

        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-2 text-lg font-semibold text-white/85">Welcome back, {client.preferredName}</p>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Signed in as <span className="text-white/80">{client.email}</span>
        </p>
        <p className="mt-2 text-sm text-white/45">
          Two-factor authentication:{" "}
          <span className="font-semibold text-white/70">
            {client.twoFactorEnabled ? `On (${client.twoFactorMethod})` : "Off"}
          </span>
          . Use Account Settings to change your password, session length, or 2FA.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/client/settings"
            className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
          >
            Account Settings
          </Link>
          <div className="flex-1">
            <AccountLogoutButton />
          </div>
        </div>

        <p className="mt-10 text-sm">
          <Link href="/" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
