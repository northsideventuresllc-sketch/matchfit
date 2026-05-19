import { redirect } from "next/navigation";

export default function ClientNotificationSettingsRedirectPage() {
  redirect("/client/settings#client-notification-settings");
}
