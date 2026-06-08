import {
  defaultPreferredNameFromSignup,
  resolveUniqueClientUsername,
} from "@/lib/client-default-profile-fields";
import { getValidBetaInvite } from "@/lib/beta-waitlist-service";
import type { z } from "zod";
import { registerProfileSchema } from "@/lib/validations/client-register";

export type RegisterProfileInput = z.infer<typeof registerProfileSchema>;

export type EnrichedRegisterProfile = RegisterProfileInput & {
  preferredName: string;
  username: string;
};

export async function enrichClientRegisterProfile(
  body: Omit<RegisterProfileInput, "preferredName" | "username"> & {
    preferredName?: string;
    username?: string;
    betaInviteToken?: string;
  },
): Promise<EnrichedRegisterProfile> {
  const email = body.email.trim().toLowerCase();
  const preferredName = defaultPreferredNameFromSignup(body.firstName, body.lastName, body.preferredName);

  let reservedUsername: string | undefined;
  if (body.betaInviteToken) {
    const inv = await getValidBetaInvite(body.betaInviteToken);
    if (inv?.role === "client" && inv.email === email && inv.desiredUsername?.trim()) {
      reservedUsername = inv.desiredUsername.trim();
    }
  }

  const username = body.username?.trim()
    ? body.username.trim()
    : await resolveUniqueClientUsername(email, reservedUsername ?? body.username);

  return {
    ...body,
    preferredName,
    username,
  };
}
