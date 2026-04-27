import type { Metadata } from "next";
import Link from "next/link";
import { ClientNotificationsCenterClient } from "@/components/client/client-notifications-center-client";

export const metadata: Metadata = {
  title: "Notifications Center | Client | Match Fit",
};

export default function ClientNotificationsCenterPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Inbox</p>
        <h1 className="text-3xl font-black tracking-[0.04em] text-white sm:text-4xl">Notifications Center</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Every alert stays here until you delete it from view. Use the check to mark items read or unread.
        </p>
        <p className="text-xs text-white/40">
          <Link href="/client/dashboard/notification-settings" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Notification settings
          </Link>
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <ClientNotificationsCenterClient />
      </section>
    </div>
  );
}
