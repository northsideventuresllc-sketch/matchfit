import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerDocumentUrl } from "@/lib/trainer-document-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TYPES = ["cpt", "other", "nutritionist", "specialist"] as const;
type CertType = (typeof TYPES)[number];

function parseType(raw: string | null): CertType {
  return TYPES.includes(raw as CertType) ? (raw as CertType) : "cpt";
}

/**
 * Opens the signed-in Fitness Pro's own certification file.
 *
 * Certifications live in a private bucket, so the stored value is a reference rather than a
 * URL. Resolving here — from the session's own profile, never from a reference in the query
 * string — means a link can only ever open the requester's own document.
 */
export async function GET(req: Request) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const type = parseType(new URL(req.url).searchParams.get("type"));

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      certificationUrl: true,
      otherCertificationUrl: true,
      nutritionistCertificationUrl: true,
      specialistCertificationUrl: true,
    },
  });

  const stored =
    type === "other"
      ? profile?.otherCertificationUrl
      : type === "nutritionist"
        ? profile?.nutritionistCertificationUrl
        : type === "specialist"
          ? profile?.specialistCertificationUrl
          : profile?.certificationUrl;

  const url = await resolveTrainerDocumentUrl(stored);
  if (!url) {
    return NextResponse.json({ error: "That certification is not on file." }, { status: 404 });
  }

  return NextResponse.redirect(new URL(url, req.url), { status: 302 });
}
