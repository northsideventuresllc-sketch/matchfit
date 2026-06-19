import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fitness Pro Dashboard | Match Fit",
  description: "Sign in to your Match Fit Fitness Pro dashboard or continue onboarding.",
};

export default function TrainerDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
