import {
  MATCH_SERVICE_IDS_NUTRITION_OFFERING,
  MATCH_SERVICE_IDS_PT_OFFERING,
  type MatchServiceId,
} from "@/lib/trainer-match-questionnaire";
import type { TrainerServiceOfferingAddOn } from "@/lib/trainer-service-offerings";

export type ServiceAddOnPreset = Pick<TrainerServiceOfferingAddOn, "addonId" | "label"> & {
  description?: string;
};

function pack(list: { id: string; label: string; description?: string }[]): ServiceAddOnPreset[] {
  return list.map((x) => ({
    addonId: x.id,
    label: x.label,
    ...(x.description ? { description: x.description } : {}),
  }));
}

/** Suggested add-ons by service template (coaches multi-select in step 3). */
export function serviceAddOnPresetOptions(serviceId: MatchServiceId): ServiceAddOnPreset[] {
  if (MATCH_SERVICE_IDS_NUTRITION_OFFERING.includes(serviceId)) {
    return pack([
      { id: "n_img_recipe", label: "Weekly photo food log review (+15 min)" },
      { id: "n_grocery", label: "Grocery list refresh add-on" },
      { id: "n_macro", label: "Macro target tune-up between sessions" },
      { id: "n_text", label: "Extra weekday text accountability" },
      { id: "n_meal", label: "Meal-prep walkthrough (virtual)" },
    ]);
  }
  if (serviceId === "online_program") {
    return pack([
      { id: "p_form", label: "Form check video review" },
      { id: "p_program", label: "Program tweak between phases" },
      { id: "p_habit", label: "Weekly habit accountability call" },
      { id: "p_video", label: "Custom demo video for one lift" },
    ]);
  }
  if (MATCH_SERVICE_IDS_PT_OFFERING.includes(serviceId)) {
    return pack([
      { id: "pt_checkin", label: "15-minute motivational check-in call" },
      { id: "pt_recovery", label: "Recovery & mobility mini-session add-on" },
      { id: "pt_nutrition_touch", label: "Quick nutrition accountability touchpoint" },
      { id: "pt_program_tweak", label: "Program adjustment between full sessions" },
      { id: "pt_form", label: "Video form review between sessions" },
      { id: "pt_partner", label: "Bring-a-friend single session upgrade" },
    ]);
  }
  return pack([
    { id: "gen_extra", label: "Short follow-up check-in between sessions" },
    { id: "gen_resource", label: "Custom resource or worksheet add-on" },
  ]);
}
