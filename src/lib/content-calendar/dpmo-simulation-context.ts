import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * DPMO SIMULATION CONTEXT — reads the Monte Carlo results the DPMO Simulation
 * Engine writes onto `venture_offering_dpmo` (NI-Brain Decision #543,
 * nv-vault/simulations) and turns them into a short, human-readable block a
 * content-generation prompt can lean on.
 *
 * READ-ONLY. This never writes, never sends, never posts. If the simulation
 * columns are empty (engine hasn't run for an offering yet) that offering is
 * silently skipped — this is enrichment, not a requirement.
 */

export type DpmoSimulationRow = {
  venture: string;
  offering: string;
  sector: string;
  phase: string;
  conversionLabel: string | null;
  p1MedianConversions: number | null;
  p1P10Conversions: number | null;
  p1P90Conversions: number | null;
  p1MedianRevenue: number | null;
  revenueLabel: string | null;
  p2P10Revenue: number | null;
  p2MedianRevenue: number | null;
  p2P90Revenue: number | null;
  recommendPhaseMove: boolean;
  recommendReason: string | null;
  dataSource: string | null;
  ranAt: Date | null;
};

type RawRow = {
  venture: string;
  offering: string;
  sector: string;
  phase: string;
  simPhase1ConversionLabel: string | null;
  simPhase1MedianConversions: number | null;
  simPhase1P10Conversions: number | null;
  simPhase1P90Conversions: number | null;
  simPhase1MedianRevenue: number | null;
  simPhase2RevenueLabel: string | null;
  simPhase2P10Revenue: number | null;
  simPhase2MedianRevenue: number | null;
  simPhase2P90Revenue: number | null;
  simRecommendPhaseMove: boolean;
  simRecommendReason: string | null;
  simDataSource: string | null;
  simRanAt: Date | null;
};

/**
 * Every offering that has a simulation run recorded, for one venture (or all
 * ventures if omitted). `ventureDisplayName` matches `v_offering_dpmo.venture`
 * exactly (e.g. "Match Fit", "NI Services") — free text, not a slug.
 */
export async function fetchDpmoSimulationRows(ventureDisplayName?: string): Promise<DpmoSimulationRow[]> {
  try {
    const rows = ventureDisplayName
      ? await prisma.$queryRaw<RawRow[]>`
          SELECT "venture", "offering", "sector", "phase",
                 "simPhase1ConversionLabel", "simPhase1MedianConversions",
                 "simPhase1P10Conversions", "simPhase1P90Conversions",
                 "simPhase1MedianRevenue",
                 "simPhase2RevenueLabel", "simPhase2P10Revenue",
                 "simPhase2MedianRevenue", "simPhase2P90Revenue",
                 "simRecommendPhaseMove", "simRecommendReason",
                 "simDataSource", "simRanAt"
          FROM "v_offering_dpmo"
          WHERE "venture" = ${ventureDisplayName} AND "simRanAt" IS NOT NULL
          ORDER BY "offering"
        `
      : await prisma.$queryRaw<RawRow[]>`
          SELECT "venture", "offering", "sector", "phase",
                 "simPhase1ConversionLabel", "simPhase1MedianConversions",
                 "simPhase1P10Conversions", "simPhase1P90Conversions",
                 "simPhase1MedianRevenue",
                 "simPhase2RevenueLabel", "simPhase2P10Revenue",
                 "simPhase2MedianRevenue", "simPhase2P90Revenue",
                 "simRecommendPhaseMove", "simRecommendReason",
                 "simDataSource", "simRanAt"
          FROM "v_offering_dpmo"
          WHERE "simRanAt" IS NOT NULL
          ORDER BY "venture", "offering"
        `;

    return rows.map((r) => ({
      venture: r.venture,
      offering: r.offering,
      sector: r.sector,
      phase: r.phase,
      conversionLabel: r.simPhase1ConversionLabel,
      p1MedianConversions: r.simPhase1MedianConversions,
      p1P10Conversions: r.simPhase1P10Conversions,
      p1P90Conversions: r.simPhase1P90Conversions,
      p1MedianRevenue: r.simPhase1MedianRevenue,
      revenueLabel: r.simPhase2RevenueLabel,
      p2P10Revenue: r.simPhase2P10Revenue,
      p2MedianRevenue: r.simPhase2MedianRevenue,
      p2P90Revenue: r.simPhase2P90Revenue,
      recommendPhaseMove: r.simRecommendPhaseMove,
      recommendReason: r.simRecommendReason,
      dataSource: r.simDataSource,
      ranAt: r.simRanAt,
    }));
  } catch {
    // Additive/enrichment only — a schema mismatch or DB hiccup here must
    // never break content generation. Caller sees an empty list and moves on.
    return [];
  }
}

function money(v: number | null): string {
  if (v === null) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** One line per offering, written for a content-generation prompt to act on directly. */
function renderRowLine(r: DpmoSimulationRow): string {
  const moveTag = r.recommendPhaseMove
    ? "READY TO MOVE"
    : r.phase.startsWith("Phase 2")
      ? "already Phase 2"
      : r.p1MedianConversions !== null
        ? "not yet — keep building"
        : "benchmark-only, no actuals yet";

  const convPart =
    r.conversionLabel && r.p1MedianConversions !== null
      ? `P1 ${r.conversionLabel} p10=${r.p1P10Conversions ?? "—"} median=${r.p1MedianConversions} p90=${r.p1P90Conversions ?? "—"}`
      : null;

  const revPart =
    r.revenueLabel && r.p2MedianRevenue !== null
      ? `P2 6mo ${r.revenueLabel === "mrr_month6" ? "MRR" : "revenue"} p10=${money(r.p2P10Revenue)} median=${money(r.p2MedianRevenue)} p90=${money(r.p2P90Revenue)}`
      : null;

  const parts = [`${r.offering} (${r.phase})`, `[${moveTag}]`, convPart, revPart, r.recommendReason || null]
    .filter(Boolean)
    .join(" — ");

  return `- ${parts}`;
}

/**
 * Builds the DPMO-simulation-informed block for `buildContentGenerationContext()`.
 * One line per offering that has a simulation run, phase-move status first so a
 * writer can immediately tell "lean into urgency" (READY TO MOVE / clearing its
 * Phase 1 goal) from "keep it educational" (not yet, still building trust).
 * Returns "" if there is nothing to say — caller filters empties out.
 */
export async function buildDpmoSimulationContext(ventureDisplayName?: string): Promise<string> {
  const rows = await fetchDpmoSimulationRows(ventureDisplayName);
  if (rows.length === 0) return "";

  const staleness = rows[0]?.dataSource ? ` (${rows[0].dataSource})` : "";
  const lines = rows.map(renderRowLine);

  return [
    `DPMO Simulation Engine — modeled phase-move status per offering${staleness}. Use this to decide how hard to push and which CTA fits: READY TO MOVE = clearing its Phase-1 goal, lean into urgency/scale messaging; "not yet" = still building trust, keep it educational and benefit-led; benchmark-only = no real signups yet, do not claim traction.`,
    lines.join("\n"),
  ].join("\n");
}
