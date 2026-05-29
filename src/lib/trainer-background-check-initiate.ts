import { prisma } from "@/lib/prisma";
import {
  resolveTrainerBackgroundCheckJurisdiction,
  type TrainerBackgroundCheckJurisdiction,
} from "@/lib/trainer-background-check-jurisdiction";

export type TrainerBackgroundCheckInitiationResult = {
  externalReference: string;
  status: string;
  screeningState: string;
  checkrCandidateId?: string;
};

function checkrPackageSlug(trainerId: string): string {
  const configured = process.env.CHECKR_PACKAGE_SLUG?.trim();
  if (configured) return configured;
  return `mf_trainer:${trainerId}`;
}

async function createCheckrCandidate(args: {
  apiKey: string;
  firstName: string;
  lastName: string;
  email: string;
  trainerId: string;
  jurisdiction: TrainerBackgroundCheckJurisdiction;
}): Promise<{ id: string }> {
  const auth = Buffer.from(`${args.apiKey}:`, "utf8").toString("base64");
  const workLocation: Record<string, string> = {
    country: "US",
    state: args.jurisdiction.state,
    zipcode: args.jurisdiction.zip.replace(/\D/g, "").slice(0, 5),
  };
  if (args.jurisdiction.city) {
    workLocation.city = args.jurisdiction.city;
  }

  const res = await fetch("https://api.checkr.com/v1/candidates", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: args.firstName,
      last_name: args.lastName,
      email: args.email,
      work_locations: [workLocation],
      metadata: {
        trainerId: args.trainerId,
        screeningState: args.jurisdiction.state,
        screeningZip: args.jurisdiction.zip,
        jurisdictionSource: args.jurisdiction.source,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Checkr candidate creation failed (${res.status}). ${detail}`.trim());
  }

  const body = (await res.json()) as { id?: string };
  if (!body.id?.trim()) {
    throw new Error("Checkr did not return a candidate id.");
  }
  return { id: body.id.trim() };
}

async function createCheckrInvitation(args: {
  apiKey: string;
  candidateId: string;
  packageSlug: string;
}): Promise<{ id: string }> {
  const auth = Buffer.from(`${args.apiKey}:`, "utf8").toString("base64");
  const res = await fetch("https://api.checkr.com/v1/invitations", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      candidate_id: args.candidateId,
      package: args.packageSlug,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Checkr invitation failed (${res.status}). ${detail}`.trim());
  }

  const body = (await res.json()) as { id?: string };
  if (!body.id?.trim()) {
    throw new Error("Checkr did not return an invitation id.");
  }
  return { id: body.id.trim() };
}

/**
 * Start vendor screening in the trainer's state of residence (from W-9 or signup ZIP).
 * Without CHECKR_API_KEY, records PENDING status and returns a mock reference for local dev.
 */
export async function initiateTrainerBackgroundCheck(args: {
  trainerId: string;
}): Promise<TrainerBackgroundCheckInitiationResult> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: args.trainerId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      profile: {
        select: {
          checkrCandidateId: true,
          backgroundCheckStatus: true,
          serviceZipCode: true,
          w9Json: true,
          betaSlotInPersonHeld: true,
        },
      },
    },
  });

  if (!trainer?.profile) {
    throw new Error("Trainer profile not found.");
  }

  if (trainer.profile.checkrCandidateId) {
    const existingJurisdiction = resolveTrainerBackgroundCheckJurisdiction(trainer.profile);
    return {
      externalReference: trainer.profile.checkrCandidateId,
      status: trainer.profile.backgroundCheckStatus.toLowerCase() || "pending",
      screeningState: "error" in existingJurisdiction ? "unknown" : existingJurisdiction.state,
      checkrCandidateId: trainer.profile.checkrCandidateId,
    };
  }

  const jurisdiction = resolveTrainerBackgroundCheckJurisdiction(trainer.profile);
  if ("error" in jurisdiction) {
    throw new Error(jurisdiction.error);
  }

  const apiKey = process.env.CHECKR_API_KEY?.trim();
  if (!apiKey) {
    const externalReference = `mock-bg-${Date.now().toString(36)}`;
    await prisma.trainerProfile.update({
      where: { trainerId: args.trainerId },
      data: {
        backgroundCheckStatus: "PENDING",
        updatedAt: new Date(),
      },
    });
    return {
      externalReference,
      status: "submitted",
      screeningState: jurisdiction.state,
    };
  }

  const candidate = await createCheckrCandidate({
    apiKey,
    firstName: trainer.firstName,
    lastName: trainer.lastName,
    email: trainer.email,
    trainerId: args.trainerId,
    jurisdiction,
  });

  const packageSlug = checkrPackageSlug(args.trainerId);
  const invitation = await createCheckrInvitation({
    apiKey,
    candidateId: candidate.id,
    packageSlug,
  });

  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: {
      checkrCandidateId: candidate.id,
      backgroundCheckStatus: "PENDING",
      updatedAt: new Date(),
    },
  });

  return {
    externalReference: invitation.id,
    status: "submitted",
    screeningState: jurisdiction.state,
    checkrCandidateId: candidate.id,
  };
}
