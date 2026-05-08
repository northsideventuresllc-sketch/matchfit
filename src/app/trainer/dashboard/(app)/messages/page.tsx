import type { Metadata } from "next";
import Link from "next/link";
import { TrainerChatsHubClient } from "@/components/trainer/trainer-chats-hub-client";

export const metadata: Metadata = {
  title: "Chats | Trainer | Match Fit",
};

export default function TrainerMessagesHubPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Inbox</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Chats</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Every active thread with potential and current clients. Update relationship labels as people move through your
          pipeline.
        </p>
        <p className="mx-auto max-w-xl text-xs text-white/45">
          Checkout links, invites, and meeting links live below each thread. Credits, Gate B, DIY handshake &amp; packages:{" "}
          <Link href="/trainer/dashboard/client-management" className="text-[#FF9A4A] underline-offset-2 hover:underline">
            Client Management
          </Link>
          .
        </p>
      </header>
      <TrainerChatsHubClient />
    </div>
  );
}
