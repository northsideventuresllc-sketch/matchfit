import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account | Match Fit",
  description: "Create a Match Fit client account.",
};

export default function ClientSignUpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
