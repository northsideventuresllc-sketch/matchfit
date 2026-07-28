import { NextResponse } from "next/server";
import {
  safeMediaPathSegment as safeSegment,
  uploadContentCalendarMedia,
} from "@/lib/content-calendar/media-storage";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/content-calendar/v2/media-upload
 *
 * A Cowork Desktop-Control session downloads generated video/image files locally and has
 * no way to give the app a public URL for them. This route accepts the raw file (multipart
 * form-data: `file`, `jobId`, `label`) and re-hosts it in NI Brain Supabase Storage, so the
 * Cowork session can then call the job-completion callback with a real URL.
 */
export async function POST(req: Request) {
  if (!(await hasValidCoworkSecret(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data body." }, { status: 400 });
  }

  const file = form.get("file");
  const jobId = form.get("jobId");
  const label = form.get("label");
  if (!(file instanceof File) || typeof jobId !== "string" || !jobId.trim() || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "file, jobId, and label are required." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 10);
  const path = `${safeSegment(jobId)}/${safeSegment(label)}-${Date.now()}.${safeSegment(ext)}`;

  try {
    const uploaded = await uploadContentCalendarMedia({
      bytes: new Uint8Array(await file.arrayBuffer()),
      path,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ url: uploaded.url, path: uploaded.path });
  } catch (e) {
    console.error("[content-calendar media-upload]", e);
    const message = e instanceof Error ? e.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
