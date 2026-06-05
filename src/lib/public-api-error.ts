import { Prisma } from "@/generated/prisma/client";
import { httpStatusFromResendError } from "@/lib/resend-client";
import { isMissingClientPlatformTrialColumnError } from "@/lib/ensure-client-platform-trial-schema";
import { isPrismaMissingColumnError, isPrismaMissingTableError } from "@/lib/prisma-missing-column";

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
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : String(e.meta?.target ?? "");
      if (target.includes("email")) {
        return { message: "That email is already registered.", status: 409 };
      }
      if (target.includes("username")) {
        return { message: "That username is already taken.", status: 409 };
      }
      return { message: "That account detail is already in use.", status: 409 };
    }
    if (e.code === "P2021" || e.code === "P2022") {
      return {
        message:
          "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes or contact support@match-fit.net if this persists.",
        status: 503,
      };
    }
  }

  if (
    isMissingClientPlatformTrialColumnError(e) ||
    isPrismaMissingTableError(e, "pending_client_registrations") ||
    isPrismaMissingTableError(e, "beta_client_waitlist_entries") ||
    isPrismaMissingColumnError(e, "privacyPolicyAcceptedAt") ||
    isPrismaMissingColumnError(e, "betaClientWaitlistEntryId")
  ) {
    return {
      message:
        "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes or contact support@match-fit.net if this persists.",
      status: 503,
    };
  }

  if (e instanceof Prisma.PrismaClientInitializationError) {
    if (DB_BUSY_RE.test(e.message)) {
      return { message: DB_BUSY_USER_MESSAGE, status: 503 };
    }
  }

  if (e instanceof Error) {
    const m = e.message;
    if (/clients trial columns still missing/i.test(m) || /Set DIRECT_URL on the server/i.test(m)) {
      return {
        message:
          "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes or contact support@match-fit.net if this persists.",
        status: 503,
      };
    }
    if (DB_BUSY_RE.test(m)) {
      return { message: DB_BUSY_USER_MESSAGE, status: 503 };
    }

    if (/AUTH_SECRET must be set/i.test(m)) {
      return {
        message:
          "Sign-in security is not fully configured on the server. Our team has been notified — please try again shortly.",
        status: 503,
      };
    }

    if (/Cookies can only be modified/i.test(m)) {
      return {
        message: "Could not start your sign-up session. Please refresh and try again.",
        status: 500,
      };
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
