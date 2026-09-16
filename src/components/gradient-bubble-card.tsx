"use client";

import type { ReactNode } from "react";
import { useGradientSpotlight } from "@/hooks/use-gradient-spotlight";
import { GradientSpotlight } from "@/components/gradient-spotlight";

type GradientBubbleCardProps = {
  className: string;
  spotlightColor?: string;
  children: ReactNode;
};

/**
 * A `<div>` "bubble" card wrapper whose background gradient subtly tracks
 * the mouse on hover/click (see `useGradientSpotlight`). Use this in place
 * of a plain `relative overflow-hidden ...` div when the card lives inside
 * an async Server Component page — only this small wrapper needs to be a
 * Client Component, not the whole page.
 */
export function GradientBubbleCard({ className, spotlightColor, children }: GradientBubbleCardProps) {
  const {
    ref: spotlightRef,
    onMouseMove: onSpotlightMouseMove,
    onMouseEnter: onSpotlightMouseEnter,
    onMouseLeave: onSpotlightMouseLeave,
    onClick: onSpotlightClick,
  } = useGradientSpotlight<HTMLDivElement>();

  return (
    <div
      ref={spotlightRef}
      onMouseMove={onSpotlightMouseMove}
      onMouseEnter={onSpotlightMouseEnter}
      onMouseLeave={onSpotlightMouseLeave}
      onClick={onSpotlightClick}
      className={className}
    >
      {children}
      <GradientSpotlight color={spotlightColor} />
    </div>
  );
}
