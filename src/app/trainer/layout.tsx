import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trainer Portal | Match Fit",
  description: "Trainer sign-in, onboarding, and compliance checklist for Match Fit.",
};

export default function TrainerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
