import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;

function extForMime(mime: string): string | null {
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
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
    }

    const mime = file.type;
    const ext = extForMime(mime);
    if (!ext) {
      return NextResponse.json({ error: "Use JPG, PNG, or WebP." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads", "trainers");
    await mkdir(dir, { recursive: true });

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { profileImageUrl: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Trainer not found." }, { status: 400 });
    }

    const prev = trainer.profileImageUrl?.split("?")[0];
    if (prev?.startsWith("/uploads/trainers/")) {
      const oldPath = path.join(process.cwd(), "public", prev.replace(/^\//, ""));
      try {
        await unlink(oldPath);
      } catch {
        // ignore missing file
      }
    }

    const relative = `/uploads/trainers/${trainerId}-avatar.${ext}`;
    const outPath = path.join(process.cwd(), "public", relative.replace(/^\//, ""));
    await writeFile(outPath, buf);

    await prisma.trainer.update({
      where: { id: trainerId },
      data: { profileImageUrl: relative },
    });

    return NextResponse.json({ ok: true, profileImageUrl: relative });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not upload profile image.", {
      logLabel: "[Match Fit trainer profile image]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
