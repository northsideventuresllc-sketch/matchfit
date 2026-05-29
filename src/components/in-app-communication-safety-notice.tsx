import Link from "next/link";
import {
  CLIENT_IN_APP_SAFETY_NOTICE,
  TRAINER_IN_APP_SAFETY_NOTICE,
} from "@/lib/tos-off-platform-deterrent";

const POLICY_LINK_CLASS = "text-[#FF9A4A] underline-offset-2 hover:underline";

type InAppCommunicationSafetyNoticeProps = {
  audience: "trainer" | "client";
  /** Compact styling for chat thread footers. */
  variant?: "footer" | "block";
};

function PolicyLinks() {
  return (
    <>
      See our{" "}
      <Link href="/terms" className={POLICY_LINK_CLASS}>
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className={POLICY_LINK_CLASS}>
        Privacy Policy
      </Link>
      .
    </>
  );
}

export function InAppCommunicationSafetyNotice({
  audience,
  variant = "block",
}: InAppCommunicationSafetyNoticeProps) {
  const notice = audience === "trainer" ? TRAINER_IN_APP_SAFETY_NOTICE : CLIENT_IN_APP_SAFETY_NOTICE;

  if (variant === "footer") {
    return (
      <div className="mt-2 rounded-xl border border-white/[0.07] bg-[#08090d]/90 px-3 py-2.5 text-center text-[9px] leading-snug text-white/38 sm:px-4 sm:text-[10px] sm:leading-relaxed">
        <span className="break-words">
          {notice} <PolicyLinks />
        </span>
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-white/70">
      {notice} <PolicyLinks />
    </p>
  );
}
