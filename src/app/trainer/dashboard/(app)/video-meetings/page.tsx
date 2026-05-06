import { TrainerVideoMeetingsClient } from "@/components/trainer/trainer-video-meetings-client";
import { Suspense } from "react";

export default function TrainerVideoMeetingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center scroll-mt-8 space-y-8">
      <div className="w-full text-center">
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Virtual Meetings</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/55">
          Link Zoom, Google Meet, or Microsoft Teams once, then attach or auto-generate conference links on paid-client virtual
          bookings. OAuth secrets stay server-side; refresh tokens are encrypted at rest.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="w-full max-w-3xl text-center text-sm text-white/45">Loading…</p>
        }
      >
        <TrainerVideoMeetingsClient />
      </Suspense>
    </div>
  );
}
