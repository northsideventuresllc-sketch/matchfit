import { redirect } from "next/navigation";

/** Legacy URL: client home now lives under `/client/dashboard`. */
export default function ClientAccountRedirectPage() {
  redirect("/client/dashboard");
}
