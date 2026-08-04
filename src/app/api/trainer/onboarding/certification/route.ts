import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";
import { deleteTrainerDocument, putTrainerDocument } from "@/lib/trainer-document-storage";
import { resolveUploadFileKind, UPLOAD_UNSUPPORTED_TYPE_MESSAGE } from "@/lib/upload-file-type";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;

function parseUploadType(raw: FormDataEntryValue | null): "cpt" | "other" | "nutritionist" | "specialist" {
  if (raw === "other") return "other";
  if (raw === "nutritionist") return "nutritionist";
  if (raw === "specialist") return "specialist";
  return "cpt";
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const uploadType = parseUploadType(form.get("uploadType"));

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Choose a PDF or image file." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 5 MB or smaller." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = resolveUploadFileKind({
      declaredMime: file.type,
      filename: file instanceof File ? file.name : null,
      bytes: buf,
    });
    if (!kind) {
      return NextResponse.json({ error: UPLOAD_UNSUPPORTED_TYPE_MESSAGE }, { status: 400 });
    }
    const ext = kind.ext;

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        certificationUrl: true,
        otherCertificationUrl: true,
        nutritionistCertificationUrl: true,
        specialistCertificationUrl: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    const key =
      uploadType === "other"
        ? `trainers/${trainerId}-other-cert.${ext}`
        : uploadType === "nutritionist"
          ? `trainers/${trainerId}-nutrition-cert.${ext}`
          : uploadType === "specialist"
            ? `trainers/${trainerId}-specialist-cert.${ext}`
            : `trainers/${trainerId}-cert.${ext}`;

    const prevKey =
      uploadType === "other"
        ? profile.otherCertificationUrl
        : uploadType === "nutritionist"
          ? profile.nutritionistCertificationUrl
          : uploadType === "specialist"
            ? profile.specialistCertificationUrl
            : profile.certificationUrl;

    const relative = await putTrainerDocument({ key, bytes: buf, contentType: kind.mime });

    // Replacing a certification with a different file type leaves the old object behind,
    // so clear it once the new one is safely written.
    if (prevKey && prevKey.split("?")[0] !== relative) {
      await deleteTrainerDocument(prevKey);
    }

    const updated = await prisma.trainerProfile.update({
      where: { trainerId },
      data:
        uploadType === "other"
          ? {
              otherCertificationUrl: relative,
              otherCertificationReviewStatus: "PENDING",
            }
          : uploadType === "nutritionist"
            ? {
                nutritionistCertificationUrl: relative,
                nutritionistCertificationReviewStatus: "PENDING",
              }
            : uploadType === "specialist"
              ? {
                  specialistCertificationUrl: relative,
                  specialistCertificationReviewStatus: "PENDING",
                }
              : {
                  certificationUrl: relative,
                  certificationReviewStatus: "PENDING",
                },
      select: {
        certificationUrl: true,
        otherCertificationUrl: true,
        nutritionistCertificationUrl: true,
        specialistCertificationUrl: true,
        certificationReviewStatus: true,
        nutritionistCertificationReviewStatus: true,
        specialistCertificationReviewStatus: true,
        otherCertificationReviewStatus: true,
      },
    });

    await syncTrainerComplianceWindow(trainerId);
    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({
      ok: true,
      uploadType,
      certificationUrl: updated.certificationUrl,
      otherCertificationUrl: updated.otherCertificationUrl,
      nutritionistCertificationUrl: updated.nutritionistCertificationUrl,
      specialistCertificationUrl: updated.specialistCertificationUrl,
      certificationReviewStatus: updated.certificationReviewStatus,
      nutritionistCertificationReviewStatus: updated.nutritionistCertificationReviewStatus,
      specialistCertificationReviewStatus: updated.specialistCertificationReviewStatus,
      otherCertificationReviewStatus: updated.otherCertificationReviewStatus,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not upload certification.", {
      logLabel: "[Match Fit trainer certification upload]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
