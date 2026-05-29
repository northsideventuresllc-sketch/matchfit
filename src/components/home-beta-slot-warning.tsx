"use client";

import Link from "next/link";
import { useBetaLaunchStatus } from "@/hooks/use-beta-launch-status";

export function HomeBetaSlotWarning() {
  const { status } = useBetaLaunchStatus();

  if (!status?.gatesEnabled) return null;

  const trainerTotalFull = status.trainerTotalCapFull === true;
  const clientFull = status.clientWaitlistOpen;
  const trainerBetaLeft = status.trainerSlotsRemaining;
  const clientBetaLeft = status.clientSlotsRemaining;
  const trainerFoundingLeft = status.trainerFoundingRemaining;
  const clientFoundingLeft = status.clientFoundingRemaining;
  const inPersonFull = status.trainerInPersonCapFull === true && !trainerTotalFull;

  const bothFull = trainerTotalFull && clientFull;
  const anyFull = trainerTotalFull || clientFull;

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
      ) : trainerTotalFull ? (
        <>
          <span className="font-bold text-amber-300">Coach beta slots are full.</span> Trainers:{" "}
          <Link href="/waitlist/trainer" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
            join the waitlist
          </Link>{" "}
          to reserve your username.
          {clientBetaLeft !== null && clientBetaLeft <= 5 && clientBetaLeft > 0 ? (
            <>
              {" "}
              Only <span className="font-bold text-[#FFD34E]">{clientBetaLeft}</span> client beta{" "}
              {clientBetaLeft === 1 ? "slot" : "slots"} remaining!
            </>
          ) : null}
        </>
      ) : clientFull ? (
        <>
          <span className="font-bold text-amber-300">Client beta slots are full.</span> Clients:{" "}
          <Link href="/waitlist/client" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
            join the waitlist
          </Link>{" "}
          to reserve your username.
          {trainerBetaLeft !== null && trainerBetaLeft <= 5 && trainerBetaLeft > 0 ? (
            <>
              {" "}
              Only <span className="font-bold text-[#FFD34E]">{trainerBetaLeft}</span> coach beta{" "}
              {trainerBetaLeft === 1 ? "slot" : "slots"} remaining!
            </>
          ) : null}
        </>
      ) : (
        <>
          <span className="font-semibold text-white/85">Beta is live</span> with limited capacity. Clients can sign up
          anywhere in the U.S.; in-person coaching launches first in the Atlanta metro geocircle.{" "}
          {trainerBetaLeft !== null && (
            <>
              <span className="font-bold text-[#FFD34E]">{trainerBetaLeft}</span> coach beta{" "}
              {trainerBetaLeft === 1 ? "slot" : "slots"}
            </>
          )}
          {trainerBetaLeft !== null && clientBetaLeft !== null && " and "}
          {clientBetaLeft !== null && (
            <>
              <span className="font-bold text-[#FFD34E]">{clientBetaLeft}</span> client beta{" "}
              {clientBetaLeft === 1 ? "slot" : "slots"}
            </>
          )}{" "}
          open.
          {trainerFoundingLeft !== null && trainerFoundingLeft > 0 ? (
            <>
              {" "}
              Founding coach registration pricing ({trainerFoundingLeft} left) and client trial promos (
              {clientFoundingLeft ?? 0} left) still apply for early signups.
            </>
          ) : null}{" "}
          <Link href="/promos" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
            View promos
          </Link>
          {inPersonFull ? (
            <>
              {" "}
              · Atlanta in-person coach spots are full —{" "}
              <Link href="/waitlist/trainer" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
                join the in-person waitlist
              </Link>{" "}
              or sign up for virtual / DIY coaching.
            </>
          ) : status.trainerWaitlistOpen ? (
            <>
              {" "}
              · Some coach buckets are full —{" "}
              <Link href="/waitlist/trainer" className="font-semibold text-[#FFD34E] underline-offset-2 hover:underline">
                trainer waitlist
              </Link>{" "}
              open for matching offerings.
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
