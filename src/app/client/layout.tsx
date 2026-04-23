import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Portal | Match Fit",
  description: "Log in or create a Match Fit client account. Stay signed in to land on your dashboard next time.",
};

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
