import type { Metadata } from "next";
import TrainerSignupDocsClient from "./trainer-signup-docs-client";

export const metadata: Metadata = {
  title: "Required Documents | Fitness Pro Signup | Match Fit",
};

export default function TrainerSignupDocsPage() {
  return <TrainerSignupDocsClient />;
}
