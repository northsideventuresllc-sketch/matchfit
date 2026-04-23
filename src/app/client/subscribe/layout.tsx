import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscribe | Match Fit",
  description: "Secure subscription checkout for Match Fit.",
};

export default function SubscribeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
