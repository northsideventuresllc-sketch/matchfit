import { redirect } from "next/navigation";
import { ClientSettingsPageClient } from "./client-settings-page-client";
import { prisma } from "@/lib/prisma";
import { staleClientSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionClientId } from "@/lib/session";

const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function nextUsernameChangeAt(changedAt: Date | null): string | null {
  if (!changedAt) return null;
  return new Date(changedAt.getTime() + USERNAME_COOLDOWN_MS).toISOString();
}

export default async function ClientSettingsPage() {
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect("/client");
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      twoFactorEnabled: true,
      twoFactorMethod: true,
      stayLoggedIn: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      bio: true,
      profileImageUrl: true,
      email: true,
      phone: true,
      username: true,
      usernameChangedAt: true,
      pendingEmail: true,
      pendingPhone: true,
      addressLine1: true,
      addressLine2: true,
      addressCity: true,
      addressState: true,
      addressPostal: true,
      addressCountry: true,
    },
  });
  if (!client) {
    redirect(staleClientSessionInvalidateRedirect("/client"));
  }

  const twoFactorChannels = await prisma.clientTwoFactorChannel.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      delivery: true,
      email: true,
      phone: true,
      verified: true,
      isDefaultLogin: true,
    },
  });

  const initialDefaultChannelId =
    twoFactorChannels.find((c) => c.isDefaultLogin)?.id ??
    twoFactorChannels.find((c) => c.verified)?.id ??
    null;

  const initialProfile = {
    firstName: client.firstName,
    lastName: client.lastName,
    preferredName: client.preferredName,
    bio: client.bio,
    profileImageUrl: client.profileImageUrl,
    email: client.email,
    phone: client.phone,
    username: client.username,
    usernameChangedAt: client.usernameChangedAt?.toISOString() ?? null,
    pendingEmail: client.pendingEmail,
    pendingPhone: client.pendingPhone,
    addressLine1: client.addressLine1,
    addressLine2: client.addressLine2,
    addressCity: client.addressCity,
    addressState: client.addressState,
    addressPostal: client.addressPostal,
    addressCountry: client.addressCountry,
    nextUsernameChangeAt: nextUsernameChangeAt(client.usernameChangedAt),
  };

  return (
    <ClientSettingsPageClient
      initialProfile={initialProfile}
      initialStayLoggedIn={client.stayLoggedIn}
      twoFactorEnabled={client.twoFactorEnabled}
      twoFactorMethod={client.twoFactorMethod}
      twoFactorChannels={twoFactorChannels}
      initialDefaultChannelId={initialDefaultChannelId}
      headerPreferredName={client.preferredName}
      headerProfileImageUrl={client.profileImageUrl}
    />
  );
}
