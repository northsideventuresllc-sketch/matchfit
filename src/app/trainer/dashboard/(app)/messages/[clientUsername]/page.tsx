import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TrainerClientChatThreadClient } from "@/components/trainer/trainer-client-chat-thread-client";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { isTrainerClientPairBlocked } from "@/lib/user-block-queries";

type Props = { params: Promise<{ clientUsername: string }> };

function displayClientName(c: { preferredName: string; firstName: string; lastName: string }): string {
  return c.preferredName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Client";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { clientUsername } = await params;
  const handle = decodeURIComponent(clientUsername).trim();
  const client = await prisma.client.findUnique({
    where: { username: handle },
    select: { preferredName: true, firstName: true, lastName: true },
  });
  const name = client ? displayClientName(client) : "Client";
  return { title: `${name} | Chats | Trainer | Match Fit` };
}

export default async function TrainerClientMessagesPage({ params }: Props) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const { clientUsername } = await params;
  const handle = decodeURIComponent(clientUsername).trim();
  const client = await prisma.client.findUnique({
    where: { username: handle },
    select: { id: true, preferredName: true, firstName: true, lastName: true },
  });
  if (!client) {
    notFound();
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { id: true },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }

  if (await isTrainerClientPairBlocked(trainerId, client.id)) {
    notFound();
  }

  const name = displayClientName(client);

  return (
    <div className="space-y-8">
      <p className="text-center">
        <Link
          href="/trainer/dashboard/messages"
          className="text-xs font-bold uppercase tracking-[0.14em] text-white/40 transition hover:text-white/65"
        >
          ← All chats
        </Link>
      </p>
      <header className="space-y-1 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]/90">Thread</p>
        <h1 className="text-2xl font-black uppercase tracking-[0.06em] sm:text-3xl">{name}</h1>
        <p className="text-sm text-white/45">@{handle}</p>
      </header>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <TrainerClientChatThreadClient clientUsername={handle} />
      </section>
    </div>
  );
}
