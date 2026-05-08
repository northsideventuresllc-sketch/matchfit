import { loadTrainerExpenseSummaryForYear } from "@/lib/trainer-client-management-dashboard";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const url = new URL(req.url);
    const yearRaw = url.searchParams.get("year");
    const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getUTCFullYear();
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year." }, { status: 400 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { username: true, preferredName: true, firstName: true, lastName: true },
    });
    if (!trainer) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const display =
      trainer.preferredName?.trim() ||
      [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
      `@${trainer.username}`;

    const { rows, byCategoryCents, totalCents } = await loadTrainerExpenseSummaryForYear(trainerId, year);

    const detail = rows
      .map(
        (r) => `<tr>
        <td>${esc(new Date(r.spentAt).toLocaleDateString())}</td>
        <td>${esc(r.category)}</td>
        <td>${esc(r.description ?? "")}</td>
        <td>${r.likelyTaxDeductible ? "Likely" : "Review"}</td>
        <td style="text-align:right">$${(Math.max(0, r.amountCents) / 100).toFixed(2)}</td>
      </tr>`,
      )
      .join("");

    const cats = Object.entries(byCategoryCents)
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">$${(v / 100).toFixed(2)}</td></tr>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Match Fit expenses ${year}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    .muted { color: #555; font-size: 11px; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>Match Fit — business expenses (${year})</h1>
  <p>Trainer: ${esc(display)} (@${esc(trainer.username)})</p>
  <p class="muted">Not tax advice. Use Print → Save as PDF. Confirm deductibility with a qualified tax professional.</p>
  <h2 style="font-size:14px;margin-top:20px">By category</h2>
  <table><thead><tr><th>Category</th><th>Total</th></tr></thead><tbody>${cats || "<tr><td colspan=\"2\">No expenses logged.</td></tr>"}</tbody></table>
  <h2 style="font-size:14px;margin-top:20px">Line items</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Category</th><th>Notes</th><th>Write-off hint</th><th>Amount</th></tr>
    </thead>
    <tbody>${detail || "<tr><td colspan=\"5\">No expenses logged.</td></tr>"}</tbody>
    <tfoot><tr><th colspan="4">Year total</th><th style="text-align:right">$${(totalCents / 100).toFixed(2)}</th></tr></tfoot>
  </table>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not render report." }, { status: 500 });
  }
}
