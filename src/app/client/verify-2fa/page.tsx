import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ next?: string }> };

/** Legacy URL — unified flow lives at `/verify-2fa`. */
export default async function LegacyClientVerify2faRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.next ? `?next=${encodeURIComponent(sp.next)}` : "";
  redirect(`/verify-2fa${q}`);
}
