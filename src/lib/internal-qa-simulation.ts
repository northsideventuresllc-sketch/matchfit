import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  isMatchFitInternalQaClientEmail,
  isMatchFitInternalQaTrainerEmail,
  matchFitInternalQaEstDayKey,
} from "@/lib/match-fit-internal-qa";
import { hashPassword } from "@/lib/password";
import {
  defaultClientMatchPreferences,
  serializeClientMatchPreferences,
} from "@/lib/client-match-preferences";
import {
  TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
  TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
} from "@/lib/trainer-dev-cert-placeholders";

const SYNTHETIC_TRAINER_TARGET = 10;
const SYNTHETIC_CLIENT_TARGET = 10;
const MATCH_COUNT_MIN = 2;
const MATCH_COUNT_MAX = 4;

const FIRST_NAMES = ["Alex", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Quinn", "Avery", "Reese", "Skyler"];
const LAST_NAMES = ["Brooks", "Hayes", "Reed", "Gray", "Cole", "West", "Lane", "Blake", "Parker", "Ellis"];

function shuffleWithRng<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function dayKeyToSeed(dayKey: string, salt: string): number {
  let h = 0;
  const s = `${dayKey}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i)! | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function processInternalQaDeferredOfficialChats(now = new Date()): Promise<void> {
  const due = await prisma.internalQaDeferredOfficialChat.findMany({
    where: { processedAt: null, openAt: { lte: now } },
    take: 50,
    select: { id: true, conversationId: true },
  });
  if (!due.length) return;
  for (const row of due) {
    await prisma.$transaction([
      prisma.trainerClientConversation.update({
        where: { id: row.conversationId },
        data: { officialChatStartedAt: now, updatedAt: now },
      }),
      prisma.internalQaDeferredOfficialChat.update({
        where: { id: row.id },
        data: { processedAt: now },
      }),
    ]);
  }
}

async function createSyntheticTrainer(seed: number): Promise<void> {
  const rand = mulberry32(seed + 0x9e3779b9);
  const pw = await hashPassword(randomBytes(24).toString("hex"));
  const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]!;
  const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]!;
  const suffix = randomBytes(3).toString("hex");
  const username = `mfqst_${suffix}_${seed}`.slice(0, 28);
  const email = `mfqa.trainer.${suffix}.${seed}@internal.match-fit.invalid`.toLowerCase();
  const phoneDigits = String(2000000000 + Math.floor(rand() * 799999999));
  const cleared = new Date();
  const aiText = `${fn} is a NASM-certified coach in strength & conditioning, focused on busy professionals. Offers hybrid and virtual sessions.`;

  await prisma.$transaction(async (tx) => {
    const t = await tx.trainer.create({
      data: {
        firstName: fn,
        lastName: ln,
        preferredName: fn,
        username,
        phone: `+1${phoneDigits}`,
        email,
        passwordHash: pw,
        bio: `${fn} helps clients build sustainable training habits with evidence-based programming.`,
        fitnessNiches: "strength, weight loss, general fitness",
        yearsCoaching: "6",
        termsAcceptedAt: new Date(),
        privacyPolicyAcceptedAt: new Date(),
        internalQaSyntheticPersona: true,
      },
    });
    await tx.trainerProfile.create({
      data: {
        trainerId: t.id,
        hasSignedTOS: true,
        hasUploadedW9: true,
        hasPaidBackgroundFee: true,
        backgroundCheckStatus: "APPROVED",
        backgroundCheckReviewStatus: "APPROVED",
        backgroundCheckClearedAt: cleared,
        onboardingTrackCpt: true,
        onboardingTrackNutrition: false,
        onboardingTrackSpecialist: false,
        certificationReviewStatus: "APPROVED",
        nutritionistCertificationReviewStatus: "NOT_STARTED",
        specialistCertificationReviewStatus: "NOT_STARTED",
        certificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
        nutritionistCertificationUrl: TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
        dashboardActivatedAt: new Date(),
        matchQuestionnaireStatus: "completed",
        matchQuestionnaireAnswers: JSON.stringify({ zip: "10001", delivery: "in_person" }),
        matchQuestionnaireCompletedAt: new Date(),
        aiMatchProfileText: aiText,
      },
    });
  });
}

async function createSyntheticClient(seed: number): Promise<void> {
  const rand = mulberry32(seed + 0x85ebca6b);
  const pw = await hashPassword(randomBytes(24).toString("hex"));
  const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]!;
  const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]!;
  const suffix = randomBytes(3).toString("hex");
  const username = `mfqsc_${suffix}_${seed}`.slice(0, 28);
  const email = `mfqa.client.${suffix}.${seed}@internal.match-fit.invalid`.toLowerCase();
  const phoneDigits = String(3000000000 + Math.floor(rand() * 699999999));
  const prefs = serializeClientMatchPreferences(defaultClientMatchPreferences);

  await prisma.client.create({
    data: {
      firstName: fn,
      lastName: ln,
      preferredName: fn,
      username,
      phone: `+1${phoneDigits}`,
      email,
      passwordHash: pw,
      zipCode: "10001",
      dateOfBirth: "1990-01-01",
      termsAcceptedAt: new Date(),
      privacyPolicyAcceptedAt: new Date(),
      allowTrainerDiscovery: true,
      matchPreferencesJson: prefs,
      matchPreferencesCompletedAt: new Date(),
      bio: `${fn} is looking for a coach to stay consistent with strength training.`,
      internalQaSyntheticPersona: true,
    },
  });
}

export async function ensureInternalQaSyntheticTrainerPool(): Promise<void> {
  const n = await prisma.trainer.count({ where: { internalQaSyntheticPersona: true } });
  for (let i = n; i < SYNTHETIC_TRAINER_TARGET; i++) {
    await createSyntheticTrainer(Date.now() + i * 9973);
  }
}

export async function ensureInternalQaSyntheticClientPool(): Promise<void> {
  const n = await prisma.client.count({ where: { internalQaSyntheticPersona: true } });
  for (let i = n; i < SYNTHETIC_CLIENT_TARGET; i++) {
    await createSyntheticClient(Date.now() + i * 7919);
  }
}

async function deleteQaClientSyntheticEdges(clientId: string): Promise<void> {
  const syntheticTrainerIds = (
    await prisma.trainer.findMany({
      where: { internalQaSyntheticPersona: true },
      select: { id: true },
    })
  ).map((t) => t.id);
  if (!syntheticTrainerIds.length) return;

  const convs = await prisma.trainerClientConversation.findMany({
    where: { clientId, trainerId: { in: syntheticTrainerIds } },
    select: { id: true },
  });
  const convIds = convs.map((c) => c.id);
  if (convIds.length) {
    await prisma.internalQaDeferredOfficialChat.deleteMany({
      where: { conversationId: { in: convIds } },
    });
    await prisma.trainerClientChatMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.trainerClientConversation.deleteMany({ where: { id: { in: convIds } } });
  }

  await prisma.trainerClientNudge.deleteMany({
    where: { clientId, trainerId: { in: syntheticTrainerIds } },
  });
  await prisma.clientSavedTrainer.deleteMany({
    where: { clientId, trainerId: { in: syntheticTrainerIds } },
  });
  await prisma.clientTrainerBrowsePass.deleteMany({
    where: { clientId, trainerId: { in: syntheticTrainerIds } },
  });
}

async function deleteQaTrainerSyntheticEdges(trainerId: string): Promise<void> {
  const syntheticClientIds = (
    await prisma.client.findMany({
      where: { internalQaSyntheticPersona: true },
      select: { id: true },
    })
  ).map((c) => c.id);
  if (!syntheticClientIds.length) return;

  const convs = await prisma.trainerClientConversation.findMany({
    where: { trainerId, clientId: { in: syntheticClientIds } },
    select: { id: true },
  });
  const convIds = convs.map((c) => c.id);
  if (convIds.length) {
    await prisma.internalQaDeferredOfficialChat.deleteMany({
      where: { conversationId: { in: convIds } },
    });
    await prisma.trainerClientChatMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.trainerClientConversation.deleteMany({ where: { id: { in: convIds } } });
  }

  await prisma.trainerClientNudge.deleteMany({
    where: { trainerId, clientId: { in: syntheticClientIds } },
  });
  await prisma.trainerDiscoverMatchBatch.deleteMany({ where: { trainerId } });
}

export async function refreshInternalQaClientSimulationIfNeeded(args: {
  clientId: string;
  email: string;
}): Promise<void> {
  if (!isMatchFitInternalQaClientEmail(args.email)) return;
  await processInternalQaDeferredOfficialChats();
  await ensureInternalQaSyntheticTrainerPool();

  const key = matchFitInternalQaEstDayKey();
  const cur = await prisma.internalQaClientDailyCursor.findUnique({
    where: { clientId: args.clientId },
    select: { estDayKey: true },
  });
  if (cur?.estDayKey === key) return;

  const trainers = await prisma.trainer.findMany({
    where: { internalQaSyntheticPersona: true, deidentifiedAt: null },
    select: { id: true, username: true, firstName: true, preferredName: true },
    take: SYNTHETIC_TRAINER_TARGET,
  });
  if (trainers.length < 3) return;

  const rng = mulberry32(dayKeyToSeed(key, args.clientId));
  const shuffled = shuffleWithRng(trainers, rng);
  const matchN = MATCH_COUNT_MIN + Math.floor(rng() * (MATCH_COUNT_MAX - MATCH_COUNT_MIN + 1));
  const matched = shuffled.slice(0, matchN);
  const chatOnly = shuffled.slice(matchN, matchN + 3);

  await deleteQaClientSyntheticEdges(args.clientId);
  const now = new Date();

  for (const t of matched) {
    const conv = await prisma.trainerClientConversation.create({
      data: {
        trainerId: t.id,
        clientId: args.clientId,
        officialChatStartedAt: now,
        relationshipStage: "POTENTIAL_CLIENT",
      },
    });
    const coach = t.preferredName?.trim() || t.firstName;
    await prisma.trainerClientChatMessage.createMany({
      data: [
        {
          conversationId: conv.id,
          authorRole: "TRAINER",
          body: `Hey! I’m ${coach} — thanks for connecting on Match Fit. What are you working toward this season?`,
        },
        {
          conversationId: conv.id,
          authorRole: "CLIENT",
          body: "Hi! I’m trying to rebuild a consistent strength routine around a busy work schedule.",
        },
        {
          conversationId: conv.id,
          authorRole: "TRAINER",
          body: "Totally doable. How many days per week can you realistically train, and do you prefer in-person or virtual?",
        },
      ],
    });
  }

  for (let i = 0; i < chatOnly.length; i++) {
    const t = chatOnly[i]!;
    const conv = await prisma.trainerClientConversation.create({
      data: {
        trainerId: t.id,
        clientId: args.clientId,
        officialChatStartedAt: i === 0 ? null : now,
        relationshipStage: "POTENTIAL_CLIENT",
      },
    });
    if (i === 0) {
      await prisma.trainerClientNudge.create({
        data: {
          trainerId: t.id,
          clientId: args.clientId,
          message: "Loved your profile — want to see if we’re a fit for remote coaching?",
        },
      });
    } else if (i === 1) {
      const coach = t.preferredName?.trim() || t.firstName;
      await prisma.trainerClientChatMessage.create({
        data: {
          conversationId: conv.id,
          authorRole: "TRAINER",
          body: `Hi, I’m ${coach}. I have an opening for two new clients this month — interested in a quick consult?`,
        },
      });
    } else {
      const coach = t.preferredName?.trim() || t.firstName;
      await prisma.trainerClientChatMessage.createMany({
        data: [
          {
            conversationId: conv.id,
            authorRole: "TRAINER",
            body: `Hey! ${coach} here — I specialize in hybrid strength + conditioning.`,
          },
          {
            conversationId: conv.id,
            authorRole: "CLIENT",
            body: "Nice — I’m looking for accountability and a structured plan.",
          },
          {
            conversationId: conv.id,
            authorRole: "TRAINER",
            body: "Perfect. What equipment do you have access to most days?",
          },
        ],
      });
    }
  }

  await prisma.internalQaClientDailyCursor.upsert({
    where: { clientId: args.clientId },
    create: { clientId: args.clientId, estDayKey: key },
    update: { estDayKey: key },
  });
}

export async function refreshInternalQaTrainerSimulationIfNeeded(args: {
  trainerId: string;
  email: string;
}): Promise<void> {
  if (!isMatchFitInternalQaTrainerEmail(args.email)) return;
  await processInternalQaDeferredOfficialChats();
  await ensureInternalQaSyntheticClientPool();

  const key = matchFitInternalQaEstDayKey();
  const cur = await prisma.internalQaTrainerDailyCursor.findUnique({
    where: { trainerId: args.trainerId },
    select: { estDayKey: true },
  });
  if (cur?.estDayKey === key) return;

  const clients = await prisma.client.findMany({
    where: { internalQaSyntheticPersona: true, deidentifiedAt: null },
    select: { id: true, username: true, firstName: true, preferredName: true },
    take: SYNTHETIC_CLIENT_TARGET,
  });
  if (clients.length < 3) return;

  const rng = mulberry32(dayKeyToSeed(key, args.trainerId));
  const shuffled = shuffleWithRng(clients, rng);
  const chatClients = shuffled.slice(0, 3);
  const now = new Date();

  await deleteQaTrainerSyntheticEdges(args.trainerId);

  for (let i = 0; i < chatClients.length; i++) {
    const c = chatClients[i]!;
    const conv = await prisma.trainerClientConversation.create({
      data: {
        trainerId: args.trainerId,
        clientId: c.id,
        officialChatStartedAt: i === 0 ? null : now,
        relationshipStage: "POTENTIAL_CLIENT",
      },
    });
    const who = c.preferredName?.trim() || c.firstName;
    if (i === 0) {
      await prisma.trainerClientNudge.create({
        data: {
          trainerId: args.trainerId,
          clientId: c.id,
          message: null,
        },
      });
    } else if (i === 1) {
      await prisma.trainerClientChatMessage.create({
        data: {
          conversationId: conv.id,
          authorRole: "CLIENT",
          body: `Hi coach — ${who} here. I saw your profile and I’m interested in hybrid training.`,
        },
      });
    } else {
      await prisma.trainerClientChatMessage.createMany({
        data: [
          {
            conversationId: conv.id,
            authorRole: "TRAINER",
            body: "Thanks for reaching out — what days work best for you?",
          },
          {
            conversationId: conv.id,
            authorRole: "CLIENT",
            body: "Weekday evenings after 6pm ET usually work best for me.",
          },
        ],
      });
    }
  }

  await prisma.internalQaTrainerDailyCursor.upsert({
    where: { trainerId: args.trainerId },
    create: { trainerId: args.trainerId, estDayKey: key },
    update: { estDayKey: key },
  });
}
