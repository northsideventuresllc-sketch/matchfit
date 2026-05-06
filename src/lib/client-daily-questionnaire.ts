import { parseClientMatchPreferencesJson } from "@/lib/client-match-preferences";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { prisma } from "@/lib/prisma";

export const DAILY_QUESTIONNAIRE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Unanswered questionnaires older than this are archived and replaced with a fresh set. */
export const DAILY_QUESTIONNAIRE_INCOMPLETE_TTL_MS = 72 * 60 * 60 * 1000;
/** Completed questionnaires remain viewable in-app for this window. */
export const DAILY_QUESTIONNAIRE_HISTORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type DailyTrainerInterestQuestion = {
  id: "q_trainer_fit";
  kind: "trainer_interest_scale";
  prompt: string;
  trainerUsername: string;
  trainerDisplayName: string;
  focusBlurb: string;
  scaleMin: 1;
  scaleMax: 5;
  lowLabel: string;
  highLabel: string;
};

export type DailyInterestPickQuestion = {
  id: "q_week_focus";
  kind: "single_choice";
  prompt: string;
  options: { value: string; label: string }[];
};

export type DailyFreeTextQuestion = {
  id: "q_open_signal";
  kind: "free_text";
  prompt: string;
  placeholder: string;
  maxLength: number;
};

export type DailyQuestionnaireQuestions = {
  version: 1;
  questions: [DailyTrainerInterestQuestion, DailyInterestPickQuestion, DailyFreeTextQuestion];
  context: {
    clientZipPrefix: string;
    summaryLine: string;
  };
};

export type DailyQuestionnaireHistoryEntry = {
  id: string;
  completedAt: string;
  questions: DailyQuestionnaireQuestions;
  answers: Record<string, string>;
};

function coachDisplayName(trainer: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return (
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Coach"
  );
}

function zipPrefix(zip: string): string {
  const z = zip.replace(/\D/g, "");
  return z.length >= 3 ? z.slice(0, 3) : z || "000";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function titleCaseAnswerLabel(input: string): string {
  return input.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function buildFocusBlurb(trainer: { fitnessNiches: string | null; bio: string | null }): string {
  const n = trainer.fitnessNiches?.trim();
  const b = trainer.bio?.trim();
  if (n) return n.length > 160 ? `${n.slice(0, 157)}…` : n;
  if (b) return b.length > 160 ? `${b.slice(0, 157)}…` : b;
  return "A coach who recently completed onboarding on Match Fit.";
}

function interestOptionsFromPrefs(prefs: ReturnType<typeof parseClientMatchPreferencesJson>): { value: string; label: string }[] {
  const base: { value: string; label: string }[] = [
    { value: "strength", label: "Strength & Lifting" },
    { value: "conditioning", label: "Conditioning & Cardio" },
    { value: "mobility", label: "Mobility & Recovery" },
    { value: "nutrition", label: "Nutrition Habits" },
    { value: "accountability", label: "Accountability & Routine" },
    { value: "sport", label: "Sport-Specific Work" },
  ];
  const niche = prefs.fitnessNiches?.trim();
  if (niche) {
    const token = niche.split(/[,;\n]/)[0]?.trim();
    if (token && token.length > 2) {
      const trimmedToken = token.length > 48 ? `${token.slice(0, 45)}…` : token;
      base.unshift({ value: "niche_primary", label: `My Niche Focus: ${titleCaseAnswerLabel(trimmedToken)}` });
    }
  }
  return base.slice(0, 6).map((row) => ({ ...row, label: titleCaseAnswerLabel(row.label) }));
}

async function pickRecentTrainersForClient(clientZip: string, excludeTrainerIds: string[]) {
  const horizons = [14, 45, 120] as const;
  for (const days of horizons) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.trainer.findMany({
      where: {
        id: excludeTrainerIds.length ? { notIn: excludeTrainerIds } : undefined,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        fitnessNiches: true,
        bio: true,
        createdAt: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
          },
        },
      },
    });
    const eligible = rows.filter(
      (t) => t.profile && t.profile.dashboardActivatedAt != null && isTrainerComplianceComplete(t.profile),
    );
    if (eligible.length) return shuffle(eligible);
  }
  const fallback = await prisma.trainer.findMany({
    where: excludeTrainerIds.length ? { id: { notIn: excludeTrainerIds } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      fitnessNiches: true,
      bio: true,
      createdAt: true,
      profile: {
        select: {
          dashboardActivatedAt: true,
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
          onboardingTrackCpt: true,
          onboardingTrackNutrition: true,
          onboardingTrackSpecialist: true,
          certificationReviewStatus: true,
          nutritionistCertificationReviewStatus: true,
          specialistCertificationReviewStatus: true,
        },
      },
    },
  });
  return shuffle(
    fallback.filter(
      (t) => t.profile && t.profile.dashboardActivatedAt != null && isTrainerComplianceComplete(t.profile),
    ),
  );
}

export async function buildDailyQuestionnairePayload(clientId: string): Promise<DailyQuestionnaireQuestions> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { zipCode: true, matchPreferencesJson: true },
  });
  if (!client) {
    throw new Error("Client not found.");
  }
  const prefs = parseClientMatchPreferencesJson(client.matchPreferencesJson);
  const saved = await prisma.clientSavedTrainer.findMany({
    where: { clientId },
    select: { trainerId: true },
  });
  const exclude = saved.map((s) => s.trainerId);
  const pool = await pickRecentTrainersForClient(client.zipCode, exclude);
  const primary = pool[0];
  const zp = zipPrefix(client.zipCode);

  const q1: DailyTrainerInterestQuestion = primary
    ? {
        id: "q_trainer_fit",
        kind: "trainer_interest_scale",
        prompt: `A coach near your region (ZIP prefix ${zp}) recently joined Match Fit. How interested would you be in exploring a fit with them?`,
        trainerUsername: primary.username,
        trainerDisplayName: coachDisplayName(primary),
        focusBlurb: buildFocusBlurb(primary),
        scaleMin: 1,
        scaleMax: 5,
        lowLabel: "Not Interested",
        highLabel: "Very Interested",
      }
    : {
        id: "q_trainer_fit",
        kind: "trainer_interest_scale",
        prompt:
          "New coaches are joining Match Fit every week in your area. How open are you right now to being matched with someone who just onboarded?",
        trainerUsername: "_platform",
        trainerDisplayName: "New coaches on Match Fit",
        focusBlurb: "We will prioritize introductions that respect your match preferences.",
        scaleMin: 1,
        scaleMax: 5,
        lowLabel: "Prefer Established Coaches",
        highLabel: "Excited to Meet New Coaches",
      };

  const q2: DailyInterestPickQuestion = {
    id: "q_week_focus",
    kind: "single_choice",
    prompt: "Which training theme matters most to you this week? (Helps us weight your discovery feed.)",
    options: interestOptionsFromPrefs(prefs),
  };

  const q3: DailyFreeTextQuestion = {
    id: "q_open_signal",
    kind: "free_text",
    prompt:
      "Anything else we should know to improve your matches? (Scheduling quirks, injuries, style preferences, or goals.)",
    placeholder: "Optional — a sentence or two is enough.",
    maxLength: 800,
  };

  return {
    version: 1,
    questions: [q1, q2, q3],
    context: {
      clientZipPrefix: zp,
      summaryLine: `Generated for ZIP prefix ${zp} using your saved preferences and recent coach signups.`,
    },
  };
}

type AlgorithmContext = {
  trainerInterest?: { username: string; displayName: string; rating1to5: number; at: string }[];
  weekFocusPicks?: { value: string; at: string }[];
  openSignals?: { text: string; at: string }[];
};

function parseAlgorithmContext(raw: string | null | undefined): AlgorithmContext {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as AlgorithmContext;
  } catch {
    return {};
  }
}

function serializeAlgorithmContext(ctx: AlgorithmContext): string {
  const cap = <T,>(arr: T[] | undefined, n: number): T[] | undefined => {
    if (!arr) return undefined;
    return arr.slice(-n);
  };
  const trimmed: AlgorithmContext = {
    trainerInterest: cap(ctx.trainerInterest, 40),
    weekFocusPicks: cap(ctx.weekFocusPicks, 60),
    openSignals: cap(ctx.openSignals, 40),
  };
  return JSON.stringify(trimmed);
}

export async function mergeDailyAnswersIntoClientContext(
  clientId: string,
  answers: Record<string, string>,
  questions: DailyQuestionnaireQuestions,
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { dailyAlgorithmContextJson: true },
  });
  const ctx = parseAlgorithmContext(client?.dailyAlgorithmContextJson);
  const at = new Date().toISOString();

  const [q1, q2, q3] = questions.questions;
  const a1 = answers[q1.id]?.trim();
  const a2 = answers[q2.id]?.trim();
  const a3 = answers[q3.id]?.trim();

  const rating = a1 ? Number.parseInt(a1, 10) : NaN;
  if (q1.trainerUsername !== "_platform" && Number.isFinite(rating) && rating >= 1 && rating <= 5) {
    ctx.trainerInterest = [
      ...(ctx.trainerInterest ?? []),
      {
        username: q1.trainerUsername,
        displayName: q1.trainerDisplayName,
        rating1to5: rating,
        at,
      },
    ];
  } else if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
    ctx.trainerInterest = [
      ...(ctx.trainerInterest ?? []),
      {
        username: "_platform",
        displayName: q1.trainerDisplayName,
        rating1to5: rating,
        at,
      },
    ];
  }

  if (a2) {
    ctx.weekFocusPicks = [...(ctx.weekFocusPicks ?? []), { value: a2, at }];
  }
  if (a3) {
    ctx.openSignals = [...(ctx.openSignals ?? []), { text: a3.slice(0, 800), at }];
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { dailyAlgorithmContextJson: serializeAlgorithmContext(ctx) },
  });
}

export async function listDailyQuestionnaireHistory(clientId: string): Promise<DailyQuestionnaireHistoryEntry[]> {
  const since = new Date(Date.now() - DAILY_QUESTIONNAIRE_HISTORY_RETENTION_MS);
  const rows = await prisma.clientDailyQuestionnaire.findMany({
    where: {
      clientId,
      completedAt: { not: null, gte: since },
      answersJson: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: 120,
    select: { id: true, completedAt: true, questionsJson: true, answersJson: true },
  });
  const out: DailyQuestionnaireHistoryEntry[] = [];
  for (const r of rows) {
    if (!r.completedAt || !r.answersJson?.trim()) continue;
    try {
      const questions = JSON.parse(r.questionsJson) as DailyQuestionnaireQuestions;
      const answers = JSON.parse(r.answersJson) as Record<string, string>;
      out.push({
        id: r.id,
        completedAt: r.completedAt.toISOString(),
        questions,
        answers,
      });
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export async function resolveDailyQuestionnaireState(clientId: string): Promise<
  | { state: "active"; questionnaire: { id: string; questions: DailyQuestionnaireQuestions; completedAt: string | null } }
  | { state: "cooldown"; nextAvailableAt: string }
> {
  const now = Date.now();

  await prisma.clientDailyQuestionnaire.updateMany({
    where: {
      clientId,
      archivedAt: null,
      completedAt: null,
      windowStartedAt: { lt: new Date(now - DAILY_QUESTIONNAIRE_INCOMPLETE_TTL_MS) },
    },
    data: { archivedAt: new Date() },
  });

  const latest = await prisma.clientDailyQuestionnaire.findFirst({
    where: { clientId, archivedAt: null },
    orderBy: { windowStartedAt: "desc" },
  });

  if (latest) {
    if (!latest.completedAt) {
      const q = JSON.parse(latest.questionsJson) as DailyQuestionnaireQuestions;
      return {
        state: "active",
        questionnaire: {
          id: latest.id,
          questions: q,
          completedAt: null,
        },
      };
    }

    const sinceComplete = now - latest.completedAt.getTime();
    if (sinceComplete < DAILY_QUESTIONNAIRE_COOLDOWN_MS) {
      return {
        state: "cooldown",
        nextAvailableAt: new Date(latest.completedAt.getTime() + DAILY_QUESTIONNAIRE_COOLDOWN_MS).toISOString(),
      };
    }
  }

  const payload = await buildDailyQuestionnairePayload(clientId);
  const row = await prisma.clientDailyQuestionnaire.create({
    data: {
      clientId,
      windowStartedAt: new Date(),
      questionsJson: JSON.stringify(payload),
    },
  });

  return {
    state: "active",
    questionnaire: {
      id: row.id,
      questions: payload,
      completedAt: null,
    },
  };
}

export function validateAnswers(
  questions: DailyQuestionnaireQuestions,
  answers: Record<string, string>,
): { ok: true } | { ok: false; error: string } {
  for (const q of questions.questions) {
    const v = answers[q.id]?.trim() ?? "";
    if (!v) {
      return { ok: false, error: `Please answer: ${q.prompt.slice(0, 60)}…` };
    }
    if (q.kind === "free_text" && v.length > q.maxLength) {
      return { ok: false, error: "Answer is too long." };
    }
    if (q.kind === "trainer_interest_scale") {
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n) || n < q.scaleMin || n > q.scaleMax) {
        return { ok: false, error: "Pick a value on the interest scale." };
      }
    }
    if (q.kind === "single_choice") {
      const allowed = new Set(q.options.map((o) => o.value));
      if (!allowed.has(v)) {
        return { ok: false, error: "Pick one of the listed options." };
      }
    }
  }
  return { ok: true };
}
