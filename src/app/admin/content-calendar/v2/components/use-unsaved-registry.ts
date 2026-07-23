"use client";

import { useCallback, useRef, useState } from "react";

export type SaveFn = () => Promise<void>;

type Entry = { dirty: boolean; save: SaveFn };

/**
 * Central registry of unsaved draft edits across the tabs. Each editable surface registers itself
 * with a key, its current dirty flag, and a save function. The parent uses `anyDirty` to gate the
 * beforeunload prompt, the in-app leave-confirmation dialog, and the auto-save timer, and calls
 * `saveAll()` from the Save Progress button / auto-save tick.
 *
 * Entries live in a ref (so registering does not itself trigger renders); `anyDirty` is the only
 * piece of React state and only flips when the aggregate dirty status actually changes.
 */
export function useUnsavedRegistry() {
  const registry = useRef<Map<string, Entry>>(new Map());
  const [anyDirty, setAnyDirty] = useState(false);

  const recompute = useCallback(() => {
    let dirty = false;
    for (const entry of registry.current.values()) {
      if (entry.dirty) {
        dirty = true;
        break;
      }
    }
    setAnyDirty((prev) => (prev === dirty ? prev : dirty));
  }, []);

  const setEntry = useCallback(
    (key: string, dirty: boolean, save: SaveFn) => {
      registry.current.set(key, { dirty, save });
      recompute();
    },
    [recompute],
  );

  const removeEntry = useCallback(
    (key: string) => {
      if (registry.current.delete(key)) recompute();
    },
    [recompute],
  );

  const saveAll = useCallback(async () => {
    const pending = [...registry.current.entries()].filter(([, entry]) => entry.dirty);
    for (const [, entry] of pending) {
      await entry.save();
    }
    // Optimistically mark everything clean; surfaces re-register their true state on the next render.
    for (const [key, entry] of registry.current.entries()) {
      registry.current.set(key, { ...entry, dirty: false });
    }
    recompute();
  }, [recompute]);

  return { setEntry, removeEntry, saveAll, anyDirty };
}

export type UnsavedRegistry = ReturnType<typeof useUnsavedRegistry>;
