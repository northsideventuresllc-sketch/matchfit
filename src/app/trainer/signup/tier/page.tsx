import type { Metadata } from "next";
import TrainerSignupTierClient from "./trainer-signup-tier-client";

export const metadata: Metadata = {
  title: "Choose Account Type | Fitness Pro Signup | Match Fit",
};

export default function TrainerSignupTierPage() {
  return <TrainerSignupTierClient />;
}
