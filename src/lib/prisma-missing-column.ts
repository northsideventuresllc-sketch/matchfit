import { Prisma } from "@prisma/client";

/** True when Prisma reports a missing DB column (P2022), e.g. before `migrate deploy` / `db:push`. */
export function isPrismaMissingColumnError(e: unknown, columnNeedle: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2022" && e.message.includes(columnNeedle);
}
