import { NextResponse } from "next/server";
import { createNiBrainClient, isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";

export const dynamic = "force-dynamic";

const MEDIA_BUCKET = "content-calendar-media";

/** The external Cowork session uploads with the shared CRON_SECRET (no admin cookie). */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

function safeSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "file";
}

/**
 * POST /api/admin/content-calendar/v2/media-upload
 *
 * A Cowork Desktop-Control session downloads generated video/image files locally and has
 * no way to give the app a public URL for them. This route accepts the raw file (multipart
 * form-data: `file`, `jobId`, `label`) and re-hosts it in NI Brain Supabase Storage, so the
 * Cowork session can then call the job-completion callback with a real URL.
 */
export async function POST(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
    const client = createNiBrainClient();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await client.storage
      .from(MEDIA_BUCKET)
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
    if (error) throw new Error(error.message);

    const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (e) {
    console.error("[content-calendar media-upload]", e);
    const message = e instanceof Error ? e.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
