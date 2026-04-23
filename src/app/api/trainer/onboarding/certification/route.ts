import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;

function extForMime(mime: string): string | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const uploadTypeRaw = form.get("uploadType");
    const uploadType = uploadTypeRaw === "other" ? "other" : "cpt";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Choose a PDF or image file." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 5 MB or smaller." }, { status: 400 });
    }

    const mime = file.type;
    const ext = extForMime(mime);
    if (!ext) {
      return NextResponse.json({ error: "Use PDF, JPG, PNG, or WebP." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads", "trainers");
    await mkdir(dir, { recursive: true });

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { certificationUrl: true, otherCertificationUrl: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    const relative =
      uploadType === "other"
        ? `/uploads/trainers/${trainerId}-other-cert.${ext}`
        : `/uploads/trainers/${trainerId}-cert.${ext}`;

    const prevKey = uploadType === "other" ? profile.otherCertificationUrl : profile.certificationUrl;
    const prev = prevKey?.split("?")[0];
    if (prev?.startsWith("/uploads/trainers/")) {
      const oldPath = path.join(process.cwd(), "public", prev.replace(/^\//, ""));
      try {
        await unlink(oldPath);
      } catch {
        // ignore missing file
      }
    }

    const outPath = path.join(process.cwd(), "public", relative.replace(/^\//, ""));
    await writeFile(outPath, buf);

    const updated = await prisma.trainerProfile.update({
      where: { trainerId },
      data:
        uploadType === "other"
          ? { otherCertificationUrl: relative }
          : {
              certificationUrl: relative,
              certificationReviewStatus: "PENDING",
            },
      select: {
        certificationUrl: true,
        otherCertificationUrl: true,
        certificationReviewStatus: true,
      },
    });

    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({
      ok: true,
      uploadType,
      certificationUrl: updated.certificationUrl,
      otherCertificationUrl: updated.otherCertificationUrl,
      certificationReviewStatus: updated.certificationReviewStatus,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not upload certification.", {
      logLabel: "[Match Fit trainer certification upload]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
