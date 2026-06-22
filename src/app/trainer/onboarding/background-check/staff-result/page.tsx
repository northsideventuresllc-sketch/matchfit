import Link from "next/link";

type Props = {
  searchParams: Promise<{ outcome?: string; message?: string }>;
};

export default async function BackgroundCheckStaffResultPage({ searchParams }: Props) {
  const sp = await searchParams;
  const outcome = (sp.outcome ?? "unknown").trim();
  const message = sp.message?.trim();

  const title =
    outcome === "invite_confirmed"
      ? "Invitation confirmed"
      : outcome === "approve"
        ? "Background check approved"
        : outcome === "deny"
          ? "Background check denied"
          : outcome === "invalid"
            ? "Link invalid or expired"
            : "Action recorded";

  const body =
    message ??
    (outcome === "invite_confirmed"
      ? "The fitness pro was notified by email and in-app alert."
      : outcome === "approve"
        ? "The fitness pro profile was updated to Approved."
        : outcome === "deny"
          ? "The fitness pro profile was updated and escrow was adjusted."
          : "If this link expired, open the latest email from Match Fit support.");

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-16 text-center text-white">
      <h1 className="text-xl font-black">{title}</h1>
      <p className="mt-4 text-sm text-white/65">{body}</p>
      <Link
        href="/admin"
        className="mt-8 inline-flex rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 hover:border-white/30"
      >
        Admin home
      </Link>
    </main>
  );
}
