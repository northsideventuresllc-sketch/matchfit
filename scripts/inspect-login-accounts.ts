/**
 * Lists whether login identifiers can resolve to active (non-deidentified) accounts.
 * Does not print password hashes.
 *
 * Usage:
 *   node --env-file=.env npx tsx scripts/inspect-login-accounts.ts admin:jobo0602
 *   node --env-file=.env npx tsx scripts/inspect-login-accounts.ts trainer:you@email.com
 *   node --env-file=.env npx tsx scripts/inspect-login-accounts.ts client:@username
 */
import { findClientByIdentifier } from "../src/lib/client-queries";
import { findTrainerByIdentifier } from "../src/lib/trainer-queries";
import { normalizeAdministratorCodeInput } from "../src/lib/admin-code";
import { prisma } from "../src/lib/prisma";

async function main() {
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
      const code = normalizeAdministratorCodeInput(ident);
      const row = await prisma.administrator.findUnique({
        where: { adminCode: code },
        select: { id: true, email: true, adminCode: true, firstName: true, lastName: true },
      });
      console.log(`\nadmin:${code}`, row ? `FOUND (${row.email})` : "NOT FOUND");
      continue;
    }
    if (role === "trainer") {
      const row = await findTrainerByIdentifier(ident);
      console.log(
        `\ntrainer:${ident}`,
        row ? `FOUND id=${row.id} user=${row.username} email=${row.email}` : "NOT FOUND (wrong id or deidentified)",
      );
      continue;
    }
    if (role === "client") {
      const row = await findClientByIdentifier(ident);
      console.log(
        `\nclient:${ident}`,
        row ? `FOUND id=${row.id} user=${row.username} email=${row.email}` : "NOT FOUND (wrong id or deidentified)",
      );
      continue;
    }
    console.log(`Unknown role in: ${raw}`);
  }
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
