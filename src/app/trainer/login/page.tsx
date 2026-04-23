import { redirect } from "next/navigation";

/** Legacy URL: trainer sign-in now lives on the dedicated dashboard login page. */
export default function TrainerLoginRedirectPage() {
  redirect("/trainer/dashboard/login");
}
