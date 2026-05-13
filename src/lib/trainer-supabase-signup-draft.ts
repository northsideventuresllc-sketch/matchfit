/** SessionStorage draft while waiting for Supabase email confirmation (trainer). */
export const TRAINER_SUPABASE_SIGNUP_DRAFT_KEY = "mf_trainer_supabase_signup_draft_v1";

export type TrainerSupabaseSignupDraft = {
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
  stayLoggedIn: boolean;
  turnstileToken?: string;
};

export function readTrainerSignupDraft(): TrainerSupabaseSignupDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TRAINER_SUPABASE_SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as TrainerSupabaseSignupDraft;
    if (!o?.email || !o?.password || !o?.username) return null;
    return o;
  } catch {
    return null;
  }
}

export function writeTrainerSignupDraft(draft: TrainerSupabaseSignupDraft): void {
  sessionStorage.setItem(TRAINER_SUPABASE_SIGNUP_DRAFT_KEY, JSON.stringify(draft));
}

export function clearTrainerSignupDraft(): void {
  sessionStorage.removeItem(TRAINER_SUPABASE_SIGNUP_DRAFT_KEY);
}
