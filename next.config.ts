import type { NextConfig } from "next";

/**
 * Baseline CSP for every page. Built from the third-party origins the app
 * actually loads on every page via the root layout (Google Ads gtag, Meta
 * Pixel, Vercel Analytics — same-origin) plus Stripe Elements and Cloudflare
 * Turnstile used on specific auth/payment pages, and the Supabase Auth
 * browser client. Keep this list in sync if a new third-party script/frame
 * is added anywhere in the app — an unlisted origin gets silently blocked.
 */
const BASELINE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://m.stripe.com https://q.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://www.facebook.com https://connect.facebook.net https://*.supabase.co",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "bcryptjs", "stripe", "web-push"],
  async headers() {
    const baselineSecurityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: BASELINE_CSP },
      // HSTS only makes sense once traffic is actually served over HTTPS in
      // production — sending it on local/dev HTTP would just be inert noise.
      ...(process.env.VERCEL_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
        : []),
    ];

    return [
      {
        // Applies to every route, page, and static asset. The Stripe Elements
        // page (/client/subscribe) previously had its own narrower,
        // Stripe-only CSP; that page's requirements (js.stripe.com,
        // api/m/q.stripe.com) are now folded into this single baseline policy
        // instead of keeping a second, easy-to-drift CSP definition around.
        source: "/:path*",
        headers: baselineSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
