import { prisma } from "@/lib/prisma";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_DETAILS = 2000;

const blockModeSchema = z.enum([
  "full",
  "match_feed_only",
  "fithub_only",
  "chat_only",
  "trainer_fithub_mute",
  "discover_only",
]);

const postBodySchema = z.object({
  targetUsername: z.string().trim().min(1),
  targetIsTrainer: z.boolean(),
  reasonCategory: z.string().trim().nullable().optional(),
  reasonDetails: z
    .string()
    .trim()
    .max(MAX_DETAILS)
    .nullable()
    .optional(),
  /** Defaults to `full` when omitted (legacy clients). */
  blockMode: blockModeSchema.optional(),
});

type ScopeFlags = {
  hideTrainerFromClientMatchFeed: boolean;
  hideTrainerFromClientFithub: boolean;
  hideClientFromTrainerDiscover: boolean;
  hideBlockedTrainerFromViewerTrainerFithub: boolean;
  blockDirectChat: boolean;
};

function scopesForClientTrainerMode(mode: z.infer<typeof blockModeSchema>): ScopeFlags {
  switch (mode) {
    case "match_feed_only":
      return {
        hideTrainerFromClientMatchFeed: true,
        hideTrainerFromClientFithub: false,
        hideClientFromTrainerDiscover: false,
        hideBlockedTrainerFromViewerTrainerFithub: false,
        blockDirectChat: false,
      };
    case "fithub_only":
      return {
        hideTrainerFromClientMatchFeed: false,
        hideTrainerFromClientFithub: true,
        hideClientFromTrainerDiscover: false,
        hideBlockedTrainerFromViewerTrainerFithub: false,
        blockDirectChat: false,
      };
    case "chat_only":
      return {
        hideTrainerFromClientMatchFeed: false,
        hideTrainerFromClientFithub: false,
        hideClientFromTrainerDiscover: false,
        hideBlockedTrainerFromViewerTrainerFithub: false,
        blockDirectChat: true,
      };
    case "full":
    default:
      return {
        hideTrainerFromClientMatchFeed: true,
        hideTrainerFromClientFithub: true,
        hideClientFromTrainerDiscover: false,
        hideBlockedTrainerFromViewerTrainerFithub: false,
        blockDirectChat: true,
      };
  }
}

function scopesForTrainerClientMode(mode: z.infer<typeof blockModeSchema>): ScopeFlags {
  switch (mode) {
    case "discover_only":
      return {
        hideTrainerFromClientMatchFeed: false,
        hideTrainerFromClientFithub: false,
        hideClientFromTrainerDiscover: true,
        hideBlockedTrainerFromViewerTrainerFithub: false,
        blockDirectChat: false,
      };
    case "chat_only":
      return {
        hideTrainerFromClientMatchFeed: false,
        hideTrainerFromClientFithub: false,
        hideClientFromTrainerDiscover: false,
        hideBlockedTrainerFromViewerTrainerFithub: false,
        blockDirectChat: true,
      };
    case "full":
    default:
      return {
        hideTrainerFromClientMatchFeed: true,
        hideTrainerFromClientFithub: true,
        hideClientFromTrainerDiscover: true,
        hideBlockedTrainerFromViewerTrainerFithub: false,
        blockDirectChat: true,
      };
  }
}

function scopesTrainerTrainerMute(): ScopeFlags {
  return {
    hideTrainerFromClientMatchFeed: false,
    hideTrainerFromClientFithub: false,
    hideClientFromTrainerDiscover: false,
    hideBlockedTrainerFromViewerTrainerFithub: true,
    blockDirectChat: false,
  };
}

function mergeScopes(existing: ScopeFlags | null, incoming: ScopeFlags): ScopeFlags {
  if (!existing) return incoming;
  return {
    hideTrainerFromClientMatchFeed: existing.hideTrainerFromClientMatchFeed || incoming.hideTrainerFromClientMatchFeed,
    hideTrainerFromClientFithub: existing.hideTrainerFromClientFithub || incoming.hideTrainerFromClientFithub,
    hideClientFromTrainerDiscover: existing.hideClientFromTrainerDiscover || incoming.hideClientFromTrainerDiscover,
    hideBlockedTrainerFromViewerTrainerFithub:
      existing.hideBlockedTrainerFromViewerTrainerFithub || incoming.hideBlockedTrainerFromViewerTrainerFithub,
    blockDirectChat: existing.blockDirectChat || incoming.blockDirectChat,
  };
}

const deleteBodySchema = z.object({
  blockId: z.string().trim().min(1),
});

export async function DELETE(req: Request) {
  try {
    const parsed = deleteBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "blockId is required." }, { status: 400 });
    }
    const clientId = await getSessionClientId();
    const trainerId = await getSessionTrainerId();
    if (clientId && trainerId) {
      return NextResponse.json({ error: "Invalid session state." }, { status: 400 });
    }
    if (!clientId && !trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const row = await prisma.userBlock.findUnique({ where: { id: parsed.data.blockId } });
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const owns =
      (clientId && !row.blockerIsTrainer && row.blockerId === clientId) ||
      (trainerId && row.blockerIsTrainer && row.blockerId === trainerId);
    if (!owns) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    await prisma.userBlock.delete({ where: { id: row.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not remove block." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = postBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const body = parsed.data;
    const mode = body.blockMode ?? "full";

    const clientId = await getSessionClientId();
    const sessionTrainerId = await getSessionTrainerId();

    if (clientId && sessionTrainerId) {
      return NextResponse.json({ error: "Invalid session state." }, { status: 400 });
    }
    if (!clientId && !sessionTrainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const reasonCategory = body.reasonCategory?.trim() || null;
    const reasonDetails =
      typeof body.reasonDetails === "string" ? body.reasonDetails.trim().slice(0, MAX_DETAILS) : null;

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      if (!body.targetIsTrainer) {
        return NextResponse.json({ error: "Clients can only block trainers from this endpoint." }, { status: 400 });
      }
      if (mode === "trainer_fithub_mute" || mode === "discover_only") {
        return NextResponse.json({ error: "Invalid block mode for a client." }, { status: 400 });
      }
      const trainer = await prisma.trainer.findUnique({
        where: { username: body.targetUsername },
        select: { id: true },
      });
      if (!trainer) {
        return NextResponse.json({ error: "Trainer not found." }, { status: 404 });
      }
      const incoming = scopesForClientTrainerMode(mode);
      const existing = await prisma.userBlock.findUnique({
        where: {
          blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
            blockerIsTrainer: false,
            blockerId: clientId,
            blockedIsTrainer: true,
            blockedId: trainer.id,
          },
        },
      });
      const merged = mergeScopes(
        existing
          ? {
              hideTrainerFromClientMatchFeed: existing.hideTrainerFromClientMatchFeed,
              hideTrainerFromClientFithub: existing.hideTrainerFromClientFithub,
              hideClientFromTrainerDiscover: existing.hideClientFromTrainerDiscover,
              hideBlockedTrainerFromViewerTrainerFithub: existing.hideBlockedTrainerFromViewerTrainerFithub,
              blockDirectChat: existing.blockDirectChat,
            }
          : null,
        incoming,
      );
      await prisma.userBlock.upsert({
        where: {
          blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
            blockerIsTrainer: false,
            blockerId: clientId,
            blockedIsTrainer: true,
            blockedId: trainer.id,
          },
        },
        create: {
          blockerIsTrainer: false,
          blockerId: clientId,
          blockedIsTrainer: true,
          blockedId: trainer.id,
          reasonCategory,
          reasonDetails,
          ...merged,
        },
        update: {
          reasonCategory: reasonCategory ?? undefined,
          reasonDetails: reasonDetails ?? undefined,
          ...merged,
        },
      });
      return NextResponse.json({ ok: true });
    }

    const tid = sessionTrainerId!;
    const trainer = await prisma.trainer.findUnique({ where: { id: tid }, select: { id: true } });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (body.targetIsTrainer) {
      if (mode !== "trainer_fithub_mute") {
        return NextResponse.json(
          { error: "Use blockMode trainer_fithub_mute when blocking another trainer’s FitHub." },
          { status: 400 },
        );
      }
      const other = await prisma.trainer.findUnique({
        where: { username: body.targetUsername },
        select: { id: true },
      });
      if (!other) {
        return NextResponse.json({ error: "Trainer not found." }, { status: 404 });
      }
      if (other.id === tid) {
        return NextResponse.json({ error: "You cannot block yourself." }, { status: 400 });
      }
      const incoming = scopesTrainerTrainerMute();
      const existing = await prisma.userBlock.findUnique({
        where: {
          blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
            blockerIsTrainer: true,
            blockerId: tid,
            blockedIsTrainer: true,
            blockedId: other.id,
          },
        },
      });
      const merged = mergeScopes(
        existing
          ? {
              hideTrainerFromClientMatchFeed: existing.hideTrainerFromClientMatchFeed,
              hideTrainerFromClientFithub: existing.hideTrainerFromClientFithub,
              hideClientFromTrainerDiscover: existing.hideClientFromTrainerDiscover,
              hideBlockedTrainerFromViewerTrainerFithub: existing.hideBlockedTrainerFromViewerTrainerFithub,
              blockDirectChat: existing.blockDirectChat,
            }
          : null,
        incoming,
      );
      await prisma.userBlock.upsert({
        where: {
          blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
            blockerIsTrainer: true,
            blockerId: tid,
            blockedIsTrainer: true,
            blockedId: other.id,
          },
        },
        create: {
          blockerIsTrainer: true,
          blockerId: tid,
          blockedIsTrainer: true,
          blockedId: other.id,
          reasonCategory,
          reasonDetails,
          ...merged,
        },
        update: {
          reasonCategory: reasonCategory ?? undefined,
          reasonDetails: reasonDetails ?? undefined,
          ...merged,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (mode === "trainer_fithub_mute") {
      return NextResponse.json({ error: "Invalid block mode for a client target." }, { status: 400 });
    }

    const targetClient = await prisma.client.findUnique({
      where: { username: body.targetUsername },
      select: { id: true },
    });
    if (!targetClient) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    const allowedForTrainerClient: z.infer<typeof blockModeSchema>[] = ["full", "discover_only", "chat_only"];
    if (!allowedForTrainerClient.includes(mode)) {
      return NextResponse.json({ error: "Invalid block mode for blocking a client." }, { status: 400 });
    }
    const incoming = scopesForTrainerClientMode(mode);
    const existing = await prisma.userBlock.findUnique({
      where: {
        blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
          blockerIsTrainer: true,
          blockerId: tid,
          blockedIsTrainer: false,
          blockedId: targetClient.id,
        },
      },
    });
    const merged = mergeScopes(
      existing
        ? {
            hideTrainerFromClientMatchFeed: existing.hideTrainerFromClientMatchFeed,
            hideTrainerFromClientFithub: existing.hideTrainerFromClientFithub,
            hideClientFromTrainerDiscover: existing.hideClientFromTrainerDiscover,
            hideBlockedTrainerFromViewerTrainerFithub: existing.hideBlockedTrainerFromViewerTrainerFithub,
            blockDirectChat: existing.blockDirectChat,
          }
        : null,
      incoming,
    );
    await prisma.userBlock.upsert({
      where: {
        blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
          blockerIsTrainer: true,
          blockerId: tid,
          blockedIsTrainer: false,
          blockedId: targetClient.id,
        },
      },
      create: {
        blockerIsTrainer: true,
        blockerId: tid,
        blockedIsTrainer: false,
        blockedId: targetClient.id,
        reasonCategory,
        reasonDetails,
        ...merged,
      },
      update: {
        reasonCategory: reasonCategory ?? undefined,
        reasonDetails: reasonDetails ?? undefined,
        ...merged,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save block." }, { status: 500 });
  }
}
