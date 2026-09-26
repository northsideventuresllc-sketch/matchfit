"use client";

import { useMemo, useState } from "react";
import {
  adminInputClassSm,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { Modal } from "./ui-bits";

function synthesizeProposedLearnings(postDate: string, posts: ClientContentCalendarV2Post[]): string {
  const lines: string[] = [];

  for (const post of posts) {
    const postLabel = `${post.postType} (${post.theme || post.targetGroup || "Content"})`;

    // 1. Caption learning
    if (post.caption?.trim()) {
      const words = post.caption.trim().split(/\s+/).length;
      const hasCta = /sign-up|apply|link|match-fit|book/i.test(post.caption);
      lines.push(
        `• [${postLabel} - Caption]: Prefer concise, value-first messaging (~${words} words) emphasizing direct conversion ${
          hasCta ? "with clear call-to-action" : ""
        }.`,
      );
    }

    // 2. Hashtags learning
    if (post.hashtags && post.hashtags.length > 0) {
      lines.push(
        `• [${postLabel} - Hashtags]: Prioritize niche audience-intent discovery tags (${post.hashtags.slice(0, 4).join(" ")}) over high-competition broad tags.`,
      );
    }

    // 3. Visual prompt learning
    if (post.visualPrompt?.trim() || post.lastGenerationPrompt?.trim()) {
      const promptText = (post.visualPrompt || post.lastGenerationPrompt || "").trim();
      const summary = promptText.length > 90 ? `${promptText.slice(0, 90)}…` : promptText;
      lines.push(
        `• [${postLabel} - Visual Direction]: Aesthetic focus: "${summary}". Emphasize authentic fitness training atmosphere and crisp composition.`,
      );
    }
  }

  if (lines.length === 0) {
    lines.push(`• Content style aligned with Match Fit brand voice and verified trainer conversion.`);
  }

  return lines.join("\n");
}

export function ApproveDayLearningModal({
  postDate,
  posts,
  busy,
  onClose,
  onConfirm,
}: {
  postDate: string;
  posts: ClientContentCalendarV2Post[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (data: { learnings: string; feedback: string }) => Promise<void>;
}) {
  const initialLearnings = useMemo(() => synthesizeProposedLearnings(postDate, posts), [postDate, posts]);
  const [learnings, setLearnings] = useState(initialLearnings);
  const [syncedInitial, setSyncedInitial] = useState(initialLearnings);
  const [feedback, setFeedback] = useState("");

  // Reset the draft when the proposed learnings change (render-time sync, no effect).
  if (syncedInitial !== initialLearnings) {
    setSyncedInitial(initialLearnings);
    setLearnings(initialLearnings);
  }

  async function handleConfirm() {
    await onConfirm({
      learnings: learnings.trim(),
      feedback: feedback.trim(),
    });
  }

  return (
    <Modal title={`Approve Day & Agent Learning — ${postDate}`} onClose={onClose} maxWidthClass="max-w-2xl">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-white/60">
          Review and adjust what AXON agents will learn from your edits to prompts, captions, and hashtags. These
          learnings will be written directly to the NI-Brain knowledgebase and Obsidian vault.
        </p>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="agent-learnings-text" className={adminLabelClass}>
              Agent Learnings (Editable before saving to Brain/Vault)
            </label>
            <span className="text-[11px] text-white/40">Adjust or add bullets</span>
          </div>
          <textarea
            id="agent-learnings-text"
            className={`${adminInputClassSm} mt-1.5 min-h-[140px] font-mono text-xs leading-relaxed`}
            value={learnings}
            onChange={(e) => setLearnings(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor="generation-feedback-text" className={adminLabelClass}>
            Additional Feedback on Generation Quality (Optional)
          </label>
          <textarea
            id="generation-feedback-text"
            className={`${adminInputClassSm} mt-1.5 min-h-[80px] text-xs leading-relaxed`}
            placeholder="Tell AXON agents what to do differently or improve next time (e.g., video pacing, hook angles, tone)..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] pt-4">
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={busy}
            onClick={onClose}
          >
            CANCEL
          </button>
          <button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={busy || !learnings.trim()}
            onClick={() => void handleConfirm()}
          >
            {busy ? "SAVING & APPROVING…" : "APPROVE DAY & COMMIT LEARNINGS"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
