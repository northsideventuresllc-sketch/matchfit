import { Prisma } from "@prisma/client";
import { httpStatusFromResendError } from "@/lib/resend-client";

const DB_BUSY_RE = /SQLITE_BUSY|database is locked|SQLITE_IOERR_BLOCKED|EBUSY/i;

const DB_BUSY_USER_MESSAGE =
  "The database is temporarily busy. Close any other terminal running `npm run dev`, Prisma Studio, or tests on this project, wait a few seconds, and try again. Run `npm run db:locks` to see what is using the file.";

/**
 * Maps thrown errors (DB locks, Resend, Twilio) to a safe JSON `error` string and HTTP status.
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

    if (/Phone delivery failed/i.test(m)) {
      return {
        message: "We could not deliver a code to that phone number. Check the number or try email instead.",
        status: 502,
      };
    }

    if (/TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_FROM_NUMBER/i.test(m)) {
      return {
        message:
          "SMS or voice delivery is not configured. Add Twilio environment variables or use email codes in development.",
        status: 503,
      };
    }
  }

  return { message: fallbackMessage, status: 500 };
}
