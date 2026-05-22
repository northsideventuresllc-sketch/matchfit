"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BetaStatus = {
  gatesEnabled: boolean;
  trainerCap: number | null;
  clientCap: number | null;
  trainerCount: number | null;
  clientCount: number | null;
  trainerWaitlistOpen: boolean;
  clientWaitlistOpen: boolean;
};

export function HomeBetaSlotWarning() {
  const [status, setStatus] = useState<BetaStatus | null>(null);

  useEffect(() => {
    void fetch("/api/public/beta-launch-status")
      .then((r) => r.json())
      .then((d: BetaStatus) => setStatus(d))
      .catch(() => null);
  }, []);

  if (!status?.gatesEnabled) return null;

  const trainerFull = status.trainerWaitlistOpen;
  const clientFull = status.clientWaitlistOpen;
  const trainerLeft =
    status.trainerCap !== null && status.trainerCount !== null
      ? Math.max(0, status.trainerCap - status.trainerCount)
      : null;
  const clientLeft =
    status.clientCap !== null && status.clientCount !== null
      ? Math.max(0, status.clientCap - status.clientCount)
      : null;

  const bothFull = trainerFull && clientFull;
  const anyFull = trainerFull || clientFull;

  return (
    <div
      className={`mb-4 rounded-2xl border px-5 py-4 text-center text-sm leading-relaxed ${
        bothFull
          ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
          : anyFull
            ? "border-amber-400/20 bg-amber-500/[0.07] text-amber-100/90"
            : "border-[#FF7E00]/20 bg-[#FF7E00]/[0.06] text-white/75"
      }`}
    >
      {bothFull ? (
        <>
          <span className="font-bold text-amber-300">Beta slots are full.</span> Join the waitlist to reserve
          your username.{" "}
          <Link href="/waitlist/client" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
            Clients
          </Link>{" "}
          &amp;{" "}
          <Link href="/waitlist/trainer" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
            trainers
          </Link>{" "}
          — you will be notified when new spots open.
        </>
      ) : trainerFull ? (
        <>
          <span className="font-bold text-amber-300">Trainer spots are full.</span> Trainers:{" "}
          <Link href="/waitlist/trainer" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
            join the waitlist
          </Link>{" "}
          to reserve your username.{clientLeft !== null && clientLeft <= 5 && clientLeft > 0 ? (
            <> Only <span className="font-bold text-[#FFD34E]">{clientLeft}</span> client {clientLeft === 1 ? "spot" : "spots"} remaining!</>
          ) : null}
        </>
      ) : clientFull ? (
        <>
          <span className="font-bold text-amber-300">Client spots are full.</span> Clients:{" "}
          <Link href="/waitlist/client" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
            join the waitlist
          </Link>{" "}
          to reserve your username.{trainerLeft !== null && trainerLeft <= 3 && trainerLeft > 0 ? (
            <> Only <span className="font-bold text-[#FFD34E]">{trainerLeft}</span> trainer {trainerLeft === 1 ? "spot" : "spots"} remaining!</>
          ) : null}
        </>
      ) : (
        <>
          <span className="font-semibold text-white/85">Beta is live</span> with limited founding slots.{" "}
          {trainerLeft !== null && (
            <>
              <span className="font-bold text-[#FFD34E]">{trainerLeft}</span> trainer{" "}
              {trainerLeft === 1 ? "spot" : "spots"}
            </>
          )}
          {trainerLeft !== null && clientLeft !== null && " and "}
          {clientLeft !== null && (
            <>
              <span className="font-bold text-[#FFD34E]">{clientLeft}</span> client{" "}
              {clientLeft === 1 ? "spot" : "spots"}
            </>
          )}
          {" "}remaining with founding promos active.{" "}
          <Link href="/promos" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
            View promos
          </Link>
        </>
      )}
    </div>
  );
}
