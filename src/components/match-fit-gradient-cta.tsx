import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef } from "react";

export const MATCH_FIT_GRADIENT_BG =
  "bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]";

type CtaSize = "md" | "lg";

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Mobile-safe Match Fit orange gradient CTA classes (no nested absolute layers). */
export function matchFitGradientCtaClassName(
  extra?: string,
  options?: { size?: CtaSize; fullWidth?: boolean; shadow?: boolean },
) {
  const size = options?.size ?? "md";
  const fullWidth = options?.fullWidth !== false;
  const shadow = options?.shadow !== false;

  return joinClasses(
    "mf-gradient-cta inline-flex items-center justify-center rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F]",
    MATCH_FIT_GRADIENT_BG,
    "touch-manipulation transition disabled:opacity-50",
    shadow && "max-md:shadow-none md:shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)]",
    "md:hover:opacity-95 md:active:opacity-90",
    size === "lg" ? "min-h-[3.75rem] text-base sm:min-h-[4rem] sm:text-[0.95rem]" : "min-h-[3.25rem]",
    fullWidth && "w-full",
    extra,
  );
}

type MatchFitGradientButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: CtaSize;
  fullWidth?: boolean;
  shadow?: boolean;
};

export function MatchFitGradientButton({
  className,
  size,
  fullWidth,
  shadow,
  type = "button",
  ...props
}: MatchFitGradientButtonProps) {
  return (
    <button
      type={type}
      className={matchFitGradientCtaClassName(className, { size, fullWidth, shadow })}
      {...props}
    />
  );
}

type MatchFitGradientLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  size?: CtaSize;
  fullWidth?: boolean;
  shadow?: boolean;
};

export function MatchFitGradientLink({
  className,
  size,
  fullWidth,
  shadow,
  ...props
}: MatchFitGradientLinkProps) {
  return (
    <Link
      className={matchFitGradientCtaClassName(className, { size, fullWidth, shadow })}
      {...props}
    />
  );
}
