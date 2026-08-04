/**
 * Prints one md5 per offering over the canonical DPMO string, so the rows in
 * `venture_offering_dpmo` can be proved identical to OFFERING_DPMO_SEED without
 * dumping every field. Read-only. Touches no database.
 */
import { createHash } from "node:crypto";
import { OFFERING_DPMO_SEED } from "../src/lib/offering-dpmo";

for (const d of OFFERING_DPMO_SEED) {
  const canon = [
    d.sector,
    d.phase,
    String(d.marketingEnabled),
    String(d.outreachEnabled),
    d.marketing.angle,
    d.marketing.proof,
    d.marketing.cta,
    d.marketing.link,
    JSON.stringify(d.marketing.channels),
    d.marketing.cadence,
    d.marketing.notes ?? "",
    d.outreach.channel,
    d.outreach.opener,
    d.outreach.benefit,
    d.outreach.link,
    d.outreach.notes ?? "",
    d.benefitLine,
    d.priceNote,
  ].join("");
  console.log(`${d.offeringSlug}\t${createHash("md5").update(canon).digest("hex")}`);
}
