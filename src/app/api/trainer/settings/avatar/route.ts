import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { assertAvatarMime, AVATAR_MAX_BYTES } from "@/lib/validations/client-settings-profile";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

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

    if (file.size > AVATAR_MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 2 MB or smaller." }, { status: 400 });
    }

    const mime = file.type;
    let ext: string;
    try {
      ext = assertAvatarMime(mime);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid image.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads", "trainers");
    await mkdir(dir, { recursive: true });

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { profileImageUrl: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

    const updated = await prisma.trainer.update({
      where: { id: trainerId },
      data: { profileImageUrl: relative },
      select: { profileImageUrl: true },
    });

    return NextResponse.json({ ok: true, profileImageUrl: updated.profileImageUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not upload image." }, { status: 500 });
  }
}
