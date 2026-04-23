import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trainer Dashboard | Match Fit",
  description: "Sign in to your Match Fit trainer dashboard or continue onboarding.",
};

export default function TrainerDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
