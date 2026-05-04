import { TrainerVideoMeetingsClient } from "@/components/trainer/trainer-video-meetings-client";
import { Suspense } from "react";

export default function TrainerVideoMeetingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Virtual Meetings</h1>
        <p className="mt-2 text-sm text-white/55">
          Link Zoom, Google Meet, or Microsoft Teams once, then attach or auto-generate conference links on paid-client virtual
          bookings. OAuth secrets stay server-side; refresh tokens are encrypted at rest.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-white/45">Loading…</p>}>
        <TrainerVideoMeetingsClient />
      </Suspense>
    </div>
  );
}
