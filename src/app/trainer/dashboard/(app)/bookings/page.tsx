import { TrainerDashboardBookingsClient } from "@/components/trainer/trainer-dashboard-bookings-client";

export default function TrainerBookingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Bookings & availability</h1>
        <p className="mt-2 text-sm text-white/55">
          Set when you are generally available, review upcoming sessions, and send booking invites from client chats after
          they have paid on Match Fit.
        </p>
      </div>
      <TrainerDashboardBookingsClient />
    </div>
  );
}
