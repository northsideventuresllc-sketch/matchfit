import type { Metadata } from "next";
import { TrainerNotificationSettingsForm } from "./trainer-notification-settings-form";

export const metadata: Metadata = {
  title: "Notification settings | Trainer | Match Fit",
};

export default function TrainerNotificationSettingsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Account</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Notification settings</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Choose which coach-facing categories you want on push when the feature is enabled for your device.
        </p>
      </header>
      <TrainerNotificationSettingsForm />
    </div>
  );
}
