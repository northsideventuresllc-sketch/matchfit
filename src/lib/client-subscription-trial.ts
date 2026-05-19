import type { ClientTrialPlan } from "@/lib/match-fit-launch-cohort";
import { clientTrialDaysForPlan } from "@/lib/match-fit-launch-cohort";
import type Stripe from "stripe";

export function subscriptionTrialEndFromStripe(sub: Stripe.Subscription): Date | null {
  const end = sub.trial_end;
  if (typeof end === "number" && end > 0) return new Date(end * 1000);
  return null;
}

export function stripeTrialConfigForPlan(plan: ClientTrialPlan): {
  trial_period_days?: number;
} {
  const days = clientTrialDaysForPlan(plan);
  if (days <= 0) return {};
  return { trial_period_days: days };
}

export function clientTrialPlanLabel(plan: ClientTrialPlan): string {
  switch (plan) {
    case "LAUNCH_7D":
      return "7-day launch access";
    case "STANDARD_72H":
      return "72-hour free access";
    case "PAY_NOW":
      return "Pay now";
    default:
      return "Standard billing";
  }
}
