import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Settings | Match Fit",
};

export default function ClientSettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
