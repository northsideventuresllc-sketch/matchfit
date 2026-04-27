import { prisma } from "@/lib/prisma";

type DemoPostSpec = {
  demoSeedKey: string;
  postType: "TEXT" | "IMAGE" | "VIDEO";
  caption: string | null;
  bodyText: string | null;
  mediaUrl: string | null;
};

/**
 * Stable demo posts for QA / client UX simulation. Upserted by `demoSeedKey` so feed stays rich without duplicates.
 */
const FIT_HUB_DEMO_POST_SPECS: DemoPostSpec[] = [
  {
    demoSeedKey: "mf-demo-welcome",
    postType: "TEXT",
    caption: "How we use FitHub",
    bodyText:
      "FitHub is where coaches share quick wins, form reminders, and programming ideas — like a professional social feed built for training. Save coaches you like and tune your feed in settings.",
    mediaUrl: null,
  },
  {
    demoSeedKey: "mf-demo-meal-prep",
    postType: "TEXT",
    caption: "Sunday reset (15 minutes)",
    bodyText:
      "Pick two proteins, two carbs, one veg mix. Portion into containers so weekday lunches are automatic — consistency beats perfection.",
    mediaUrl: null,
  },
  {
    demoSeedKey: "mf-demo-squat-cues",
    postType: "IMAGE",
    caption: "Three squat cues that scale",
    bodyText: "Ribs down, knees track over toes, drive the floor away. Film one set from the side this week and compare week to week.",
    mediaUrl: "/next.svg",
  },
  {
    demoSeedKey: "mf-demo-mobility",
    postType: "VIDEO",
    caption: "Hip + T-spine flow (no equipment)",
    bodyText: "Use between meetings or before heavy lower work. Move slowly; quality reps only.",
    mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    demoSeedKey: "mf-demo-progress",
    postType: "TEXT",
    caption: "Progress you can log today",
    bodyText:
      "RPE on your top set, sleep hours, steps, protein servings — pick one metric and log it for seven days. Trends become obvious fast.",
    mediaUrl: null,
  },
  {
    demoSeedKey: "mf-demo-hydration",
    postType: "TEXT",
    caption: "Hydration check-in",
    bodyText:
      "If training feels harder than usual, audit water and sodium first — especially in heat or higher volume blocks. This is general guidance, not medical advice.",
    mediaUrl: null,
  },
  {
    demoSeedKey: "mf-demo-community",
    postType: "TEXT",
    caption: "Community norms",
    bodyText:
      "Keep comments respectful and training-focused. If something feels off, use Report on the post so our team can review it.",
    mediaUrl: null,
  },
];

async function resolveDemoTrainerIds(): Promise<string[]> {
  const raw = process.env.MATCH_FIT_FITHUB_DEMO_TRAINER_USERNAMES?.trim();
  const usernames = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (usernames.length) {
    const rows = await prisma.trainer.findMany({
      where: { username: { in: usernames } },
      select: { id: true, username: true },
    });
    const byUser = new Map(rows.map((r) => [r.username, r.id]));
    const ordered: string[] = [];
    for (const u of usernames) {
      const id = byUser.get(u);
      if (id) ordered.push(id);
    }
    if (ordered.length) return ordered;
  }

  const fallback = await prisma.trainer.findMany({
    take: 8,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback.map((t) => t.id);
}

async function syncFitHubDemoSeedPosts(): Promise<void> {
  const trainerIds = await resolveDemoTrainerIds();
  if (!trainerIds.length) return;

  let i = 0;
  for (const spec of FIT_HUB_DEMO_POST_SPECS) {
    const trainerId = trainerIds[i % trainerIds.length]!;
    i += 1;
    await prisma.trainerFitHubPost.upsert({
      where: { demoSeedKey: spec.demoSeedKey },
      create: {
        demoSeedKey: spec.demoSeedKey,
        trainerId,
        postType: spec.postType,
        caption: spec.caption,
        bodyText: spec.bodyText,
        mediaUrl: spec.mediaUrl,
      },
      update: {
        postType: spec.postType,
        caption: spec.caption,
        bodyText: spec.bodyText,
        mediaUrl: spec.mediaUrl,
      },
    });
  }
}

/**
 * Seeds a few demo FitHub posts when the table is empty so new environments have a realistic feed,
 * then keeps idempotent demo rows in sync for trainers listed in `MATCH_FIT_FITHUB_DEMO_TRAINER_USERNAMES`
 * (comma-separated) or the earliest-created trainers.
 */
export async function ensureClientFitHubSamplePosts(): Promise<void> {
  const count = await prisma.trainerFitHubPost.count();
  if (count === 0) {
    const trainers = await prisma.trainer.findMany({
      take: 4,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (trainers.length) {
      const [a, b, c] = [trainers[0], trainers[1] ?? trainers[0], trainers[2] ?? trainers[0]];
      await prisma.trainerFitHubPost.createMany({
        data: [
          {
            trainerId: a.id,
            postType: "TEXT",
            bodyText:
              "Welcome to FitHub — a space for real training wins, quick tips, and the occasional reality check. Stay consistent.",
            caption: "Kickoff note from your coaches",
          },
          {
            trainerId: b.id,
            postType: "IMAGE",
            caption: "Form check: brace, breathe, then drive.",
            bodyText: "Three cues that clean up most compound lifts on day one.",
            mediaUrl: "/next.svg",
          },
          {
            trainerId: c.id,
            postType: "VIDEO",
            caption: "60-second mobility reset",
            bodyText: "Use between meetings or before heavy work.",
            mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          },
        ],
      });
    }
  }

  await syncFitHubDemoSeedPosts();
}
