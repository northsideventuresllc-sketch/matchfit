import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainerBackgroundCheckPlanBPanel } from "@/components/trainer/trainer-background-check-plan-b-panel";
import { isBackgroundCheckPlanBActive } from "@/lib/checkr-integration";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { trainerHasSignupBackgroundEscrow } from "@/lib/trainer-background-check-ui";

export const dynamic = "force-dynamic";

export default async function TrainerBackgroundCheckRequestInvitePage() {
  if (!isBackgroundCheckPlanBActive()) {
    redirect("/trainer/onboarding");
  }

  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/login");
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      firstName: true,
      profile: {
        select: {
          backgroundCheckStatus: true,
          backgroundCheckInviteRequestedAt: true,
          backgroundCheckInviteSentAt: true,
          registrationFeeHoldStatus: true,
          hasPaidBackgroundFee: true,
        },
      },
    },
  });

  if (!trainer?.profile) {
    redirect("/trainer/onboarding");
  }

  const escrow = trainerHasSignupBackgroundEscrow({
    registrationFeeHoldStatus: trainer.profile.registrationFeeHoldStatus,
    hasPaidBackgroundFee: trainer.profile.hasPaidBackgroundFee,
  });

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 text-white">
      <Link href="/trainer/onboarding" className="text-sm text-[#FF7E00] underline-offset-2 hover:underline">
        ← Back to onboarding
      </Link>
      <h1 className="mt-6 text-2xl font-black tracking-tight">Request Checkr screening</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/65">
        Hi {trainer.firstName} — while our direct Checkr connection is being approved, Match Fit sends invitations
        manually. Your signup fee stays held in Stripe until screening is ordered and approved. If you do not complete
        screening, the background-check portion of that fee is not applied to your account (see Terms).
      </p>
      <div className="mt-8">
        <TrainerBackgroundCheckPlanBPanel
          backgroundCheckStatus={trainer.profile.backgroundCheckStatus}
          inviteRequestedAt={trainer.profile.backgroundCheckInviteRequestedAt?.toISOString() ?? null}
          inviteSentAt={trainer.profile.backgroundCheckInviteSentAt?.toISOString() ?? null}
          signupEscrowActive={escrow}
        />
      </div>
    </main>
  );
}
