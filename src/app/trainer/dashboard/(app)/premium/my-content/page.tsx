import { redirect } from "next/navigation";

/** Legacy URL: My Content is shown on the Fit Hub & content page. */
export default function TrainerPremiumMyContentRedirectPage() {
  redirect("/trainer/dashboard/premium/fit-hub-content#my-content");
}
