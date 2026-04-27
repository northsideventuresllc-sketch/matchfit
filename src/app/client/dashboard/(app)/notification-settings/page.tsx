import type { Metadata } from "next";
import { ClientNotificationSettingsForm } from "./client-notification-settings-form";

export const metadata: Metadata = {
  title: "Notification Settings | Client | Match Fit",
};

export default function ClientNotificationSettingsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Preferences</p>
        <h1 className="text-3xl font-black tracking-[0.04em] text-white sm:text-4xl">Notification Settings</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Choose which notification categories you want on push when the feature is enabled for your device.
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <ClientNotificationSettingsForm />
      </section>
    </div>
  );
}
