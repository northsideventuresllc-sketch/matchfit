import { NextResponse } from "next/server";
import { listTrainerPromotionsForDashboard } from "@/lib/trainer-promo-tokens";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required." }, { status: 403 });
    }
    const promotions = await listTrainerPromotionsForDashboard(trainerId);
    return NextResponse.json({ promotions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load promotions." }, { status: 500 });
  }
}
