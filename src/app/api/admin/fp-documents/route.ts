import { NextResponse } from "next/server";
import { listFpDocumentsForAdmin } from "@/lib/fp-document-review-service";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") === "all" ? "all" : "pending";
  const documents = await listFpDocumentsForAdmin(filter);
  return NextResponse.json({ documents });
}
