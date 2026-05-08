import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTrainerTransactionsForYear, loadTrainerTransactionYears } from "@/lib/trainer-client-management-dashboard";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TrainerClientManagementTransactionsPage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) redirect("/trainer/dashboard/login");

  const sp = await props.searchParams;
  const years = await loadTrainerTransactionYears(trainerId);
  const y = sp.year ? parseInt(sp.year, 10) : years[0] ?? new Date().getUTCFullYear();
  const year = Number.isFinite(y) ? y : new Date().getUTCFullYear();
  const rows = await loadTrainerTransactionsForYear(trainerId, year);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 text-left text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Purchases &amp; Payouts</h1>
        <Link
          href="/trainer/dashboard/client-management"
          className="text-xs font-bold uppercase tracking-[0.1em] text-[#FF9A4A] underline-offset-4 hover:underline"
        >
          ← Client management
        </Link>
      </div>
      <p className="mt-2 text-xs text-white/50">
        Calendar-year view of Stripe checkout completions. Open a printable page to save a PDF from your browser.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {years.map((yr) => (
          <Link
            key={yr}
            href={`/trainer/dashboard/client-management/transactions?year=${yr}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] ${
              yr === year ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-[#FFD34E]" : "border-white/10 text-white/60 hover:border-white/20"
            }`}
          >
            {yr}
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <a
          href={`/api/trainer/dashboard/client-management/earnings-print?year=${year}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold uppercase tracking-[0.1em] text-sky-300 underline-offset-4 hover:underline"
        >
          Printable earnings ({year}) →
        </a>
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-center text-white/45">No rows for this year.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-white/[0.08] bg-[#12151c]/80 px-4 py-3">
              <p className="text-xs text-white/45">{new Date(r.completedAt).toLocaleString()}</p>
              <p className="mt-1 font-medium text-white/90">{r.purchaseLabelSnapshot ?? "Purchase"}</p>
              <p className="mt-1 text-xs text-white/55">
                Billed ${(Math.max(0, r.amountCents) / 100).toFixed(2)}
                {r.ledgerNetAfterFeesCents != null
                  ? ` · Net after fees (est.) $${(Math.max(0, r.ledgerNetAfterFeesCents) / 100).toFixed(2)}`
                  : ""}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
