/**
 * ZIP codes treated as inside the Atlanta metro beta service area.
 * Covers intown 303xx plus major OTP counties (core ~15–20 road miles from downtown).
 * Extend via env {@link extraBetaAtlantaZipsFromEnv}.
 */
const CORE = new Set<string>();

for (let n = 30301; n <= 30369; n++) {
  CORE.add(String(n));
}

const OTP: readonly string[] = [
  "30002",
  "30004",
  "30005",
  "30006",
  "30007",
  "30008",
  "30009",
  "30011",
  "30012",
  "30013",
  "30016",
  "30017",
  "30018",
  "30019",
  "30021",
  "30022",
  "30024",
  "30028",
  "30030",
  "30032",
  "30033",
  "30034",
  "30035",
  "30036",
  "30037",
  "30038",
  "30039",
  "30040",
  "30041",
  "30043",
  "30044",
  "30045",
  "30046",
  "30047",
  "30052",
  "30054",
  "30055",
  "30056",
  "30058",
  "30060",
  "30062",
  "30064",
  "30066",
  "30067",
  "30068",
  "30069",
  "30071",
  "30072",
  "30075",
  "30076",
  "30077",
  "30078",
  "30079",
  "30080",
  "30081",
  "30082",
  "30083",
  "30084",
  "30085",
  "30086",
  "30087",
  "30088",
  "30090",
  "30091",
  "30092",
  "30093",
  "30094",
  "30095",
  "30096",
  "30097",
  "30101",
  "30102",
  "30106",
  "30114",
  "30115",
  "30117",
  "30118",
  "30119",
  "30120",
  "30121",
  "30122",
  "30126",
  "30127",
  "30132",
  "30133",
  "30134",
  "30135",
  "30141",
  "30144",
  "30152",
  "30157",
  "30168",
  "30169",
  "30188",
  "30189",
  "30213",
  "30214",
  "30215",
  "30223",
  "30236",
  "30237",
  "30238",
  "30248",
  "30252",
  "30253",
  "30260",
  "30263",
  "30265",
  "30268",
  "30269",
  "30273",
  "30274",
  "30275",
  "30281",
  "30287",
  "30288",
  "30289",
  "30290",
  "30291",
  "30294",
  "30297",
  "30298",
];

for (const z of OTP) {
  CORE.add(z);
}

export const BETA_ATLANTA_METRO_ZIP_SET: ReadonlySet<string> = CORE;

function normalizeZip5(raw: string): string | null {
  const d = raw.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return d ? d[1]! : null;
}

/** Optional comma-separated 5-digit zips from `MATCH_FIT_BETA_EXTRA_SERVICE_ZIPS`. */
export function extraBetaAtlantaZipsFromEnv(): Set<string> {
  const raw = process.env.MATCH_FIT_BETA_EXTRA_SERVICE_ZIPS?.trim();
  const s = new Set<string>();
  if (!raw) return s;
  for (const part of raw.split(",")) {
    const z = normalizeZip5(part);
    if (z) s.add(z);
  }
  return s;
}

export function isZipInBetaAtlantaMetroArea(zip: string): boolean {
  const z = normalizeZip5(zip);
  if (!z) return false;
  if (BETA_ATLANTA_METRO_ZIP_SET.has(z)) return true;
  return extraBetaAtlantaZipsFromEnv().has(z);
}
