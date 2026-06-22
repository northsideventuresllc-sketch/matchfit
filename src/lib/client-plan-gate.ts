import {
  clientPlanAccessSelect,
  isClientFreemiumGated,
  recordSwipe,
  type ClientPlanAccessFields,
} from "@/lib/client-plan-access";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export { clientPlanAccessSelect };

export async function loadClientPlanAccess(clientId: string): Promise<ClientPlanAccessFields | null> {
  return prisma.client.findUnique({
    where: { id: clientId },
    select: clientPlanAccessSelect,
  });
}

export function freemiumGateResponse(error: string, status = 403): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function requireClientNotFreemiumGated(
  clientId: string,
  errorCode:
    | "FREEMIUM_NO_SCROLL"
    | "FREEMIUM_NO_CHAT"
    | "FREEMIUM_NO_BOOKING"
    | "FREEMIUM_NO_FITHUB_INTERACT"
    | "FREEMIUM_NO_QUESTIONNAIRE",
): Promise<NextResponse | null> {
  const client = await loadClientPlanAccess(clientId);
  if (!client) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (isClientFreemiumGated(client)) {
    return freemiumGateResponse(errorCode);
  }
  return null;
}

export async function requireClientSwipeAllowed(clientId: string): Promise<NextResponse | null> {
  try {
    await recordSwipe(clientId);
    return null;
  } catch (e) {
    if (e instanceof Error && e.message === "SWIPE_LIMIT_REACHED") {
      return freemiumGateResponse("FREEMIUM_SWIPE_LIMIT");
    }
    throw e;
  }
}
