import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FILENAME = "MATCH-FIT-SEND-WELCOME-CODE-FOR-ANALYSIS.md";

/**
 * GET — streams the bundled send-welcome analysis markdown as a file download (Save / Downloads folder).
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "docs", FILENAME);
    const body = await readFile(filePath, "utf8");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${FILENAME}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Analysis file is not available on this deployment." }, { status: 404 });
  }
}
