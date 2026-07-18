import { OutreachPreviewClient } from "./outreach-preview-client";

/** Public interactive UI preview — no admin auth required. Mirrors /admin/content-calendar/preview. */
export default function OutreachPreviewPage() {
  return <OutreachPreviewClient />;
}
