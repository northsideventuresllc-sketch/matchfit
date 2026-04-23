import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security & 2FA | Match Fit",
};

export default function ClientSettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
