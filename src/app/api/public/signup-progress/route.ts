import { NextResponse } from "next/server";
import { upsertSignupFormProgress, type SignupFormRole } from "@/lib/signup-form-progress";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const role = o.role === "client" || o.role === "trainer" ? (o.role as SignupFormRole) : null;
  const visitorId = typeof o.visitorId === "string" ? o.visitorId.trim() : "";
  const fields = o.fields && typeof o.fields === "object" ? (o.fields as Record<string, boolean>) : null;

  if (!role || !visitorId || !fields) {
    return NextResponse.json({ error: "role, visitorId, and fields are required." }, { status: 400 });
  }

  await upsertSignupFormProgress({
    role,
    visitorId,
    fields,
    email: typeof o.email === "string" ? o.email : null,
    username: typeof o.username === "string" ? o.username : null,
  });

  return NextResponse.json({ ok: true });
}
