import { getSupabaseServiceClient } from "@/lib/supabase/service-client";

export type TrainerCheckrVaultRow = {
  trainer_id: string;
  checkr_candidate_id: string | null;
  checkr_report_id: string | null;
  checkr_invitation_id: string | null;
  report_portal_url: string | null;
  last_webhook_type: string | null;
  last_webhook_payload: Record<string, unknown> | null;
  updated_at: string;
};

export async function upsertTrainerCheckrVault(
  trainerId: string,
  patch: Partial<
    Pick<
      TrainerCheckrVaultRow,
      | "checkr_candidate_id"
      | "checkr_report_id"
      | "checkr_invitation_id"
      | "report_portal_url"
      | "last_webhook_type"
      | "last_webhook_payload"
    >
  >,
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.warn("[checkr-vault] Supabase service role not configured; skipping vault write.");
    return;
  }

  const existing = await getTrainerCheckrVault(trainerId);
  const row = {
    trainer_id: trainerId,
    checkr_candidate_id: patch.checkr_candidate_id ?? existing?.checkr_candidate_id ?? null,
    checkr_report_id: patch.checkr_report_id ?? existing?.checkr_report_id ?? null,
    checkr_invitation_id: patch.checkr_invitation_id ?? existing?.checkr_invitation_id ?? null,
    report_portal_url: patch.report_portal_url ?? existing?.report_portal_url ?? null,
    last_webhook_type: patch.last_webhook_type ?? existing?.last_webhook_type ?? null,
    last_webhook_payload: patch.last_webhook_payload ?? existing?.last_webhook_payload ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("trainer_checkr_vault").upsert(row, { onConflict: "trainer_id" });
  if (error) {
    console.error("[checkr-vault] upsert failed", error.message);
  }
}

export async function getTrainerCheckrVault(trainerId: string): Promise<TrainerCheckrVaultRow | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("trainer_checkr_vault")
    .select("*")
    .eq("trainer_id", trainerId)
    .maybeSingle();

  if (error) {
    console.error("[checkr-vault] read failed", error.message);
    return null;
  }
  return (data as TrainerCheckrVaultRow | null) ?? null;
}

export async function findTrainerIdByCheckrReportId(reportId: string): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("trainer_checkr_vault")
    .select("trainer_id")
    .eq("checkr_report_id", reportId)
    .maybeSingle();

  if (error || !data) return null;
  return typeof data.trainer_id === "string" ? data.trainer_id : null;
}
