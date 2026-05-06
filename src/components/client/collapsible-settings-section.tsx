"use client";

import { useId, useState } from "react";

type Props = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSettingsSection(props: Props) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const panelId = useId();

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151C]/90 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="relative w-full px-6 py-6 text-left transition hover:bg-white/[0.03] sm:px-8 sm:py-8"
      >
        <span
          className="absolute right-6 top-6 shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs font-black text-white/60"
          aria-hidden
        >
          {open ? "−" : "+"}
        </span>
        <div className="mx-auto min-w-0 max-w-xl pr-10 text-center">
          <h2 className="text-lg font-black tracking-tight text-white">{props.title}</h2>
          {props.description ? (
            <p className="mt-2 text-sm leading-relaxed text-white/55">{props.description}</p>
          ) : null}
        </div>
      </button>
      {open ? (
        <div
          id={panelId}
          className="border-t border-white/[0.08] px-6 pb-6 pt-2 text-left sm:px-8 sm:pb-8"
        >
          {props.children}
        </div>
      ) : null}
    </section>
  );
}
