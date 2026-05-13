/**
 * Fails CI if checkout / Terms examples drift from {@link tos-implementation-contract}.
 * Run: npm run tos:alignment
 */

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as Tos from "../src/lib/tos-implementation-contract";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const subscribe = readFileSync(join(root, "src/app/client/subscribe/page.tsx"), "utf8");
assert(
  subscribe.includes(`$${Tos.TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD}.00 per month`),
  "Client subscribe page must show platform subscription USD from tos-implementation-contract",
);

const terms = readFileSync(join(root, "src/app/terms/page.tsx"), "utf8");
assert(
  terms.includes('@/lib/tos-implementation-contract"') || terms.includes("@/lib/tos-implementation-contract'"),
  "Terms page must import from tos-implementation-contract",
);

assert.strictEqual(Tos.MATCH_BATCH_WINDOW_HOURS, 12, "Match batch window must remain 12 hours for Terms §13");
assert.strictEqual(Tos.PLATFORM_ADMIN_FEE_PERCENT, 20, "Admin fee percent must match Terms §3");

console.log("tos:alignment — OK (constants match wired sources)");
