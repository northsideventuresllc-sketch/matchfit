"use client";

import { usePathname } from "next/navigation";
import { MatchFitSocialLinks } from "@/components/match-fit-social-links";

const HIDDEN_PREFIXES = ["/client/dashboard", "/trainer/dashboard", "/admin"];

export function SiteSocialFooter() {
  const pathname = usePathname() ?? "";

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-[#0B0C0F] py-8">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <MatchFitSocialLinks variant="footer" />
      </div>
    </footer>
  );
}
