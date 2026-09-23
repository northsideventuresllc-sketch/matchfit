import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin";
import { createNiBrainClient, isNiBrainConfiguredAsync, recordContentLearning } from "@/lib/ni-brain-client";
import { callMatchFitAi } from "@/lib/ai-vault";
import { fireMediaAgentForDay } from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import { updateV2PostFields } from "@/lib/content-calendar/content-calendar-v2-store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(3000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
  context: z
    .object({
      stage: z.string().optional(),
      posts: z
        .array(
          z.object({
            id: z.string(),
            postDate: z.string().nullable().optional(),
            postType: z.string(),
            targetGroup: z.string().optional(),
            theme: z.string().nullable().optional(),
            caption: z.string().optional(),
            hashtags: z.array(z.string()).optional(),
            visualPrompt: z.string().nullable().optional(),
            workflowStage: z.string().optional(),
            mediaStatus: z.string().optional(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional(),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const { message, history, context } = parsed.data;

  // Build current posts summary for AI context
  const postsSummary = (context?.posts || [])
    .slice(0, 15)
    .map((p) => {
      return `- ID: ${p.id} | Date: ${p.postDate || "undated"} | Type: ${p.postType} | Target: ${
        p.targetGroup || "none"
      } | Stage: ${p.workflowStage || "hub"} | Caption: "${(p.caption || "").slice(0, 120)}" | Hashtags: ${(
        p.hashtags || []
      ).join(" ")} | Prompt: "${(p.visualPrompt || "").slice(0, 100)}"`;
    })
    .join("\n");

  const systemPrompt = `You are the Match Fit AXON Autonomous Content Agent. You work directly with operator JB to manage, correct, and regenerate social media content for Match Fit.
Current active posts in calendar context:
${postsSummary || "No posts loaded in immediate context."}

You have DIRECT EXECUTION AUTHORITY to execute actions immediately.
When JB asks you to fix, regenerate, rewrite, schedule, or fire something:
1. Formulate a crisp, ultra-concise plain-English response (1-2 sentences maximum, zero corporate fluff).
2. Determine any actions to execute.

You MUST respond strictly in valid JSON format:
{
  "reply": "Crisp plain-English answer describing what was done or answering JB.",
  "actions": [
    // Zero or more action objects:
    // { "type": "update_caption", "postId": "<id>", "caption": "<new caption>" }
    // { "type": "update_hashtags", "postId": "<id>", "hashtags": ["#tag1", "#tag2"] }
    // { "type": "update_visual_prompt", "postId": "<id>", "visualPrompt": "<new prompt>" }
    // { "type": "fire_media_agent", "postDate": "YYYY-MM-DD" }
    // { "type": "regenerate_post", "postId": "<id>", "feedback": "<optional feedback>" }
    // { "type": "create_impromptu", "postType": "Video"|"Static"|"Carousel"|"Text", "targetGroup": "Join the Team", "caption": "...", "visualPrompt": "...", "postDate": "YYYY-MM-DD" }
  ]
}

DO NOT wrap with markdown fences or extra prose. Return pure JSON only.`;

  const conversationHistory = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "JB" : "AXON"}: ${h.content}`)
    .join("\n\n");

  const prompt = `${conversationHistory ? `Recent conversation:\n${conversationHistory}\n\n` : ""}` +
    `Current JB message: ${message}\n\nRespond in the required JSON format.`;

  try {
    const aiResult = await callMatchFitAi({
      kind: "json",
      system: systemPrompt,
      user: prompt,
      temperature: 0.2,
      maxTokens: 1200,
    });

    const rawText = aiResult.text || "{}";
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");

    let parsedResult: { reply?: string; actions?: Array<Record<string, unknown>> } = {};
    try {
      parsedResult = JSON.parse(cleaned);
    } catch {
      parsedResult = { reply: rawText.replace(/[{}"\[\]]/g, "").trim() || "Action processed." };
    }

    const reply = parsedResult.reply || "Done.";
    const actions = Array.isArray(parsedResult.actions) ? parsedResult.actions : [];
    const executedActions: string[] = [];

    // Execute actions
    for (const act of actions) {
      if (typeof act !== "object" || !act) continue;
      const type = act.type;

      if (type === "update_caption" && typeof act.postId === "string" && typeof act.caption === "string") {
        await updateV2PostFields({ postId: act.postId, caption: act.caption });
        executedActions.push(`Updated caption on post ${act.postId}`);
      } else if (type === "update_hashtags" && typeof act.postId === "string" && Array.isArray(act.hashtags)) {
        await updateV2PostFields({ postId: act.postId, hashtags: act.hashtags as string[] });
        executedActions.push(`Updated hashtags on post ${act.postId}`);
      } else if (type === "update_visual_prompt" && typeof act.postId === "string" && typeof act.visualPrompt === "string") {
        await updateV2PostFields({ postId: act.postId, visualPrompt: act.visualPrompt });
        executedActions.push(`Updated visual prompt on post ${act.postId}`);
      } else if (type === "fire_media_agent" && typeof act.postDate === "string") {
        await fireMediaAgentForDay(act.postDate).catch((e) => console.error("[agent-chat fireMediaAgent]", e));
        executedActions.push(`Fired media agent for ${act.postDate}`);
      } else if (type === "regenerate_post" && typeof act.postId === "string") {
        const client = createNiBrainClient();
        await client
          .from("match_fit_content_calendar_posts")
          .update({
            workflow_stage: "pending",
            status: "pending",
            media_status: "generating",
            updated_at: new Date().toISOString(),
          })
          .eq("id", act.postId);
        executedActions.push(`Queued regenerate for post ${act.postId}`);
      } else if (type === "create_impromptu" && typeof act.caption === "string") {
        const client = createNiBrainClient();
        const postDate = typeof act.postDate === "string" ? act.postDate : new Date().toISOString().slice(0, 10);
        await client.from("match_fit_content_calendar_posts").insert({
          post_date: postDate,
          post_type: typeof act.postType === "string" ? act.postType : "Video",
          target_group: typeof act.targetGroup === "string" ? act.targetGroup : "Join the Team",
          caption: act.caption,
          visual_prompt: typeof act.visualPrompt === "string" ? act.visualPrompt : null,
          workflow_stage: "hub",
          content_lane: "impromptu",
          status: "draft",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        executedActions.push(`Created impromptu ${act.postType || "post"} for ${postDate}`);
      }
    }

    // Write back an audit learning row if an action was executed
    if (executedActions.length > 0) {
      await recordContentLearning({
        signalType: "DAY_APPROVAL_MEMO",
        editedText: `AXON Content Agent executed: ${executedActions.join("; ")}. User prompt: "${message}"`,
        meta: {
          kind: "axon_content_agent_chat",
          source: "axon_content_agent_bubble",
          executedActions,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      reply,
      executedActions,
      refreshed: executedActions.length > 0,
      provider: aiResult.provider,
      model: aiResult.model,
    });
  } catch (e) {
    console.error("[agent-chat]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AXON agent execution failed." },
      { status: 500 },
    );
  }
}
