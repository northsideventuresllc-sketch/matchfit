import Link from "next/link";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { ClientTrainerChatThreadClient } from "@/components/client/client-trainer-chat-thread-client";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";

type Props = { params: Promise<{ username: string }> };

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

export default async function ClientTrainerMessagesPage({ params }: Props) {
  const { username } = await params;
  const handle = decodeURIComponent(username);

  const trainer = await prisma.trainer.findUnique({
    where: { username: handle },
    select: {
      id: true,
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
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          onboardingTrackSpecialist: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
        },
      },
    },
  });

  if (!trainer?.profile) {
    notFound();
  }

  const published =
    trainer.profile.dashboardActivatedAt != null && isTrainerComplianceComplete(trainer.profile);
  if (!published) {
    notFound();
  }

  const clientId = await getSessionClientId();
  const thisPath = `/client/messages/${encodeURIComponent(trainer.username)}`;
  const nextParam = safeInternalNextPath(thisPath);

  if (!clientId) {
    const q = nextParam ? `?next=${encodeURIComponent(nextParam)}` : "";
    redirect(`/client${q}`);
  }

  if (await isTrainerClientChatBlocked(trainer.id, clientId)) {
    notFound();
  }

  await prisma.trainerClientNudge.updateMany({
    where: { clientId, trainerId: trainer.id },
    data: { readAt: new Date() },
  });

  const name = coachDisplayName(trainer);
  const avatar = trainer.profileImageUrl?.split("?")[0];
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const trainerProfileHref = `/trainers/${encodeURIComponent(trainer.username)}`;

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-lg">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            href="/client/dashboard/messages"
            className="text-xs font-bold uppercase tracking-[0.14em] text-white/40 transition hover:text-white/65"
          >
            ← All chats
          </Link>
          <Link
            href={trainerProfileHref}
            className="text-xs font-bold uppercase tracking-[0.14em] text-[#FF7E00] underline-offset-2 transition hover:underline"
          >
            View full coach profile
          </Link>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-center">
          <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row">
            <Link
              href={trainerProfileHref}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-[#12151C] transition hover:border-[#FF7E00]/40"
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- local upload path
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-black text-white/40">
                  {initial}
                </span>
              )}
            </Link>
            <div className="min-w-0 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]/90">Messages</p>
              <h1 className="truncate text-xl font-black tracking-tight">{name}</h1>
              <Link
                href={trainerProfileHref}
                className="mt-0.5 inline-block truncate text-sm font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
              >
                @{trainer.username}
              </Link>
            </div>
          </div>
          <Link
            href={trainerProfileHref}
            className="group relative isolate flex min-h-[2.75rem] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl px-4 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_16px_40px_-14px_rgba(227,43,43,0.4)] transition sm:w-auto sm:min-w-[12rem]"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
            />
            <span className="relative">Open public profile</span>
          </Link>
        </div>

        <div className="mt-10 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          <Suspense fallback={<p className="text-sm text-white/45">Loading chat…</p>}>
            <ClientTrainerChatThreadClient trainerUsername={trainer.username} />
          </Suspense>
        </div>

        <div className="mt-8 flex flex-col gap-3 text-center sm:flex-row sm:justify-center">
          <Link
            href="/client/dashboard"
            className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
          >
            Client dashboard
          </Link>
          <Link
            href="/client/dashboard/messages"
            className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
          >
            All chats
          </Link>
        </div>

        <p className="mt-10 text-center">
          <Link href="/" className="text-sm text-white/45 underline-offset-2 transition hover:text-white/70 hover:underline">
            Match Fit Home
          </Link>
        </p>
      </div>
    </main>
  );
}
