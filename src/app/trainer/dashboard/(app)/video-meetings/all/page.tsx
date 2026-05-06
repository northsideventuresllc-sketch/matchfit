import { TrainerVirtualMeetingsAllClient } from "@/components/trainer/trainer-virtual-meetings-all-client";
import { Suspense } from "react";

export default function TrainerVirtualMeetingsAllPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">All Virtual Meetings</h1>
        <p className="mt-2 text-sm text-white/55">Scroll through every virtual session on your account for this view.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-white/45">Loading…</p>}>
        <TrainerVirtualMeetingsAllClient />
      </Suspense>
    </div>
  );
}
