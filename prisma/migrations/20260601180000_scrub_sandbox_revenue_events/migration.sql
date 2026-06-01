-- Scrub sandbox/test revenue from admin metrics (idempotent).

UPDATE "platform_revenue_events" AS pre
SET "billingLiveMode" = false
FROM "clients" AS c
WHERE pre."clientId" = c.id
  AND (
    c."stripeBillingLiveMode" = false
    OR LOWER(c."username") = 'jbfitness6299'
    OR LOWER(c."email") = 'jonnybooth22@gmail.com'
    OR COALESCE(c."internalQaSyntheticPersona", false) = true
    OR LOWER(c."email") LIKE '%@internal.match-fit.invalid'
    OR LOWER(c."email") LIKE '%.invalid'
  );

UPDATE "platform_revenue_events" AS pre
SET "billingLiveMode" = false
FROM "trainers" AS t
WHERE pre."trainerId" = t.id
  AND (
    LOWER(t."username") = 'coachjonny22'
    OR LOWER(t."email") = 'jb@northsideventuresgroup.com'
    OR COALESCE(t."internalQaSyntheticPersona", false) = true
    OR LOWER(t."email") LIKE '%@internal.match-fit.invalid'
    OR LOWER(t."email") LIKE '%.invalid'
    OR LOWER(t."username") LIKE 'mfqst_%'
    OR LOWER(t."username") LIKE 'mfqsc_%'
  );

UPDATE "clients"
SET "stripeBillingLiveMode" = false
WHERE LOWER("username") = 'jbfitness6299'
   OR LOWER("email") = 'jonnybooth22@gmail.com';
