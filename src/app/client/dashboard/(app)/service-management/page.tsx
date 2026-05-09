import { redirect } from "next/navigation";
import { ServiceManagementView } from "@/components/client/service-management-view";
import { loadClientServiceManagementPairs } from "@/lib/marketplace-governance-overview";
import { getSessionClientId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClientServiceManagementPage() {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/client");

  const { feeDisclaimer, upcomingBookings, activePairs, pastPairs } = await loadClientServiceManagementPairs(clientId);

  return (
    <div className="pb-12 text-center">
      <ServiceManagementView
        feeDisclaimer={feeDisclaimer}
        upcomingBookings={upcomingBookings}
        activePairs={activePairs}
        pastPairs={pastPairs}
      />
    </div>
  );
}
