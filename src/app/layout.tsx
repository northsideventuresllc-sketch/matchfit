import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DevAccountShortcuts } from "@/components/dev-account-shortcuts";
import { GoogleAdsGtag } from "@/components/google-ads-gtag";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Match Fit",
  description: "Find coaches who fit your goals — Atlanta beta.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Match Fit",
  },
  icons: {
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF7E00",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleAdsGtag />
        {children}
        {process.env.NODE_ENV === "development" ? <DevAccountShortcuts /> : null}
      </body>
    </html>
  );
}
