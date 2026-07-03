import "server-only";

import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

/** Loads MATCHFIT_INTERNAL_TOOLS_SECRET from env or platform_secrets. */
export async function resolveInternalToolsSecret(): Promise<string | null> {
  await hydratePlatformEnvFromDatabase();
  const secret = process.env.MATCHFIT_INTERNAL_TOOLS_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}
