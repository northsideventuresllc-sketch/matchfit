export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { hydrateStripeEnvFromDatabase } = await import("@/lib/hydrate-stripe-env");
    await hydrateStripeEnvFromDatabase().catch((error) => {
      console.error("[instrumentation] Stripe env hydration failed:", error);
    });
  }
}
