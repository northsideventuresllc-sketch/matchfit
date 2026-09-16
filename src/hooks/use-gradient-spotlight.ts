"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Makes a "bubble" card's background gradient subtly track the mouse.
 *
 * Spread the returned handlers onto the bubble's outer container (the
 * element with `relative overflow-hidden`) and render a `<GradientSpotlight />`
 * (see `@/components/gradient-spotlight`) anywhere inside it. Mouse position
 * is written straight to CSS custom properties (`--spot-x` / `--spot-y`) on
 * the DOM node via a ref, throttled with `requestAnimationFrame` — never
 * through React state — so moving the mouse never re-renders the card.
 *
 * A brief pulse (via the `data-spotlight-pulse` attribute, animated in CSS)
 * plays on click/tap. Both effects are skipped when the viewer has
 * `prefers-reduced-motion: reduce` set.
 */
export function useGradientSpotlight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const frame = useRef<number | null>(null);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (pulseTimeout.current !== null) clearTimeout(pulseTimeout.current);
    },
    [],
  );

  const onMouseMove = useCallback((event: ReactMouseEvent<T>) => {
    if (prefersReducedMotion()) return;
    const node = ref.current;
    if (!node) return;

    const { clientX, clientY } = event;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
      node.style.setProperty("--spot-x", `${x}%`);
      node.style.setProperty("--spot-y", `${y}%`);
    });
  }, []);

  const onMouseEnter = useCallback(() => {
    if (prefersReducedMotion()) return;
    ref.current?.setAttribute("data-spotlight-active", "true");
  }, []);

  const onMouseLeave = useCallback(() => {
    ref.current?.removeAttribute("data-spotlight-active");
  }, []);

  const onClick = useCallback(() => {
    if (prefersReducedMotion()) return;
    const node = ref.current;
    if (!node) return;
    // Re-trigger the CSS animation even on rapid repeat clicks.
    node.removeAttribute("data-spotlight-pulse");
    if (pulseTimeout.current !== null) clearTimeout(pulseTimeout.current);
    frame.current = requestAnimationFrame(() => {
      node.setAttribute("data-spotlight-pulse", "true");
      pulseTimeout.current = setTimeout(() => {
        node.removeAttribute("data-spotlight-pulse");
        pulseTimeout.current = null;
      }, 500);
    });
  }, []);

  return { ref, onMouseMove, onMouseEnter, onMouseLeave, onClick };
}
