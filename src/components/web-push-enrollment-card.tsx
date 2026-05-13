"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Props = {
  registerUrl: string;
  /** e.g. "client" | "trainer" for copy only */
  roleLabel: string;
};

export function WebPushEnrollmentCard(props: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const conf = (await fetch("/api/public/web-push/vapid-public-key").then((r) => r.json())) as {
      configured?: boolean;
    };
    setServerConfigured(Boolean(conf.configured));
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    setSubscribed(Boolean(sub));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  async function enablePush() {
    setBusy(true);
    setMsg(null);
    try {
      const conf = (await fetch("/api/public/web-push/vapid-public-key").then((r) => r.json())) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!conf.configured || !conf.publicKey) {
        setMsg("Push is not configured on this server yet.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications were blocked. Enable them for this site in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/match-fit-sw.js", { scope: "/" });
      await reg.update();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(conf.publicKey) as BufferSource,
      });
      const res = await fetch(props.registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(j.error ?? "Could not save subscription.");
        return;
      }
      setMsg("Browser notifications are on for this device.");
      setSubscribed(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not enable push.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch(props.registerUrl, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Browser notifications are off for this device.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not disable push.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
        <p className="text-sm font-semibold text-white/90">Browser notifications</p>
        <p className="mt-1 text-xs text-white/45">
          This browser does not support Web Push. You will still receive in-app and email notifications where enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
      <p className="text-sm font-semibold text-white/90">Browser notifications (Web Push)</p>
      <p className="mt-1 text-xs text-white/45">
        Free lock-screen alerts for your {props.roleLabel} account on this device. You can turn categories on or off
        above; this control only registers this browser with Match Fit.
      </p>
      {!serverConfigured ? (
        <p className="mt-3 text-xs text-amber-200/90">
          Push is not configured for this deployment (missing VAPID keys). Ask your administrator to set{" "}
          <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY</code>,{" "}
          <code className="rounded bg-black/30 px-1">WEB_PUSH_VAPID_PRIVATE_KEY</code>, and{" "}
          <code className="rounded bg-black/30 px-1">WEB_PUSH_CONTACT_EMAIL</code>.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || subscribed}
            onClick={() => void enablePush()}
            className="rounded-lg border border-emerald-400/35 bg-emerald-500/12 px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-100 disabled:opacity-40"
          >
            {busy ? "Working…" : subscribed ? "Enabled on this device" : "Enable on this device"}
          </button>
          {subscribed ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void disablePush()}
              className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/60"
            >
              Remove this device
            </button>
          ) : null}
        </div>
      )}
      {msg ? <p className="mt-3 text-xs text-white/55">{msg}</p> : null}
    </div>
  );
}
