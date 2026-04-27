import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";

export type FinalizeResult =
  | { ok: true; clientId: string; alreadyCompleted?: boolean }
  | { ok: false; error: string };

/**
 * Creates the Client row only after Stripe reports an active paid subscription.
 * Idempotent for duplicate webhook / activate calls.
 */
export async function finalizeRegistrationAfterPayment(subscriptionId: string): Promise<FinalizeResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Billing is not configured." };
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  const existingBySub = await prisma.client.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (existingBySub) {
    return { ok: true, clientId: existingBySub.id, alreadyCompleted: true };
  }

  const holdId = sub.metadata?.holdId;
  if (!holdId || typeof holdId !== "string") {
    return { ok: false, error: "Invalid subscription metadata." };
  }

  if (sub.status !== "active" && sub.status !== "trialing") {
    return { ok: false, error: "Subscription is not active yet." };
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const hold = await prisma.pendingClientRegistration.findUnique({
    where: { id: holdId },
  });

  if (!hold) {
    return { ok: false, error: "This registration is no longer available." };
  }

  if (hold.status !== "AWAITING_PAYMENT") {
    return { ok: false, error: "Registration is not awaiting payment." };
  }

  if (hold.stripeSubscriptionId && hold.stripeSubscriptionId !== subscriptionId) {
    return { ok: false, error: "Subscription does not match this checkout session." };
  }

  const twoFactorEnabled = hold.twoFactorEnabled;
  const twoFactorMethod = twoFactorEnabled ? hold.twoFactorMethod : "NONE";

  try {
    const client = await prisma.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: {
          firstName: hold.firstName,
          lastName: hold.lastName,
          preferredName: hold.preferredName,
          username: hold.username,
          phone: hold.phone,
          email: hold.email,
          passwordHash: hold.passwordHash,
          zipCode: hold.zipCode,
          dateOfBirth: hold.dateOfBirth,
          termsAcceptedAt: hold.termsAcceptedAt,
          twoFactorEnabled,
          twoFactorMethod,
          stayLoggedIn: hold.stayLoggedIn,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionActive: true,
          subscriptionGraceUntil: null,
        },
      });
      await tx.pendingClientRegistration.delete({ where: { id: hold.id } });
      return c;
    });

    return { ok: true, clientId: client.id };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      const existing = await prisma.client.findUnique({ where: { email: hold.email } });
      if (existing) {
        await prisma.pendingClientRegistration.deleteMany({ where: { id: hold.id } });
        return { ok: true, clientId: existing.id, alreadyCompleted: true };
      }
    }
    console.error(e);
    return { ok: false, error: "Could not finalize your account." };
  }
}
