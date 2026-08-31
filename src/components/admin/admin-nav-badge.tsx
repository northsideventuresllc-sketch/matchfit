/** Same red-dot notification badge used on the client/trainer dashboard headers, ported for admin nav. */
export function adminNavBadgeLabel(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

export function AdminNavBadge(props: { count: number }) {
  const label = adminNavBadgeLabel(props.count);
  if (!label) return null;
  return (
    <span
      className="absolute -right-1.5 -top-1.5 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[#E32B2B] px-1 text-[9px] font-black text-white shadow-[0_0_12px_rgba(227,43,43,0.55)]"
      aria-label={`${props.count} needing attention`}
    >
      {label}
    </span>
  );
}
