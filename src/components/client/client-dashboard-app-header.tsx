"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { postClientLogout } from "@/lib/client-logout";

type NotifRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  read: boolean;
  createdAt: string;
};

type Props = {
  preferredName: string;
  profileImageUrl: string | null;
  backHref?: string;
  backLabel?: string;
  initialUnreadCount: number;
};

function badgeLabel(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

export function ClientDashboardAppHeader(props: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [unread, setUnread] = useState(props.initialUnreadCount);
  const [notifs, setNotifs] = useState<NotifRow[] | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);

  const initial = props.preferredName.trim().charAt(0).toUpperCase() || "?";
  const avatarSrc = props.profileImageUrl ?? "";

  const loadNotifs = useCallback(async () => {
    setNotifBusy(true);
    try {
      const res = await fetch("/api/client/notifications");
      const data = (await res.json()) as { notifications?: NotifRow[]; unreadCount?: number; error?: string };
      if (res.ok) {
        setNotifs(data.notifications ?? []);
        if (typeof data.unreadCount === "number") setUnread(data.unreadCount);
      }
    } finally {
      setNotifBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const id = window.setTimeout(() => {
      void loadNotifs();
    }, 0);
    return () => window.clearTimeout(id);
  }, [notifOpen, loadNotifs]);

  useEffect(() => {
    if (!menuOpen && !notifOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (menuOpen && !wrapRef.current?.contains(t)) setMenuOpen(false);
      if (notifOpen && !notifWrapRef.current?.contains(t)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, notifOpen]);

  async function toggleRead(n: NotifRow) {
    const nextRead = !n.read;
    const res = await fetch(`/api/client/notifications/${encodeURIComponent(n.id)}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: nextRead }),
    });
    const data = (await res.json()) as { unreadCount?: number; error?: string };
    if (res.ok && typeof data.unreadCount === "number") {
      setUnread(data.unreadCount);
      setNotifs((list) =>
        list?.map((x) => (x.id === n.id ? { ...x, read: nextRead } : x)) ?? null,
      );
      router.refresh();
    }
  }

  async function logout() {
    setLogoutBusy(true);
    try {
      await postClientLogout();
      router.push("/client");
      router.refresh();
    } finally {
      setLogoutBusy(false);
      setMenuOpen(false);
    }
  }

  const b = badgeLabel(unread);
  const unreadDropdownItems = notifs?.filter((n) => !n.read) ?? [];

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        {props.backHref ? (
          <Link
            href={props.backHref}
            className="text-xs font-semibold uppercase tracking-wide text-white/45 transition hover:text-white/70"
          >
            {props.backLabel ?? "Back"}
          </Link>
        ) : (
          <Link href="/" className="text-xs font-semibold uppercase tracking-wide text-white/45 transition hover:text-white/70">
            Home
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <div className="relative" ref={notifWrapRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative rounded-xl border border-white/12 bg-[#0E1016]/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/80 outline-none ring-[#FF7E00]/30 transition hover:border-white/20 hover:text-white focus-visible:ring-2 sm:px-4 sm:text-xs"
          >
            NOTIFICATIONS
            {b ? (
              <span className="absolute -right-1 -top-1 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[#E32B2B] px-1 text-[9px] font-black text-white shadow-[0_0_12px_rgba(227,43,43,0.55)]">
                {b}
              </span>
            ) : null}
          </button>

          {notifOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[min(100vw-2.5rem,22rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#12151C] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.9)]"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FF7E00]/90">UNREAD ALERTS</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifBusy && !notifs ? (
                  <p className="px-4 py-6 text-center text-xs text-white/45">Loading…</p>
                ) : unreadDropdownItems.length ? (
                  <ul className="divide-y divide-white/[0.06]">
                    {unreadDropdownItems.map((n) => (
                      <li key={n.id} className="flex gap-2 px-3 py-3">
                        <button
                          type="button"
                          title={n.read ? "Mark unread" : "Mark read"}
                          onClick={() => void toggleRead(n)}
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-black transition ${
                            n.read
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                              : "border-white/15 bg-white/[0.04] text-white/35 hover:border-[#FF7E00]/35"
                          }`}
                        >
                          {n.read ? "✓" : ""}
                        </button>
                        <div className="min-w-0 flex-1">
                          {n.linkHref ? (
                            <Link
                              href={n.linkHref}
                              className="block text-left"
                              onClick={() => setNotifOpen(false)}
                            >
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/90">{n.title}</p>
                              <p className="mt-1 text-xs leading-snug text-white/50">{n.body}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/30">
                                {new Date(n.createdAt).toLocaleString()}
                              </p>
                            </Link>
                          ) : (
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/90">{n.title}</p>
                              <p className="mt-1 text-xs leading-snug text-white/50">{n.body}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/30">
                                {new Date(n.createdAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-xs text-white/45">
                    {notifs?.length
                      ? "You are all caught up. Open Notifications Center to review read items."
                      : "No notifications yet."}
                  </p>
                )}
              </div>
              <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">
                <Link
                  href="/client/dashboard/notifications"
                  className="flex w-full items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-3 py-2.5 text-center text-xs font-black uppercase tracking-[0.12em] text-[#FF7E00] transition hover:border-[#FF7E00]/55 hover:bg-[#FF7E00]/15"
                  onClick={() => setNotifOpen(false)}
                >
                  Notifications Center
                </Link>
                <Link
                  href="/client/dashboard/notification-settings"
                  className="block text-center text-xs font-semibold text-white/50 underline-offset-2 transition hover:text-white/80 hover:underline"
                  onClick={() => setNotifOpen(false)}
                >
                  Notification settings
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <Link
          href="/client/dashboard/daily-questionnaire"
          className="rounded-xl border border-white/12 bg-[#0E1016]/80 px-2.5 py-2 text-[9px] font-black uppercase leading-tight tracking-[0.1em] text-white/80 outline-none ring-[#FF7E00]/30 transition hover:border-white/20 hover:text-white focus-visible:ring-2 sm:px-3 sm:text-[10px] sm:tracking-[0.12em]"
        >
          DAILY
          <br />
          QUESTIONARE
        </Link>

        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#0E1016] text-sm font-black text-white/90 outline-none ring-[#FF7E00]/40 transition hover:border-white/25 focus-visible:ring-2"
            aria-label="Account menu"
          >
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span aria-hidden>{initial}</span>
            )}
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[14rem] overflow-hidden rounded-xl border border-white/10 bg-[#12151C] py-1 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)]"
            >
              <Link
                role="menuitem"
                href="/client/dashboard"
                className="block px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                role="menuitem"
                href="/client/dashboard/messages"
                className="block px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
              >
                Chats
              </Link>
              <Link
                role="menuitem"
                href="/client/dashboard/fithub-settings"
                className="block px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
              >
                FitHub Settings
              </Link>
              <Link
                role="menuitem"
                href="/client/dashboard/billing"
                className="block px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
              >
                Billing Settings
              </Link>
              <Link
                role="menuitem"
                href="/client/dashboard/notification-settings"
                className="block px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
              >
                Notification Settings
              </Link>
              <Link
                role="menuitem"
                href="/client/settings"
                className="block px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.06]"
                onClick={() => setMenuOpen(false)}
              >
                Account Settings
              </Link>
              <button
                role="menuitem"
                type="button"
                disabled={logoutBusy}
                onClick={() => void logout()}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                {logoutBusy ? "Signing out…" : "Log Out"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
