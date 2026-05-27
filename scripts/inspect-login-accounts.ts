/**
 * Lists whether login identifiers can resolve to active (non-deidentified) accounts.
 * Does not print password hashes.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/inspect-login-accounts.ts admin:jobo0602
 *   npx tsx --env-file=.env.local scripts/inspect-login-accounts.ts trainer:you@email.com
 *   npx tsx --env-file=.env.local scripts/inspect-login-accounts.ts client:@username
 */
import { createPrismaClient } from "./create-prisma-client.mjs";
import { pathToFileURL } from "node:url";

export function normalizeAdminCode(raw: string): string {
  return raw.trim().toLowerCase();
}

export type LoginIdentifierParts = { email?: string; username?: string; phone?: string };

export function normalizeLoginIdentifier(raw: string): LoginIdentifierParts {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { email: trimmed.toLowerCase() };
  }
  const digitsOnly = trimmed.replace(/\D/g, "");
  const compact = trimmed.replace(/\s/g, "");
  if (digitsOnly.length >= 10 && digitsOnly.length >= compact.length * 0.6) {
    return { phone: trimmed };
  }
  return { username: withoutAt };
}

export function buildLookupOrFilters(rawIdentifier: string): Array<Record<string, unknown>> {
  const parts = normalizeLoginIdentifier(rawIdentifier);
  const or: Array<Record<string, unknown>> = [];
  if (parts.email) or.push({ email: parts.email });
  if (parts.phone) or.push({ phone: parts.phone });
  if (parts.username) {
    or.push({ username: { equals: parts.username, mode: "insensitive" } });
  }
  return or;
}

async function main() {
  const prisma = createPrismaClient();
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Pass one or more identifiers: admin:CODE trainer:EMAIL client:USER");
    process.exit(1);
  }

  const adminCount = await prisma.administrator.count();
  console.log(`Administrators in DB: ${adminCount}`);

  for (const raw of args) {
    const [role, ident] = raw.split(":", 2);
    if (!ident) {
      console.log(`Skip invalid arg: ${raw}`);
      continue;
    }
    if (role === "admin") {
      const code = normalizeAdminCode(ident);
      const row = await prisma.administrator.findUnique({
        where: { adminCode: code },
        select: { id: true, email: true, adminCode: true, firstName: true, lastName: true },
      });
      console.log(`\nadmin:${code}`, row ? `FOUND (${row.email})` : "NOT FOUND");
      continue;
    }
    if (role === "trainer" || role === "client") {
      const or = buildLookupOrFilters(ident);
      if (or.length === 0) {
        console.log(`\n${role}:${ident} invalid identifier`);
        continue;
      }
      const row =
        role === "trainer"
          ? await prisma.trainer.findFirst({
              where: { deidentifiedAt: null, OR: or },
              select: { id: true, username: true, email: true, deidentifiedAt: true },
            })
          : await prisma.client.findFirst({
              where: { deidentifiedAt: null, OR: or },
              select: { id: true, username: true, email: true, deidentifiedAt: true },
            });
      console.log(
        `\n${role}:${ident}`,
        row ? `FOUND id=${row.id} user=${row.username} email=${row.email}` : "NOT FOUND (wrong id or deidentified)",
      );
      continue;
    }
    console.log(`Unknown role in: ${raw}`);
  }
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  void main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
