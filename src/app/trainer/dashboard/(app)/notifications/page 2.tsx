import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Notifications | Trainer | Match Fit",
};

export default async function TrainerNotificationsPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }

  const notifications = await prisma.trainerNotification.findMany({
    where: { trainerId },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      title: true,
      body: true,
      linkHref: true,
      readAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Account</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Notifications Center</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Review every trainer alert in one place.
        </p>
      </header>

      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        {notifications.length === 0 ? (
          <p className="text-center text-sm text-white/45">No notifications yet.</p>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border px-4 py-3 ${
                  n.readAt
                    ? "border-white/[0.06] bg-[#0E1016]/40"
                    : "border-[#FF7E00]/30 bg-[#FF7E00]/10"
                }`}
              >
                {n.linkHref ? (
                  <Link href={n.linkHref} className="block">
                    <p className="text-sm font-semibold text-white/90">{n.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">{n.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-white/35">
                      {n.createdAt.toLocaleString()}
                    </p>
                  </Link>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-white/90">{n.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">{n.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-white/35">{n.createdAt.toLocaleString()}</p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
