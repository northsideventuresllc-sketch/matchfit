import { redirect } from "next/navigation";

/** Legacy URL: My Content is shown on the FitHub & Content page. */
export default function TrainerPremiumMyContentRedirectPage() {
  redirect("/trainer/dashboard/premium/fit-hub-content#my-content");
}
