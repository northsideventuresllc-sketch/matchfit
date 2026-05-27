import { Prisma } from "@/generated/prisma/client";
import { httpStatusFromResendError } from "@/lib/resend-client";

const DB_BUSY_RE = /SQLITE_BUSY|database is locked|SQLITE_IOERR_BLOCKED|EBUSY/i;

const DB_BUSY_USER_MESSAGE =
  "The database is temporarily busy. Close any other terminal running `npm run dev`, Prisma Studio, or tests on this project, wait a few seconds, and try again. Run `npm run db:locks` to see what is using the file.";

/**
 * Maps thrown errors (DB locks, Resend) to a safe JSON `error` string and HTTP status.
 * Logs the original error to the server console.
 */
export function publicApiErrorFromUnknown(
  e: unknown,
  fallbackMessage: string,
  opts?: { logLabel?: string },
): { message: string; status: number } {
  const label = opts?.logLabel ?? "[api]";
  console.error(label, e);

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2034") {
      return { message: DB_BUSY_USER_MESSAGE, status: 503 };
    }
  }

  if (e instanceof Prisma.PrismaClientInitializationError) {
    if (DB_BUSY_RE.test(e.message)) {
      return { message: DB_BUSY_USER_MESSAGE, status: 503 };
    }
  }

  if (e instanceof Error) {
    const m = e.message;
    if (DB_BUSY_RE.test(m)) {
      return { message: DB_BUSY_USER_MESSAGE, status: 503 };
    }

    if (/Resend HTTP|RESEND_API_KEY is not set/i.test(m)) {
      const st = httpStatusFromResendError(m);
      const message =
        st === 422 || st === 403
          ? "We could not send that email (delivery was rejected). In local development, verification mail is redirected to the developer inbox only—see project docs."
          : "We could not send the verification email. Please try again in a moment.";
      return { message, status: st >= 400 && st < 600 ? st : 502 };
    }

  }

  return { message: fallbackMessage, status: 500 };
}
