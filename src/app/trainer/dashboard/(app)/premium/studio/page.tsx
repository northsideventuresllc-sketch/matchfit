import { redirect } from "next/navigation";

/** Legacy URL: studio composer and My Content now live under fit-hub-content. */
export default function TrainerPremiumStudioRedirectPage() {
  redirect("/trainer/dashboard/premium/fit-hub-content");
}
