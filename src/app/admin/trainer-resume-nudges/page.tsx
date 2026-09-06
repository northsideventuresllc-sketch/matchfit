import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionAdminId } from "@/lib/session";
import { TrainerResumeNudgesClient } from "./trainer-resume-nudges-client";

export default async function AdminTrainerResumeNudgesPage() {
  const adminId = await getSessionAdminId();
  if (!adminId) redirect("/admin/login");

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0B0C0F] px-5 py-16 text-white">Loading…</div>}>
      <TrainerResumeNudgesClient />
    </Suspense>
  );
}
