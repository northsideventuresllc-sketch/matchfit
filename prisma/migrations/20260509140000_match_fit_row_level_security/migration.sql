-- Match Fit Row Level Security for Supabase PostgREST (anon / authenticated JWT roles).
-- Column identifiers are quoted camelCase to match Prisma `db push` on PostgreSQL for this project.
-- Prisma uses the database connection role (typically bypasses RLS); set JWT claims from Edge Functions
-- or custom auth if clients query Postgres directly.
--
-- JWT shape (app_metadata):
--   { "trainer_id": "<cuid>", "client_id": "<cuid>" }  -- set exactly one for end users.
--
-- Policies summary:
--   anon: SELECT on discoverable trainers + their trainer_profiles only.
--   authenticated + trainer_id claim: full CRUD on own trainer-owned rows (profile, bids, sessions, etc.).
--   authenticated + client_id claim: SELECT + UPDATE only on own clients row (subscriptions + profile fields live there).
--   Everything else: denied for anon/authenticated (service role / owner bypass unchanged).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_fit_jwt_trainer_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(BTRIM(COALESCE((auth.jwt() -> 'app_metadata' ->> 'trainer_id'), '')), '');
$$;

CREATE OR REPLACE FUNCTION public.match_fit_jwt_client_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(BTRIM(COALESCE((auth.jwt() -> 'app_metadata' ->> 'client_id'), '')), '');
$$;

-- Mirrors app gates for published coaches (see lib/trainer-compliance-complete.ts); BG expiry omitted for SQL simplicity.
CREATE OR REPLACE FUNCTION public.match_fit_profile_discoverable(profile_row public.trainer_profiles)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN profile_row."dashboardActivatedAt" IS NOT NULL
    AND profile_row."hasSignedTOS" IS TRUE
    AND profile_row."hasUploadedW9" IS TRUE
    AND profile_row."backgroundCheckStatus" = 'APPROVED'
    AND profile_row."backgroundCheckClearedAt" IS NOT NULL
    AND (NOT profile_row."onboardingTrackCpt" OR profile_row."certificationReviewStatus" = 'APPROVED')
    AND (
      NOT profile_row."onboardingTrackNutrition"
      OR profile_row."nutritionistCertificationReviewStatus" = 'APPROVED'
    )
    AND (
      NOT profile_row."onboardingTrackSpecialist"
      OR COALESCE(profile_row."specialistCertificationReviewStatus", 'NOT_STARTED') = 'APPROVED'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_fit_jwt_trainer_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_fit_jwt_client_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_fit_profile_discoverable(public.trainer_profiles) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- ENABLE RLS on all application tables (not Prisma's migration ledger)
-- ---------------------------------------------------------------------------

ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_administrator_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_two_factor_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_client_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_daily_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_idea_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_fit_hub_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_fit_hub_post_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_fit_hub_post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_fit_hub_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_fit_hub_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_fit_hub_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_saved_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_trainer_browse_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_browse_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_two_factor_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_trainer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_admin_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_discover_match_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_video_conference_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booked_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_trainer_punch_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_payout_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_package_cancellation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diy_plan_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspension_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_raffle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_placement_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_daily_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_token_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_fit_hub_post_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_weekly_token_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_service_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_business_mileage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_business_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_coaching_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_client_session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_trainer_token_gifts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Discovery feed (anon + authenticated): published trainers + profiles only
-- ---------------------------------------------------------------------------

CREATE POLICY match_fit_anon_discover_trainers
  ON public.trainers
  FOR SELECT
  TO anon
  USING (
    trainers."deidentifiedAt" IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.trainer_profiles p
      WHERE p."trainerId" = trainers.id
        AND public.match_fit_profile_discoverable(p)
    )
  );

CREATE POLICY match_fit_auth_discover_trainers
  ON public.trainers
  FOR SELECT
  TO authenticated
  USING (
    (
      trainers."deidentifiedAt" IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.trainer_profiles p
        WHERE p."trainerId" = trainers.id
          AND public.match_fit_profile_discoverable(p)
      )
    )
    OR trainers.id = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_manage_trainers_self
  ON public.trainers
  FOR ALL
  TO authenticated
  USING (trainers.id IS NOT NULL AND trainers.id = public.match_fit_jwt_trainer_id())
  WITH CHECK (trainers.id IS NOT NULL AND trainers.id = public.match_fit_jwt_trainer_id());

CREATE POLICY match_fit_anon_discover_trainer_profiles
  ON public.trainer_profiles
  FOR SELECT
  TO anon
  USING (public.match_fit_profile_discoverable(trainer_profiles));

CREATE POLICY match_fit_auth_discover_trainer_profiles
  ON public.trainer_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.match_fit_profile_discoverable(trainer_profiles)
    OR trainer_profiles."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_manage_profiles_self
  ON public.trainer_profiles
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_profiles."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_profiles."trainerId" = public.match_fit_jwt_trainer_id()
  );

-- ---------------------------------------------------------------------------
-- Clients: subscriptions + profile live on clients — narrow client JWT access
-- ---------------------------------------------------------------------------

CREATE POLICY match_fit_client_own_row_select
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.match_fit_jwt_client_id() IS NOT NULL
    AND clients.id = public.match_fit_jwt_client_id()
  );

CREATE POLICY match_fit_client_own_row_update
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    public.match_fit_jwt_client_id() IS NOT NULL
    AND clients.id = public.match_fit_jwt_client_id()
  )
  WITH CHECK (
    public.match_fit_jwt_client_id() IS NOT NULL
    AND clients.id = public.match_fit_jwt_client_id()
  );

-- ---------------------------------------------------------------------------
-- Trainer-owned rows: trainer_id = JWT trainer_id (full CRUD)
-- ---------------------------------------------------------------------------

CREATE POLICY match_fit_trainer_scope_all
  ON public.trainer_two_factor_channels
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_two_factor_channels."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_two_factor_channels."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_nudges
  ON public.trainer_client_nudges
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_nudges."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_nudges."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_fithub_posts
  ON public.trainer_fit_hub_posts
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_fit_hub_posts."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_fit_hub_posts."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_notifications
  ON public.trainer_notifications
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_notifications."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_notifications."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_trainer_browse_passes
  ON public.trainer_client_browse_passes
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_browse_passes."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_browse_passes."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_discover_batches
  ON public.trainer_discover_match_batches
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_discover_match_batches."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_discover_match_batches."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_video_connections
  ON public.trainer_video_conference_connections
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_video_conference_connections."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_video_conference_connections."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_sessions
  ON public.booked_training_sessions
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND booked_training_sessions."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND booked_training_sessions."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_punch_ins
  ON public.session_trainer_punch_ins
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND session_trainer_punch_ins."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND session_trainer_punch_ins."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_pkg_cancel
  ON public.trainer_package_cancellation_requests
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_package_cancellation_requests."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_package_cancellation_requests."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_diy
  ON public.diy_plan_engagements
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND diy_plan_engagements."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND diy_plan_engagements."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_raffle
  ON public.featured_raffle_entries
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND featured_raffle_entries."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND featured_raffle_entries."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_bids
  ON public.featured_placement_bids
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND featured_placement_bids."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND featured_placement_bids."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_daily_allocation
  ON public.featured_daily_allocations
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND featured_daily_allocations."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND featured_daily_allocations."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_token_balance
  ON public.trainer_token_balances
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_token_balances."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_token_balances."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_token_ledger
  ON public.trainer_token_ledger_entries
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_token_ledger_entries."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_token_ledger_entries."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_post_promo
  ON public.trainer_fit_hub_post_promotions
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_fit_hub_post_promotions."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_fit_hub_post_promotions."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_weekly_grants
  ON public.trainer_weekly_token_grants
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_weekly_token_grants."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_weekly_token_grants."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_service_tx
  ON public.trainer_client_service_transactions
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_service_transactions."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_service_transactions."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_mileage
  ON public.trainer_business_mileage_entries
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_business_mileage_entries."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_business_mileage_entries."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_expenses
  ON public.trainer_business_expenses
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_business_expenses."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_business_expenses."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_coaching_profiles
  ON public.trainer_client_coaching_profiles
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_coaching_profiles."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_coaching_profiles."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_goals
  ON public.trainer_client_goals
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_goals."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_goals."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_summaries
  ON public.trainer_client_session_summaries
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_session_summaries."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_session_summaries."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_token_gifts
  ON public.client_trainer_token_gifts
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND client_trainer_token_gifts."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND client_trainer_token_gifts."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_conversations
  ON public.trainer_client_conversations
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_conversations."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND trainer_client_conversations."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_reviews_about_me
  ON public.client_trainer_reviews
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND client_trainer_reviews."trainerId" = public.match_fit_jwt_trainer_id()
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND client_trainer_reviews."trainerId" = public.match_fit_jwt_trainer_id()
  );

CREATE POLICY match_fit_trainer_scope_chat_messages
  ON public.trainer_client_chat_messages
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.trainer_client_conversations c
      WHERE c.id = trainer_client_chat_messages."conversationId"
        AND c."trainerId" = public.match_fit_jwt_trainer_id()
    )
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.trainer_client_conversations c
      WHERE c.id = trainer_client_chat_messages."conversationId"
        AND c."trainerId" = public.match_fit_jwt_trainer_id()
    )
  );

CREATE POLICY match_fit_trainer_scope_reschedule
  ON public.session_reschedule_requests
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.booked_training_sessions b
      WHERE b.id = session_reschedule_requests."bookedTrainingSessionId"
        AND b."trainerId" = public.match_fit_jwt_trainer_id()
    )
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.booked_training_sessions b
      WHERE b.id = session_reschedule_requests."bookedTrainingSessionId"
        AND b."trainerId" = public.match_fit_jwt_trainer_id()
    )
  );

CREATE POLICY match_fit_trainer_scope_payout_disputes
  ON public.session_payout_disputes
  FOR ALL
  TO authenticated
  USING (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.booked_training_sessions b
      WHERE b.id = session_payout_disputes."bookedTrainingSessionId"
        AND b."trainerId" = public.match_fit_jwt_trainer_id()
    )
  )
  WITH CHECK (
    public.match_fit_jwt_trainer_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.booked_training_sessions b
      WHERE b.id = session_payout_disputes."bookedTrainingSessionId"
        AND b."trainerId" = public.match_fit_jwt_trainer_id()
    )
  );
