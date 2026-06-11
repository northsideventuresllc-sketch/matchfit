#!/usr/bin/env node
import {
  createNiBrainScriptClient,
  isNiBrainConfigured,
  recordNiBrainBuildLog,
  recordNiBrainLearning,
} from "./ni-brain-lib.mjs";

function parseArgs(argv) {
  const out = { from: "", to: "", level: "patch", reason: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--from") out.from = argv[++i] ?? "";
    else if (arg === "--to") out.to = argv[++i] ?? "";
    else if (arg === "--level") out.level = argv[++i] ?? "patch";
    else if (arg === "--reason") out.reason = argv[++i] ?? "";
  }
  return out;
}

async function main() {
  if (!isNiBrainConfigured()) {
    process.exit(0);
  }

  const { from, to, level, reason } = parseArgs(process.argv.slice(2));
  if (!from || !to) {
    console.error("Usage: ni-brain-record-version.mjs --from X --to Y --level patch --reason \"…\"");
    process.exit(1);
  }

  const client = createNiBrainScriptClient();
  const summary = `Match Fit product version ${from} → ${to} (${level})`;
  await recordNiBrainBuildLog(client, {
    logType: "version_bump",
    summary,
    detail: { from, to, level, reason, recorded_at: new Date().toISOString() },
  });
  await recordNiBrainLearning(client, {
    learning: reason ? `${summary}: ${reason}` : summary,
    source: "match fit version bump",
  });
  console.log(`NI Brain recorded version bump ${from} → ${to}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
