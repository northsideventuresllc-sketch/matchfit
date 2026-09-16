import type { CSSProperties } from "react";

type GradientSpotlightProps = {
  className?: string;
  /** Overrides the default soft white highlight, e.g. "rgba(255,211,78,0.18)". */
  color?: string;
  /** Overrides how far the highlight fades out, e.g. "55%". */
  size?: string;
};

/**
 * The visual half of `useGradientSpotlight` — a soft cursor-tracking
 * highlight. Render it anywhere inside the element the hook's `ref` and
 * mouse handlers are attached to (that element needs `position: relative`
 * and `overflow: hidden` for it to look right, which every current "bubble"
 * card already has). Purely decorative and inert to pointer events.
 */
export function GradientSpotlight({ className = "", color, size }: GradientSpotlightProps) {
  const style: CSSProperties = {};
  if (color) (style as Record<string, string>)["--spot-color"] = color;
  if (size) (style as Record<string, string>)["--spot-size"] = size;

  return (
    <div
      aria-hidden
      className={`mf-gradient-spotlight pointer-events-none absolute inset-0 ${className}`}
      style={style}
    />
  );
}
