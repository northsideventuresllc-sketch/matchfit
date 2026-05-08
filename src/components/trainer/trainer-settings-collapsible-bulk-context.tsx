"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type OpenSetter = (open: boolean) => void;

type TrainerSettingsCollapsibleBulkContextValue = {
  register: (id: string, setOpen: OpenSetter) => () => void;
  expandAll: () => void;
  collapseAll: () => void;
};

const TrainerSettingsCollapsibleBulkContext =
  createContext<TrainerSettingsCollapsibleBulkContextValue | null>(null);

export function TrainerSettingsCollapsibleBulkProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef(new Map<string, OpenSetter>());

  const register = useCallback((id: string, setOpen: OpenSetter) => {
    mapRef.current.set(id, setOpen);
    return () => {
      mapRef.current.delete(id);
    };
  }, []);

  const expandAll = useCallback(() => {
    mapRef.current.forEach((setOpen) => {
      setOpen(true);
    });
  }, []);

  const collapseAll = useCallback(() => {
    mapRef.current.forEach((setOpen) => {
      setOpen(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      register,
      expandAll,
      collapseAll,
    }),
    [register, expandAll, collapseAll],
  );

  return (
    <TrainerSettingsCollapsibleBulkContext.Provider value={value}>
      {children}
    </TrainerSettingsCollapsibleBulkContext.Provider>
  );
}

export function useTrainerSettingsCollapsibleBulk(): TrainerSettingsCollapsibleBulkContextValue | null {
  return useContext(TrainerSettingsCollapsibleBulkContext);
}

export function TrainerSettingsCollapsibleBulkBar() {
  const bulk = useTrainerSettingsCollapsibleBulk();
  if (!bulk) return null;

  const btnClass =
    "inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-4 text-xs font-black uppercase tracking-[0.1em] text-white/80 transition hover:border-[#FF7E00]/35 hover:bg-[#FF7E00]/10 hover:text-white";

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
      <button type="button" className={btnClass} onClick={bulk.collapseAll}>
        Collapse all
      </button>
      <button type="button" className={btnClass} onClick={bulk.expandAll}>
        Open all
      </button>
    </div>
  );
}
