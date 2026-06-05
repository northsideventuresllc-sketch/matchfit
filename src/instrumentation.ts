export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { hydratePlatformEnvFromDatabase } = await import("@/lib/hydrate-platform-env");
    await hydratePlatformEnvFromDatabase().catch((error) => {
      console.error("[instrumentation] Platform env hydration failed:", error);
    });
  }
}
