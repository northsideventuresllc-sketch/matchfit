"use client";

import { useEffect } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

/** True if the event path includes a field where typing should not trigger account switching. */
function keyEventTouchesEditable(e: KeyboardEvent): boolean {
  const path = e.composedPath();
  for (const node of path) {
    if (isEditableElement(node)) return true;
  }
  return false;
}

/**
 * In development, Mac-style shortcuts (⌘⌥⇧) jump into configured test accounts (see .env.example).
 * Listens on window capture so shortcuts work even when pages stop keydown propagation.
 * Uses Command+Option+Shift so we avoid browser defaults like ⌘⇧T (reopen closed tab).
 */
export function DevAccountShortcuts() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    async function switchAccount(target: "client" | "trainer") {
      try {
        const res = await fetch("/api/dev/switch-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ target }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string; next?: string } | null;
        if (!res.ok) {
          console.warn("[Match Fit dev shortcut]", data?.error ?? res.statusText);
          return;
        }
        if (data?.next) {
          navigateWithFullLoad(data.next);
        }
      } catch (e) {
        console.warn("[Match Fit dev shortcut] request failed", e);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      // ⌘ Command + ⌥ Option + ⇧ Shift (Mac); metaKey is ⌘ on Mac, Windows (⊞) on PC keyboards.
      if (!e.metaKey || !e.altKey || !e.shiftKey || e.ctrlKey) return;
      if (keyEventTouchesEditable(e)) return;

      if (e.code === "KeyC") {
        e.preventDefault();
        e.stopPropagation();
        void switchAccount("client");
        return;
      }
      if (e.code === "KeyT") {
        e.preventDefault();
        e.stopPropagation();
        void switchAccount("trainer");
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
