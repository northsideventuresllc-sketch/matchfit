import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import {
  assertFitHubImageMime,
  assertFitHubVideoMime,
  FITHUB_IMAGE_MAX_BYTES,
  FITHUB_VIDEO_MAX_BYTES,
  isImageMime,
  isVideoMime,
} from "@/lib/validations/trainer-fithub-media";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required to upload media." }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Choose a file." }, { status: 400 });
    }

    const mime = file.type;
    let ext: string;
    let maxBytes: number;
    if (isImageMime(mime)) {
      maxBytes = FITHUB_IMAGE_MAX_BYTES;
      ext = assertFitHubImageMime(mime);
    } else if (isVideoMime(mime)) {
      maxBytes = FITHUB_VIDEO_MAX_BYTES;
      ext = assertFitHubVideoMime(mime);
    } else {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File is too large." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads", "trainers", "fithub");
    await mkdir(dir, { recursive: true });

    const token = randomBytes(8).toString("hex");
    const relative = `/uploads/trainers/fithub/${trainerId}-${Date.now()}-${token}.${ext}`;
    const outPath = path.join(process.cwd(), "public", relative.replace(/^\//, ""));
    await writeFile(outPath, buf);

    return NextResponse.json({ url: relative, mime });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not upload.";
    if (message.includes("Use ") || message.includes("MP4")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Could not upload file." }, { status: 500 });
  }
}
