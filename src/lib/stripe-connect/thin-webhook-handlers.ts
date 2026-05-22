import { retrieveConnectV2Event } from "./thin-events";
import type { ConnectThinNotification } from "./thin-events";

/**
 * Thin (V2) account event handlers — requirements and capability changes.
 * This demo logs and fetches the full event; refresh onboarding UI by re-calling the Accounts API.
 */
export async function handleConnectThinEventNotification(
  notification: ConnectThinNotification,
): Promise<void> {
  const event = await retrieveConnectV2Event(notification.id);
  const type = event.type;

  switch (type) {
    case "v2.core.account[requirements].updated":
      console.info("[stripe-connect-demo] requirements updated", {
        eventId: event.id,
        relatedObject: notification.related_object,
      });
      return;

    case "v2.core.account[configuration.merchant].capability_status_updated":
      console.info("[stripe-connect-demo] merchant capability status updated", {
        eventId: event.id,
      });
      return;

    case "v2.core.account[configuration.customer].capability_status_updated":
      console.info("[stripe-connect-demo] customer capability status updated", {
        eventId: event.id,
      });
      return;

    case "v2.core.account[configuration.recipient].capability_status_updated":
      console.info("[stripe-connect-demo] recipient capability status updated", {
        eventId: event.id,
      });
      return;

    case "v2.core.account_link.returned":
      console.info("[stripe-connect-demo] account link returned — seller finished onboarding flow", {
        eventId: event.id,
      });
      return;

    default:
      console.info("[stripe-connect-demo] unhandled thin event type", { type });
  }
}
