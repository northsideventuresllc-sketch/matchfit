import "server-only";

import { readPlatformSecret } from "@/lib/platform-secrets";

/**
 * WF1.18 fix: Step 18 requires a Telegram ping after each post type and again at day
 * completion. It kept not firing because the ping depended on an agent remembering to send
 * it by hand. This wires it into the posting code path itself so it fires unconditionally.
 * Never throws — a failed Telegram send must never block or fail a real post.
 */
export async function sendTelegramPing(message: string): Promise<void> {
  try {
    const [token, chatId] = await Promise.all([
      readPlatformSecret("TELEGRAM_BOT_TOKEN"),
      readPlatformSecret("TELEGRAM_CHAT_ID"),
    ]);
    if (!token || !chatId) return;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!res.ok) {
      console.error(`[telegram-ping] send failed: HTTP ${res.status}`);
    }
  } catch (e) {
    console.error("[telegram-ping] send failed:", e instanceof Error ? e.message : e);
  }
}
