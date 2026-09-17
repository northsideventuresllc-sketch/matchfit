import { NextResponse } from "next/server";
import {
  createPresignedMediaUploadUrl,
  mediaExtensionForMimeType,
  safeMediaPathSegment as safeSegment,
} from "@/lib/content-calendar/media-storage";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/content-calendar/v2/media-upload/sign
 *
 * Generates a presigned upload URL for direct browser-to-Supabase uploads.
 * This completely avoids routing large video files (10MB-100MB+) through Next.js / Vercel
 * serverless functions which enforce a hard 4.5MB payload limit.
 */
export async function POST(req: Request) {
  const validCoworkSecret = await hasValidCoworkSecret(req);
  const adminSession = validCoworkSecret ? null : await requireAdminSession();
  if (!validCoworkSecret && !adminSession) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  let body: { filename?: string; jobId?: string; label?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { filename = "file.mp4", jobId, label, contentType = "application/octet-stream" } = body;
  if (typeof jobId !== "string" || !jobId.trim() || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "jobId and label are required." }, { status: 400 });
  }

  const derivedExt = mediaExtensionForMimeType(contentType);
  const rawExt = (filename.split(".").pop() || derivedExt).toLowerCase().slice(0, 10);
  const ext = safeSegment(rawExt || derivedExt);
  const path = `${safeSegment(jobId)}/${safeSegment(label)}-${Date.now()}.${ext}`;

  try {
    const result = await createPresignedMediaUploadUrl({ path });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[content-calendar media-upload sign]", e);
    const message = e instanceof Error ? e.message : "Failed to generate presigned upload URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
