import { NextResponse } from "next/server";
import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { isValidUsTrainerServiceZip } from "@/lib/beta-trainer-slot-caps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const zip = new URL(req.url).searchParams.get("zip")?.trim() ?? "";
  if (!zip) {
    return NextResponse.json({ validUsZip: false, inPersonEligible: false });
  }
  return NextResponse.json({
    validUsZip: isValidUsTrainerServiceZip(zip),
    inPersonEligible: isZipInBetaAtlantaMetroArea(zip),
  });
}
