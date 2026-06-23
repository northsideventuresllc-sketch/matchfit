import type { Metadata } from "next";
import TrainerAccountTierClient from "./trainer-account-tier-client";

export const metadata: Metadata = {
  title: "Account Type | Fitness Pro Dashboard | Match Fit",
};

export default function TrainerAccountTierPage() {
  return <TrainerAccountTierClient />;
}
