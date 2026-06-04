import { redirect } from "next/navigation";
import { getSessionTrainerId } from "@/lib/session";
import TrainerSignupTermsClient from "./trainer-signup-terms-client";

export const dynamic = "force-dynamic";

export default async function TrainerSignupTermsPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/signup");
  }
  return <TrainerSignupTermsClient />;
}
