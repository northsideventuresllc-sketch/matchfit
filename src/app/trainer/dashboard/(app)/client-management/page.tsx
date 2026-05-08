import { redirect } from "next/navigation";
import { ClientManagementView } from "@/components/trainer/client-management-view";
import { loadTrainerClientManagementPairs } from "@/lib/marketplace-governance-overview";
import { loadTrainerClientManagementPageExtras } from "@/lib/trainer-client-management-dashboard";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TrainerClientManagementPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const [{ feeDisclaimer, pairs, punchHistory }, extras] = await Promise.all([
    loadTrainerClientManagementPairs(trainerId),
    loadTrainerClientManagementPageExtras(trainerId),
  ]);

  return (
    <div className="pb-12 text-center">
      <ClientManagementView
        feeDisclaimer={feeDisclaimer}
        pairs={pairs}
        punchHistory={punchHistory}
        nextPunch={extras.nextPunch}
        pastClients={extras.pastClients}
        payoutPipeline={extras.payoutPipeline}
        transactionYears={extras.transactionYears}
        consecutiveMissedSessionPunches={extras.consecutiveMissedSessionPunches}
        premiumFitHub={extras.premiumFitHub}
      />
    </div>
  );
}
