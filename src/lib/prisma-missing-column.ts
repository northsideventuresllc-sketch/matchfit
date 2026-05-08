import { Prisma } from "@prisma/client";

/** True when Prisma reports a missing DB column (P2022), e.g. before `migrate deploy` / `db:push`. */
export function isPrismaMissingColumnError(e: unknown, columnNeedle: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2022" && e.message.includes(columnNeedle);
}

/** True when Prisma reports a missing table (P2021), e.g. before pending migrations are applied. */
export function isPrismaMissingTableError(e: unknown, tableNeedle: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2021" && e.message.includes(tableNeedle);
}

/**
 * True when the generated Prisma Client predates a schema field (run `npx prisma generate`), or the field
 * is otherwise invalid for the current client build — Prisma throws before hitting the DB.
 */
export function isPrismaUnknownModelFieldError(e: unknown, fieldNeedle: string): boolean {
  if (!(e instanceof Prisma.PrismaClientValidationError)) return false;
  const m = e.message;
  if (!m.includes(fieldNeedle)) return false;
  return (
    m.includes("Unknown field") ||
    m.includes("Unknown argument") ||
    m.includes("Unknown arg `") ||
    m.includes("Unknown arg ")
  );
}
