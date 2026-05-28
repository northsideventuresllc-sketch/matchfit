/**
 * Read-only login account diagnostics (no passwords or connection strings printed).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/inspect-login-accounts.ts admin:jobo0602
 *   npx tsx --env-file=.env.local scripts/inspect-login-accounts.ts client:user@example.com trainer:@handle
 */
import { canonicalAdministratorCode, normalizeAdministratorCodeInput } from "../src/lib/admin-code";
import { normalizeLoginIdentifier } from "../src/lib/login-identifier";
import { createPrismaClient } from "./create-prisma-client.mjs";

function isDeletionGraceActive(row: { accountDeletionFinalizeAt: Date | null }): boolean {
  const at = row.accountDeletionFinalizeAt;
  return at != null && at.getTime() > Date.now();
}

const prisma = createPrismaClient();

function bcryptLooksValid(hash: string | null | undefined): boolean {
  if (!hash?.trim()) return false;
  return /^\$2[aby]\$\d{2}\$/.test(hash.trim());
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

type Target =
  | { kind: "admin"; raw: string }
  | { kind: "client"; raw: string }
  | { kind: "trainer"; raw: string };

function parseTarget(arg: string): Target | null {
  const m = /^(admin|client|trainer):(.+)$/i.exec(arg.trim());
  if (!m) return null;
  return { kind: m[1].toLowerCase() as Target["kind"], raw: m[2].trim() };
}

async function inspectAdmin(raw: string) {
  const normalized = normalizeAdministratorCodeInput(raw);
  console.log(`\n=== Administrator: ${raw} (lookup code: ${normalized}) ===`);

  const row = await prisma.administrator.findUnique({
    where: { adminCode: normalized },
    select: {
      id: true,
      adminCode: true,
      email: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      passwordHash: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!row) {
    const total = await prisma.administrator.count();
    const codes = await prisma.administrator.findMany({
      select: { adminCode: true, email: true },
      orderBy: { adminCode: "asc" },
      take: 20,
    });
    console.log("Status: NOT FOUND");
    console.log(`Administrators in DB: ${total}`);
    if (codes.length > 0) {
      console.log("Existing admin codes (up to 20):");
      for (const c of codes) {
        console.log(`  - ${c.adminCode} (${maskEmail(c.email)})`);
      }
    }
    return { found: false, loginBlocked: true, reason: "missing_admin_row" };
  }

  const canonical = canonicalAdministratorCode(row.firstName, row.lastName, row.dateOfBirth);
  const codeMismatch = canonical != null && canonical !== row.adminCode;
  const hashOk = bcryptLooksValid(row.passwordHash);

  console.log("Status: FOUND");
  console.log(`  id: ${row.id}`);
  console.log(`  adminCode (stored): ${row.adminCode}`);
  console.log(`  email: ${maskEmail(row.email)}`);
  console.log(`  canonical from profile: ${canonical ?? "(could not derive)"}`);
  if (codeMismatch) {
    console.log("  WARNING: stored adminCode does not match canonical from name/DOB — login uses stored code only if input normalizes to it.");
  }
  console.log(`  passwordHash: ${hashOk ? "bcrypt present" : "MISSING or invalid format"}`);
  console.log(`  createdAt: ${row.createdAt.toISOString()}`);
  console.log(`  updatedAt: ${row.updatedAt.toISOString()}`);

  const loginBlocked = !hashOk;
  if (loginBlocked) {
    console.log("Login likely fails: invalid or empty password hash.");
  } else if (codeMismatch) {
    console.log("Login may fail if user types derived code instead of stored code.");
  } else {
    console.log("DB row looks login-ready (password verification still depends on correct password).");
  }

  return { found: true, loginBlocked, reason: loginBlocked ? "bad_password_hash" : codeMismatch ? "code_mismatch" : null };
}

async function inspectClient(raw: string) {
  const parts = normalizeLoginIdentifier(raw);
  console.log(`\n=== Client: ${raw} ===`);
  console.log(`  normalized lookup: ${JSON.stringify(parts)}`);

  const or: { email?: string; phone?: string; username?: { equals: string; mode: "insensitive" } }[] = [];
  if (parts.email) or.push({ email: parts.email });
  if (parts.phone) or.push({ phone: parts.phone });
  if (parts.username) or.push({ username: { equals: parts.username, mode: "insensitive" } });

  if (or.length === 0) {
    console.log("Status: INVALID IDENTIFIER (nothing to query)");
    return { found: false, loginBlocked: true, reason: "invalid_identifier" };
  }

  const active = await prisma.client.findFirst({
    where: { OR: or, deidentifiedAt: null },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      passwordHash: true,
      twoFactorEnabled: true,
      safetySuspended: true,
      accountDeletionRequestedAt: true,
      accountDeletionFinalizeAt: true,
      deidentifiedAt: true,
      createdAt: true,
    },
  });

  const deidentified = await prisma.client.findFirst({
    where: { OR: or, deidentifiedAt: { not: null } },
    select: { id: true, deidentifiedAt: true, username: true },
  });

  if (!active) {
    console.log(deidentified ? "Status: DEIDENTIFIED (hidden from login lookup)" : "Status: NOT FOUND");
    if (deidentified) {
      console.log(`  deidentifiedAt: ${deidentified.deidentifiedAt?.toISOString()}`);
    }
    return { found: Boolean(deidentified), loginBlocked: true, reason: deidentified ? "deidentified" : "not_found" };
  }

  const hashOk = bcryptLooksValid(active.passwordHash);
  const deletionGrace = isDeletionGraceActive(active);

  console.log("Status: FOUND (active)");
  console.log(`  id: ${active.id}`);
  console.log(`  username: ${active.username}`);
  console.log(`  email: ${maskEmail(active.email)}`);
  console.log(`  passwordHash: ${hashOk ? "bcrypt present" : "MISSING or invalid"}`);
  console.log(`  twoFactorEnabled: ${active.twoFactorEnabled}`);
  console.log(`  safetySuspended: ${active.safetySuspended}`);
  console.log(`  accountDeletionGrace: ${deletionGrace}`);
  if (deletionGrace) {
    console.log(`  accountDeletionFinalizeAt: ${active.accountDeletionFinalizeAt?.toISOString()}`);
  }

  const loginBlocked =
    !hashOk || active.safetySuspended || deletionGrace;
  if (!hashOk) console.log("Login likely fails: bad password hash.");
  if (active.safetySuspended) console.log("Login blocked: safety suspension.");
  if (deletionGrace) console.log("Login redirects to deletion grace flow (not invalid credentials).");

  return { found: true, loginBlocked, reason: loginBlocked ? "blocked" : null };
}

async function inspectTrainer(raw: string) {
  const parts = normalizeLoginIdentifier(raw);
  console.log(`\n=== Trainer: ${raw} ===`);
  console.log(`  normalized lookup: ${JSON.stringify(parts)}`);

  const or: { email?: string; phone?: string; username?: { equals: string; mode: "insensitive" } }[] = [];
  if (parts.email) or.push({ email: parts.email });
  if (parts.phone) or.push({ phone: parts.phone });
  if (parts.username) or.push({ username: { equals: parts.username, mode: "insensitive" } });

  if (or.length === 0) {
    console.log("Status: INVALID IDENTIFIER");
    return { found: false, loginBlocked: true, reason: "invalid_identifier" };
  }

  const active = await prisma.trainer.findFirst({
    where: { OR: or, deidentifiedAt: null },
    select: {
      id: true,
      username: true,
      email: true,
      passwordHash: true,
      twoFactorEnabled: true,
      accountDeletionRequestedAt: true,
      accountDeletionFinalizeAt: true,
      deidentifiedAt: true,
      createdAt: true,
    },
  });

  if (!active) {
    console.log("Status: NOT FOUND or DEIDENTIFIED");
    return { found: false, loginBlocked: true, reason: "not_found" };
  }

  const hashOk = bcryptLooksValid(active.passwordHash);
  const deletionGrace = isDeletionGraceActive(active);

  console.log("Status: FOUND (active)");
  console.log(`  id: ${active.id}`);
  console.log(`  username: ${active.username}`);
  console.log(`  email: ${maskEmail(active.email)}`);
  console.log(`  passwordHash: ${hashOk ? "bcrypt present" : "MISSING or invalid"}`);
  console.log(`  twoFactorEnabled: ${active.twoFactorEnabled}`);
  console.log(`  accountDeletionGrace: ${deletionGrace}`);

  return { found: true, loginBlocked: !hashOk || deletionGrace, reason: null };
}

async function printSummary() {
  const [adminCount, clientActive, trainerActive, clientDeid, trainerDeid] = await Promise.all([
    prisma.administrator.count(),
    prisma.client.count({ where: { deidentifiedAt: null } }),
    prisma.trainer.count({ where: { deidentifiedAt: null } }),
    prisma.client.count({ where: { deidentifiedAt: { not: null } } }),
    prisma.trainer.count({ where: { deidentifiedAt: { not: null } } }),
  ]);

  let host = "(unknown)";
  try {
    const u = process.env.DATABASE_URL?.trim();
    if (u) host = new URL(u).hostname;
  } catch {
    /* ignore */
  }

  console.log("\n=== Database summary ===");
  console.log(`  host: ${host}`);
  console.log(`  administrators: ${adminCount}`);
  console.log(`  clients (active / deidentified): ${clientActive} / ${clientDeid}`);
  console.log(`  trainers (active / deidentified): ${trainerActive} / ${trainerDeid}`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a.trim().length > 0);
  if (args.length === 0) {
    console.error("Provide at least one target: admin:CODE | client:IDENTIFIER | trainer:IDENTIFIER");
    process.exit(1);
  }

  const results: { arg: string; found: boolean; loginBlocked: boolean; reason: string | null }[] = [];

  for (const arg of args) {
    const target = parseTarget(arg);
    if (!target) {
      console.error(`Skipping invalid arg (expected role:value): ${arg}`);
      continue;
    }
    if (target.kind === "admin") {
      const r = await inspectAdmin(target.raw);
      results.push({ arg, ...r, reason: r.reason });
    } else if (target.kind === "client") {
      const r = await inspectClient(target.raw);
      results.push({ arg, ...r, reason: r.reason });
    } else {
      const r = await inspectTrainer(target.raw);
      results.push({ arg, ...r, reason: r.reason });
    }
  }

  await printSummary();

  console.log("\n=== Targets ===");
  for (const r of results) {
    console.log(
      `  ${r.arg}: ${r.found ? "found" : "missing"}${r.loginBlocked ? ` (login issue: ${r.reason ?? "yes"})` : " (ok)"}`,
    );
  }
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
