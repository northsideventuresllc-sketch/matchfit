"use client";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function StayLoggedInPanel(props: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3">
      <input
        type="checkbox"
        checked={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00] focus:ring-2 focus:ring-[#FF7E00]/40 focus:ring-offset-0 disabled:opacity-50"
      />
      <span className="text-sm leading-relaxed text-white/70">
        Stay logged in on this device (longer session). Turn this off on shared computers.
      </span>
    </label>
  );
}
