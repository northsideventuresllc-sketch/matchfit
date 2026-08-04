# Match Fit Worldwide Rollout Plan (v2.14.1-beta → 2.15.0-beta)

Authority: JB directive, NI-Brain Decision #452. Seven rulings: (1) worldwide registration, no geo circle; (2) admission by cap limits only; (3) marketing aimed at first-tier countries with DPMO updated — product reach and marketing reach are separate axes, never collapsed; (4) language filter; (5) in-person geo barrier removed, everyone can offer everything; (6) geography becomes a client preference (dating-app style), never a gate; (7) minor version bump.

Binding constraints for every work package (WP):

- Nothing routes to a paid API, ever. No paid geocoding.
- NI-Brain Decision #342 stands: no city/metro/polygon/lat-long in coach-recruiting outreach. Executable guard `src/__tests__/outreach-geo-guard.test.ts` scans every `src/lib/outreach*.ts` for `/atlanta/i`, `/\bgeorgia\b/i`, `/\bmidtown\b/i`, `/old fourth ward/i`, `/\bo4w\b/i`, `/inman park/i`, `/\bpolygon\b/i`, lat/long literals. COUNTRY-level marketing tiers are allowed. **NOTE: the country "Georgia" would trip `/\bgeorgia\b/i` — never list it in any `src/lib/outreach*.ts` file.**
- Approve-only: nothing sends/posts/publishes without JB.
- DB migrations additive only. Making a required column nullable is allowed; dropping columns or data is NOT.
- Version via `npm run version:bump -- minor --reason "..."`. Never hand-edit version strings.
- UI copy: sentence case for body/labels/errors; Title Case for page titles and standalone CTAs. Never show a raw DB value or internal code. User-facing label is "Fitness Pro"; `trainer` in code/routes/DB stays.
- No "AI-powered/AI matching" in user-facing copy — say "algorithmic matching".
- Every WP ends with `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` green.
- Do NOT touch `TrainerSessionPunchIn` lat/long (`prisma/schema.prisma` ~:1655) — attendance audit only.

---

## 0. The one design decision: how "distance" works worldwide

**Decision: coarse location-scope tiers, not true mile radius.** No paid geocoding is allowed, and the repo contains no distance math, no user lat/long, and no zip-centroid dataset. True worldwide mile-radius would require bundling and normalising a free postal-centroid dataset (e.g. GeoNames, ~1.5M rows, wildly inconsistent per-country postal coverage) plus per-country postal parsing — a large, risky subsystem that ruling 6 does not require.

The client preference is a three-position slider (dating-app "distance" spirit, discrete stops):

| Slider stop | Value (code) | Semantics |
|---|---|---|
| Near me | `near_me` | Same country AND same postal region prefix (US: first 3 ZIP digits — matches existing `regionZipPrefix`; CA: FSA; GB: outward code; other: first 2–3 alphanumeric postal chars, falling back to same-country when either side has no postal code) |
| My country | `my_country` | Same ISO country code |
| Worldwide | `worldwide` | No location constraint. **DEFAULT** |

Honest trade-off: "Near me" precision varies by country (a US ZIP3 is a metro; a GB outward code is a neighbourhood; a country with no postal data degrades to country-level). Acceptable because per ruling 6 geography narrows, never gates, and the default is worldwide. A real km-radius stop can be added later behind the same `locationScope` contract by bundling offline centroids — explicitly out of scope now.

This requires structured location data we do not have today: an ISO 3166-1 alpha-2 `countryCode` captured at registration (required in the form; nullable in DB; backfilled `"US"` for existing rows, safe because every existing account passed the US-ZIP wall) and a free-form `postalCode` (optional, max 20 chars, trimmed/uppercased, **never digit-stripped**).

---

## 1. Schema contract — OWNED EXCLUSIVELY BY WP-1

No other WP may edit `prisma/schema.prisma`, the new migration, or the two new shared modules. Everyone else imports.

### 1.1 Prisma changes (one additive migration)

| Model | Change | Kind |
|---|---|---|
| `Client` | `zipCode String` → `zipCode String?` | nullable-relaxing |
| `Client` | add `countryCode String?` (ISO 3166-1 alpha-2), `postalCode String?` | additive |
| `PendingClientRegistration` | `zipCode String` → `String?`; add `countryCode String?`, `postalCode String?` | relax + additive |
| `TrainerProfile` | add `countryCode String?`, `postalCode String?` | additive |
| `TrainerProfile` | add `spokenLanguageCodes String[] @default([])` — the SQL-filterable language column | additive |
| `BetaTrainerWaitlistEntry` | `serviceZipCode String` → `String?`; add `countryCode String?` | relax + additive |
| `BetaClientWaitlistEntry` | `homeZipCode String` → `String?`; add `countryCode String?` | relax + additive |

`TrainerProfile.serviceZipCode` is already nullable — leave it. Do NOT drop `virtualOnlyBetaSlot` — it goes dormant; dropping is destructive.

Backfill inside the same migration (data-safe SQL), adjusting table/column casing to the actual Prisma mapping:

- `UPDATE clients SET "countryCode"='US', "postalCode"="zipCode" WHERE "zipCode" IS NOT NULL AND "countryCode" IS NULL;`
- Same pattern for `TrainerProfile` (from `serviceZipCode`), both waitlist tables, and `PendingClientRegistration`.

### 1.2 New shared module: `src/lib/user-location.ts` (NEW, WP-1)

Pure, no Prisma import (client-component safe). Exports:

- `COUNTRY_OPTIONS: { code: string; label: string }[]` — ISO 3166-1 alpha-2, English labels.
- `isValidCountryCode(code: string): boolean`
- `normalizePostalCode(countryCode, raw): string | null` — trim, collapse inner whitespace, uppercase, max 20; null when empty. **Never strips non-digits.**
- `postalRegionPrefix(countryCode, postal): string | null` — US: first 3 digits (must exactly reproduce today's `regionZipPrefix`, verify against `src/lib/featured-homepage-data.ts:39-46`); CA: first 3 (FSA); GB: outward code; default: first 3 alphanumerics or null.
- `LOCATION_SCOPES = ["near_me","my_country","worldwide"] as const`, `locationScopeSchema`, `LOCATION_SCOPE_LABELS` ("Near me", "My country", "Worldwide").
- `type UserLocation = { countryCode: string | null; postalCode: string | null }`
- `locationScopeMatch(scope, client, pro): boolean` — pure predicate; unknown pro location under `near_me`/`my_country` returns false; `worldwide` always true.

### 1.3 New shared module: `src/lib/languages.ts` (NEW, WP-1)

- `SPOKEN_LANGUAGE_CODES` — ISO 639-1, superset of today's six (~30): en, es, fr, pt, zh, de, it, nl, ru, ar, hi, bn, ur, ja, ko, vi, th, id, ms, tl, tr, pl, uk, ro, el, sv, no, da, fi, he, sw, plus `"other"`.
- `SPOKEN_LANGUAGE_LABELS: Record<code, string>`.
- `LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE` — `english→en, spanish→es, french→fr, portuguese→pt, mandarin→zh, other→other`.
- `normalizeSpokenLanguageIds(ids: string[]): string[]` — maps legacy ids, passes through valid codes, dedupes, drops unknowns.

### 1.4 Client match-preferences zod extension (contract here; code in WP-5a's file)

Two new OPTIONAL-with-default fields appended to `clientMatchPreferencesSchema` in `src/lib/client-match-preferences.ts`:

```ts
locationScope: locationScopeSchema.default("worldwide"),
/** Empty array = any language. */
languages: z.array(z.enum(SPOKEN_LANGUAGE_CODES)).default([]),
```

Defaults guarantee every stored `matchPreferencesJson` blob keeps parsing. `defaultClientMatchPreferences` gains `locationScope: "worldwide"`, `languages: []`.

### 1.5 Trainer questionnaire language contract (code in WP-6's file)

`languages` becomes `z.array(z.string()).min(1)` refined so every entry is a legacy id OR a `SPOKEN_LANGUAGE_CODES` value. Old stored answers stay valid; writes normalise to codes via `normalizeSpokenLanguageIds` and mirror to `TrainerProfile.spokenLanguageCodes`.

---

## 2. Work packages

File lists are DISJOINT. If a file is not in your list, do not touch it. Shared-file rulings: `src/lib/trainer-in-person-service-area.ts` → WP-3. `src/lib/trainer-match-questionnaire.ts` → WP-6 (does BOTH language expansion and in-person-zip gate removal). `src/lib/trainer-promo-tokens.ts` → WP-4.

### WP-1 — Schema and shared contracts
Goal: land the additive migration and the two shared modules everyone imports.
Done means: migration applied via `npm run db:push` locally and committed under `prisma/migrations/`; `src/lib/user-location.ts` and `src/lib/languages.ts` exist with unit tests; typecheck green.
Owns: `prisma/schema.prisma`; new `prisma/migrations/*worldwide*/`; `src/lib/user-location.ts`; `src/lib/languages.ts`; `src/__tests__/user-location.test.ts`; `src/__tests__/languages.test.ts`.
Does NOT own: any consumer (WP-2..7); any UI.
Depends on: nothing.

### WP-2 — Offerings landmine defusal (read path FIRST)
Goal: make the offerings read parser strictly more permissive than every historical write, then remove the Atlanta/US-zip write requirement — in that order.
Done means: TWO separate commits. **Commit A (must be first commit of the whole programme):** split `trainerServiceOfferingsDocumentSchema` into a base object schema (read) and a write schema (base + superRefine). `parseTrainerServiceOfferingsJson` (`src/lib/trainer-service-offerings-document.ts:514-523`) parses with the READ schema, which does NOT run the `inPersonServiceZip` / `inPersonServiceRadiusMiles` checks at :416-434 — those move to the write schema only. Regression test: a stored doc with in-person lines + Atlanta zip, one with a GB-style postal, and one with null zip all parse to their real lines, never the empty default. **Commit B (after A):** `inPersonServiceZip` becomes optional free-form (max 20); `inPersonServiceRadiusMiles` optional (no longer required for in-person lines); `src/lib/trainer-service-offerings.ts:144-152` virtual-coercion and :217-221 enforcement updated so in-person lines with any/no postal survive publish and read-back.
Owns: `src/lib/trainer-service-offerings-document.ts`; `src/lib/trainer-service-offerings.ts`; test files matching `src/__tests__/*service-offering*`.
Does NOT own: `src/lib/trainer-in-person-service-area.ts` (WP-3); publish routes (consumers only — keep exported symbol names stable rather than editing routes); checkout (WP-4); questionnaire (WP-6).
Depends on: nothing. Commit A is the first commit of the programme.

### WP-3 — Worldwide registration and cap-only admission
Goal: anyone on Earth can register; admission decided only by cap counts.
Done means: signup accepts `countryCode` (required select) + optional free-form postal; no US-ZIP regex on any registration or waitlist path; single global caps; `evaluateBetaTrainerRegistrationGate` no longer returns `INVALID_SERVICE_ZIP`.
Tasks:
- `src/lib/validations/client-register.ts:69-72` and `src/lib/validations/trainer-register.ts:34-40`: replace `\d{5}` regex fields with `countryCode` (via `isValidCountryCode`) + optional `postalCode` (via `normalizePostalCode`). API and UI ship in the same PR — no alias needed.
- `src/lib/beta-trainer-register-gate.ts:15-23`: **DELETE the zip pre-check** (it runs even with gates off — the hardest blocker). Gate becomes: gates off → ok; cap not reached → ok; else invite check.
- `src/lib/trainer-in-person-service-area.ts`: keep export `isValidUsServiceZip` (deprecated); rewrite `inPersonServiceZipValidationError` to worldwide rules — null/empty OK (postal optional); >20 chars or control chars → "Enter a valid postal code for your in-person area."
- `src/lib/trainer-service-zip.ts:4-14`: `normalizeTrainerServiceZip` MUST stop stripping non-digits (corrupts UK/CA postcodes). Delegate to `normalizePostalCode`.
- Waitlist: `src/app/api/public/beta-waitlist/trainer/route.ts:21`, `.../client/route.ts:21`, `src/lib/beta-waitlist-service.ts:95-97` — accept country + optional postal; write `countryCode`.
- UI: `src/app/client/sign-up/page.tsx:60-62,227-231`, `src/app/trainer/signup/trainer-sign-up-client.tsx:33-35` — country `<select>` from `COUNTRY_OPTIONS` + optional "Postal code" text input (sentence case).
- Writers: `src/lib/client-register-finalize.ts:49,82`, `src/lib/client-registration-hold.ts:13,49`, `src/lib/trainer-register-service.ts:25,56` — persist `countryCode`/`postalCode`; keep writing `zipCode`/`serviceZipCode` when the postal is a US ZIP (existing prefix machinery reads them).
- Caps: `src/lib/beta-launch-config.ts` — single global `betaMaxTrainers()`/`betaMaxClients()`. Make `betaMaxTrainersAtlanta()`/`betaMaxTrainersVirtual()` deprecated aliases returning `betaMaxTrainers()`; do not delete env plumbing. `src/lib/beta-cap-enforcement.ts:49,75,101` and `src/lib/launch-account-counts.ts:390-412` count globally, no pool split.
- Retire the dormant pool: `src/lib/beta-trainer-pool.ts` + its test may be deleted (verify with grep that app code never calls it). Keep `src/lib/beta-atlanta-metro-zips.ts` with a header comment that it is legacy display data only.
- `src/lib/probe-client-register-insert.ts:27` — add `countryCode: "US"`. `src/lib/signup-form-progress.ts:11` — track `countryCode`.
- **Checkr FLAG (do not silently break):** `src/lib/checkr-api-client.ts:83` hardcodes US work location. Add a guard: if the Pro's `countryCode` is present and not "US", do not call Checkr; surface the existing status flow as not-started with a documented reason, and add `// WORLDWIDE-TODO(JB decision needed): background checks are US-only via Checkr`.
Owns: `src/lib/validations/client-register.ts`; `src/lib/validations/trainer-register.ts`; `src/lib/beta-trainer-register-gate.ts`; `src/lib/beta-client-register-gate.ts`; `src/lib/trainer-in-person-service-area.ts`; `src/lib/trainer-service-zip.ts`; `src/lib/client-register-finalize.ts`; `src/lib/client-registration-hold.ts`; `src/lib/trainer-register-service.ts`; `src/lib/beta-waitlist-service.ts`; `src/app/api/public/beta-waitlist/trainer/route.ts`; `src/app/api/public/beta-waitlist/client/route.ts`; `src/app/client/sign-up/page.tsx`; `src/app/trainer/signup/trainer-sign-up-client.tsx`; `src/lib/beta-launch-config.ts`; `src/lib/beta-cap-enforcement.ts`; `src/lib/launch-account-counts.ts`; `src/lib/beta-trainer-pool.ts`; `src/__tests__/beta-trainer-pool.test.ts`; `src/lib/beta-atlanta-metro-zips.ts`; `src/lib/probe-client-register-insert.ts`; `src/lib/signup-form-progress.ts`; `src/lib/checkr-api-client.ts`.
Does NOT own: schema (WP-1); offerings schemas (WP-2); checkout/featured (WP-4); questionnaire (WP-6); preferences (WP-5a).
Depends on: WP-1; WP-2 Commit A.

### WP-4 — In-person purchase and featured eligibility, worldwide
Goal: any client can buy any in-person offering; virtual-only and non-US Pros are eligible for featured/boost.
Done means: the `BETA_IN_PERSON_GEO` 403 path is gone; featured/bid/raffle no longer require a US in-person zip.
Tasks:
- Delete `src/lib/beta-client-in-person-checkout-gate.ts` and its enforcement at `src/app/api/client/trainers/[username]/service-checkout/route.ts:143-149` and `src/app/client/checkout/coach-service/page.tsx:209-225` (remove imports; leave the rest intact — checkout's offerings parse at route.ts:131 untouched).
- Featured eligibility: `src/app/api/trainer/featured-listing/route.ts:37-45`, `bid/route.ts:45-54`, `raffle/route.ts:39-48`, `src/lib/trainer-promo-tokens.ts:311-320` — no longer require an in-person US zip. Region key: `postalRegionPrefix(countryCode, postalCode ?? serviceZipCode)`; when null use the literal bucket `"global"` (new bucket, NOT an error). **US Pros must keep producing the identical 3-digit prefix as today** — no allocation-key churn.
- `src/lib/trainer-promo-tokens.ts:213-222` prefix boost: same prefix computation; no boost when either side is null (neutral, not penalised).
Owns: `src/lib/beta-client-in-person-checkout-gate.ts` (delete); `src/app/api/client/trainers/[username]/service-checkout/route.ts`; `src/app/client/checkout/coach-service/page.tsx`; `src/app/api/trainer/featured-listing/route.ts`; `.../bid/route.ts`; `.../raffle/route.ts`; `src/lib/trainer-promo-tokens.ts`.
Does NOT own: `src/lib/featured-competition.ts`, `src/lib/featured-homepage-data.ts`, `src/app/api/client/fithub/feed/route.ts` (WP-5b) — keep export signatures stable, additive params only.
Depends on: WP-1; WP-2 (both commits).

### WP-5a — Client preference: location scope slider + language filter (store and UI)
Goal: clients set "Near me / My country / Worldwide" and preferred spoken languages; applies across all Pro tiers.
Done means: preferences form shows a 3-stop slider and a language multi-select; PATCH persists them; parse helpers exported for WP-5b.
Tasks:
- `src/lib/client-match-preferences.ts`: add the two fields per §1.4; extend `scoreTrainerForClientPrefs` ADDITIVELY (new optional `location`/`spokenLanguageCodes` inputs) — language match adds +6 when the Pro's codes intersect `prefs.languages`; **Pros with EMPTY `spokenLanguageCodes` are treated as unknown: shown, no bonus, never excluded** (protects unbackfilled Pros). Export `clientLocationPredicate(prefs, clientLoc, proLoc)` delegating to `locationScopeMatch`. Add location to `trainerPassesStrictBrowse` (strict respects scope; the existing relaxed fallback widens to worldwide — preference, never gate).
- `src/components/client/client-match-preferences-form.tsx`: new control near the checkbox cards (:203-240). Slider MUST follow the existing precedent — native `<input type="range">` with `accent-[#FF7E00]` and a visible label of the selected stop (see `src/components/trainer/trainer-discover-clients-client.tsx:263`); 3 stops; copy sentence case: "Show Fitness Pros near me", "My country", "Worldwide". Language filter: checkbox-card multi-select from `SPOKEN_LANGUAGE_LABELS`, helper text "Leave empty to see Fitness Pros who coach in any language."
- `src/app/api/client/preferences/route.ts` PATCH (:40-125): accept/validate the new fields.
- Pages `src/app/client/dashboard/(app)/preferences/page.tsx` and `.../preferences/onboarding/page.tsx`: pass through.
Owns: `src/lib/client-match-preferences.ts`; `src/components/client/client-match-preferences-form.tsx`; `src/app/api/client/preferences/route.ts`; `src/app/client/dashboard/(app)/preferences/page.tsx`; `src/app/client/dashboard/(app)/preferences/onboarding/page.tsx`.
Does NOT own: any consumer route (WP-5b); questionnaire/Pro side (WP-6).
Depends on: WP-1.

### WP-5b — Discovery surfaces apply the preference
Goal: every list-of-Pros surface honours `locationScope` + `languages`; the "in your area" copy lie is fixed; caches keyed correctly.
Reality check: there is NO geo filter in discovery today — this is new capability. Filtering happens in application code after `findMany` (browse loads the whole visible table into memory — do not re-architect here, but add `take: 500` as a safety cap with a comment).
Tasks:
- `src/app/api/client/trainers/browse/route.ts` (:79-100,:144,:148): co-select `countryCode`, `postalCode`, `serviceZipCode`, `spokenLanguageCodes` on the trainer query and the client's location fields; apply `clientLocationPredicate` in the strict pass; relaxed pass = worldwide; feed languages into the scorer.
- `src/app/api/trainer/dashboard/discover-clients/route.ts` (:118,:155-174): symmetric — respect the client's `locationScope` against the Pro's own location. **CACHE FIX:** `TrainerDiscoverMatchBatch` (:178-205) freezes 10 client IDs per 12-hour bucket; include a short hash of the filter inputs in the batch key so a preference change mints a fresh batch instead of a silently shrunken one.
- `src/app/api/client/fithub/feed/route.ts` (:82,:90,:160-172): apply the same predicate to ranking inputs; prefix boost unchanged for US.
- `src/lib/client-daily-questionnaire.ts` (:114-160,:198,:203): **FIX THE COPY/BEHAVIOUR LIE** — copy says "in your area" but the query is worldwide. Apply the client's `locationScope`; when scope is `worldwide`, change copy to "Fitness Pros matched to your preferences".
- `src/lib/featured-homepage-data.ts` (:39-46): compute prefix via `postalRegionPrefix`; when null, query the `"global"` bucket instead of returning an empty array.
- `src/lib/featured-competition.ts` (:67-115): allocation stays keyed `(regionZipPrefix, displayDayKey)`; only change is that `"global"` is a valid region value. **DO NOT change key semantics for existing US prefixes** — existing `FeaturedDailyAllocation` rows must stay valid.
- `src/lib/home-meet-coaches-data.ts` (:31-67): zip is display-only; show "Virtual" or country name instead of a raw US zip for non-US Pros (never a raw DB value).
- `src/lib/match-fit-public-marketplace-hidden.ts:117-124` and `src/lib/trainer-client-discovery.ts:90-99`: **NO geo added to these WHERE builders** (geography is never a gate); touch only if select-lists need new columns.
Owns: `src/app/api/client/trainers/browse/route.ts`; `src/app/api/trainer/dashboard/discover-clients/route.ts`; `src/app/api/client/fithub/feed/route.ts`; `src/lib/client-daily-questionnaire.ts`; `src/lib/featured-homepage-data.ts`; `src/lib/featured-competition.ts`; `src/lib/home-meet-coaches-data.ts`; `src/lib/match-fit-public-marketplace-hidden.ts`; `src/lib/trainer-client-discovery.ts`.
Does NOT own: `src/lib/client-match-preferences.ts` (WP-5a); `src/lib/trainer-promo-tokens.ts` (WP-4).
Depends on: WP-1, WP-5a, WP-6 (may merge before WP-6's backfill runs — empty array = unknown = never excluded).

### WP-6 — Language capability on the Pro side
Goal: Pros declare languages from a worldwide list; a SQL-filterable `spokenLanguageCodes` column is populated; the questionnaire's in-person US-zip hard gate is removed.
Done means: questionnaire accepts old and new language values; submit writes `TrainerProfile.spokenLanguageCodes`; backfill script exists; in-person zip optional.
Tasks:
- `src/lib/trainer-match-questionnaire.ts`: replace `LANGUAGE_IDS`/`LANGUAGE_LABELS` (:137,:209-216) with `src/lib/languages.ts`; schema per §1.5 (**legacy ids must remain parseable** — critical for stored `matchQuestionnaireAnswers`); `buildAiMatchProfileText` (:247) renders normalised labels. GEO TASK DELEGATED HERE (this WP owns the file): in the superRefine (:162-175) the rewritten `inPersonServiceZipValidationError` is worldwide-permissive and the radius requirement becomes optional — in-person with no zip/radius is valid.
- Submit path (the route writing `matchQuestionnaireAnswers`): also write `spokenLanguageCodes = normalizeSpokenLanguageIds(answers.languages)`.
- `src/app/trainer/dashboard/(app)/match-questionnaire/match-me/edit/trainer-match-questionnaire-edit-client.tsx` (:62,:376-389): render the expanded list (grouped or searchable checkboxes).
- `src/components/trainer/trainer-profile-demography-fields.tsx` (:159-173): keep free-text `languagesSpoken` as-is (display-only, privacy-gated); update the datalist to the new label set. Do NOT try to make free text filterable.
- New `scripts/backfill-spoken-languages.mjs`: for every TrainerProfile with `matchQuestionnaireAnswers` and empty `spokenLanguageCodes`, parse, map via `LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE`, write the column. Idempotent, logs counts, dry-run flag.
Owns: `src/lib/trainer-match-questionnaire.ts`; the match-questionnaire edit client; `src/components/trainer/trainer-profile-demography-fields.tsx`; `scripts/backfill-spoken-languages.mjs`; the questionnaire submit route (claim it in the PR description).
Does NOT own: `src/lib/languages.ts` (WP-1); client-side language preference (WP-5a); public profile display surfaces (unchanged).
Depends on: WP-1; WP-3 (needs the rewritten `inPersonServiceZipValidationError`).

### WP-7 — DPMO and marketing/outreach reach split
Goal: DPMO records first-tier-country MARKETING reach while PRODUCT reach is worldwide — two explicit, separate axes — and US-only marketing assumptions in repo copy are updated.
Done means: DPMO table has the two new columns; all 4 Match Fit rows updated (prose + new columns ONLY — live switches untouched); repo copy updated; `outreach-geo-guard.test.ts` still green.
Tasks:
- Supabase (Match Fit app DB, project `qtesdsxrfggdlxdaraaq`) ADDITIVE migration on `public.venture_offering_dpmo`: add `product_reach text NOT NULL DEFAULT 'worldwide'` and `marketing_markets jsonb NOT NULL DEFAULT '[]'`; recreate `v_offering_dpmo` to include both. Never collapse the two axes.
- Targeted `UPDATE` of the 4 rows (`vof_match_fit__premium_hub_access`, `__directory_listing`, `__elite_full_access`, `__client_vip`): set `marketing_markets` to the tier-1 list; rewrite `marketingLeadSource` prose from "Nationwide — no city, no region, no map." to "Worldwide product. Marketing focus: first-tier countries (see marketing_markets). No city, no region, no map." **DO NOT touch `marketingEnabled`/`outreachEnabled`/`pushableBy*`** — live DB switches are ON while the repo seed ships false; never run a blanket reseed against live. `__client_vip` keeps `outreachEnabled=false`.
- `src/lib/offering-dpmo.ts`: add `productReach` + `marketingMarkets` to the TS shape and seed; define `export const TIER_ONE_MARKETING_MARKETS = ["US","CA","GB","AU","NZ","IE","DE","FR","NL","BE","AT","CH","SE","NO","DK","FI","SG","AE"] as const;` (JB can edit — it is data). Country codes only; never city/metro; **never the country code for Georgia in any `outreach*.ts` file** (regex trap).
- Copy updates: `src/lib/ad-tracking-config.ts:160,169` utm_campaigns → `client_search_worldwide`/`trainer_search_worldwide` (keep old constants exported with a deprecation comment if live ads reference them). `src/lib/outreach-templates.ts:20` → "Focus on Fitness Pros and clients worldwide; marketing concentrates on first-tier countries." `src/lib/outreach-ai.ts:470` → drop "based in the United States". `src/lib/outreach-types.ts:326-331` + `src/lib/outreach-hub-filters.ts:53` → "Worldwide". `src/lib/admin-analytics-ai.ts:438` → "worldwide beta". `src/lib/transactional-email-templates.ts:65` → "Virtual — worldwide". `src/lib/content-calendar/constants.ts:87` → same treatment. **Run the geo-guard test after every edit to an `outreach*.ts` file.**
Owns: `src/lib/offering-dpmo.ts`; `src/lib/ad-tracking-config.ts`; `src/lib/outreach-templates.ts`; `src/lib/outreach-ai.ts`; `src/lib/outreach-types.ts`; `src/lib/outreach-hub-filters.ts`; `src/lib/admin-analytics-ai.ts`; `src/lib/transactional-email-templates.ts`; `src/lib/content-calendar/constants.ts`; the Supabase DPMO migration.
Does NOT own: `src/__tests__/outreach-geo-guard.test.ts` (**frozen — nobody edits it**); any app schema (WP-1).
Depends on: nothing. Approve-only stands: DPMO row updates are config, not sends.

### WP-8 — Version bump, regression guard, integration
Goal: 2.15.0-beta shipped with a permanent test that fails if the geo barrier returns.
Done means: `npm run version:bump -- minor --reason "Worldwide availability: worldwide registration, client location preference, language filter"` run (2.14.1-beta → 2.15.0-beta); new regression test green; full gates green.
New `src/__tests__/worldwide-geo-guard.test.ts` asserts: (a) client/trainer register schemas ACCEPT a GB registration (`countryCode "GB"`, postal "SW1A 1AA") and a postal-less registration; (b) `evaluateBetaTrainerRegistrationGate` with gates off returns ok for a non-US postal (**fails on today's code at `INVALID_SERVICE_ZIP` — this is the tripwire**); (c) source-scan that the two register validation files contain no required `\d{5}(-\d{4})?` regex; (d) `parseTrainerServiceOfferingsJson` on a fixture doc with in-person lines + Atlanta zip returns those lines, not the empty default.
Owns: `package.json` + `src/lib/match-fit-product-version.ts` (via the bump script only); `src/__tests__/worldwide-geo-guard.test.ts`; this document.
Depends on: all other WPs merged.

---

## 3. Sequencing and deploy order

```
COMMIT 1: WP-2 Commit A (offerings READ schema permissive)  ← first commit of the programme
COMMIT 2: WP-1 (additive migration + shared modules)
PARALLEL after WP-1:
   WP-2 Commit B
   WP-3
   WP-4 (after WP-2B)
   WP-5a
   WP-6 (after WP-3 — needs rewritten inPersonServiceZipValidationError)
   WP-7 (fully independent; may start any time)
THEN: WP-5b (after WP-5a and WP-6)
LAST: WP-8 (version bump + regression guard + full gates)
```

Hard rules: WP-2A lands first (read strictly more permissive before any write-side change — otherwise published packages silently vanish). WP-1 before any consumer. WP-5b last of the feature WPs. WP-8 terminal.

---

## 4. Back-compat and data migration

| Existing data | What happens | Loss? |
|---|---|---|
| Existing US clients/Pros | `countryCode` backfilled `"US"`, `postalCode` copied from zip; `zipCode`/`serviceZipCode` untouched; prefix output identical | none |
| Stored `matchPreferencesJson` | New fields have zod defaults → old blobs parse unchanged | none |
| Stored `matchQuestionnaireAnswers` | New schema accepts legacy ids AND codes; normalised on next save; backfill script populates `spokenLanguageCodes` | none |
| Pros with empty `spokenLanguageCodes` | Treated as unknown: shown to everyone, no bonus, never excluded | none |
| Stored `serviceOfferingsJson` (incl. Atlanta zips) | Read schema is a strict superset of every historical write; regression fixtures prove it | none |
| Waitlist rows | Keep their zips; `countryCode` backfilled `"US"`; new rows may have null postal | none |
| `virtualOnlyBetaSlot`, Atlanta/Virtual cap env vars | Dormant / deprecated aliases; nothing dropped | none |
| Live DPMO switches (ON in prod, false in repo seed) | Only targeted UPDATEs of prose + new columns; switches never written | none |

---

## 5. Risk register (ranked)

1. **Offerings read-gate empty-default (the landmine).** A schema edit that makes read validation fail returns the empty default doc → every published package silently vanishes from profiles AND checkout. Blast radius: all revenue. Mitigation: WP-2 splits read/write schemas, read lands FIRST, regression fixtures, WP-8 tripwire (d).
2. **Write/read schema skew during rollout.** Write accepts worldwide postals while read still enforces US → same vanish. Mitigation: the hard order in §3; WP-2 is one owner, two commits.
3. **`beta-trainer-register-gate` zip pre-check.** 400s non-US signups even with gates off; if UI ships country before the gate is fixed, worldwide signup is dead on arrival. Mitigation: WP-3 removes it, API+UI in one PR; WP-8 test (b) is the permanent tripwire.
4. **`normalizeTrainerServiceZip` postal corruption.** Digit-stripping turns "SW1A 1AA" into "11" or null → corrupt data no migration can un-corrupt. Mitigation: WP-3 replaces it in the SAME PR that opens registration; never ship worldwide signup while the stripper lives.
5. **12-hour `TrainerDiscoverMatchBatch` freeze.** New filters shrink a frozen 10-ID batch → Pros see 1–2 clients for up to 12h. Mitigation: WP-5b adds a filter hash to the batch key.
6. **`FeaturedDailyAllocation` key invalidation.** Changing region semantics orphans allocations mid-day. Mitigation: keep US prefix computation byte-identical; only ADD the `"global"` bucket.
7. **Checkr hardcoded US work location.** Non-US Pros → API errors or bogus checks. Mitigation: WP-3 country guard + explicit WORLDWIDE-TODO for JB.
8. **Outreach geo-guard regression.** WP-7 edits many `outreach*.ts` files; one careless word fails the build. Mitigation: country codes only, run the guard per edit, guard file frozen.
9. **DPMO reseed flipping live switches off.** Mitigation: targeted UPDATEs only; never run the seed against prod.
10. **Browse route whole-table scan.** Worldwide growth makes the in-memory scorer heavier. Mitigation: `take` safety cap; re-architecture out of scope.

---

## 6. Verification plan (for the SEPARATE proof-check agent)

Assert against artifacts, not claims:

1. `git log` shows WP-2 Commit A before any commit touching `src/lib/validations/*-register.ts` or the offerings write schema.
2. Migration contains ONLY additive/nullable-relaxing DDL — no `DROP COLUMN`, no `DROP TABLE`; the four zip columns are nullable; `countryCode`/`postalCode`/`spokenLanguageCodes` exist; backfill UPDATEs present.
3. `src/__tests__/worldwide-geo-guard.test.ts` exists, passes, and check (b) would FAIL on pre-change code (`evaluateBetaTrainerRegistrationGate({serviceZipCode:"SW1A 1AA"})` with gates off returns `ok:true`).
4. Offerings fixture test: a doc with `delivery:"in_person"` and `inPersonServiceZip:"30309"` parses to its real lines; same for a GB postal and for null.
5. Grep proofs: no `\d{5}(-\d{4})?` in the two register validation files; no import of `beta-client-in-person-checkout-gate`; `BETA_IN_PERSON_GEO` appears nowhere in `src/`.
6. `src/lib/trainer-service-zip.ts` no longer strips non-digits ("SW1A 1AA" round-trips).
7. `clientMatchPreferencesSchema.parse({serviceTypes:["personal_training"],deliveryModes:["virtual"]})` yields `locationScope:"worldwide"`, `languages:[]`.
8. Questionnaire schema accepts `languages:["english"]` AND `languages:["ja"]`; submit writes `spokenLanguageCodes`.
9. `outreach-geo-guard.test.ts` green and its file hash unchanged from before the programme.
10. Discover-clients batch key includes the filter hash; featured allocation for a null-prefix user resolves the `"global"` bucket, not an empty array.
11. DPMO: `select "marketingEnabled","outreachEnabled",product_reach,marketing_markets from v_offering_dpmo where "offeringId" like 'vof_match_fit%'` shows switches UNCHANGED, `product_reach='worldwide'`, non-empty `marketing_markets`, `__client_vip` outreach still false.
12. `package.json` version is `2.15.0-beta`, bumped by the script.
13. `npm run lint && npm run typecheck && npm run test && npm run build` all green.
14. UI spot-check: signup shows a country select + "Postal code" (sentence case); preferences show the 3-stop slider with `accent-[#FF7E00]`; no raw DB values and no "AI-powered"/"AI matching" copy introduced.

---

## 7. Out of scope (deliberate)

- UI translation / i18n / `[locale]` routing — ruling 4 is "which languages a Pro speaks", not interface localisation. `layout.tsx` stays `lang="en"`.
- True mile/km radius and any geocoding (paid APIs banned; offline centroid dataset deferred — §0 records the extension point).
- Currency/pricing localisation, tax/VAT, non-US payouts (Stripe Connect country support is a separate programme; flagged only).
- Background checks outside the US — flagged (risk 7); product decision belongs to JB.
- Re-architecting the browse route's in-memory scoring (capped, not rebuilt).
- `TrainerSessionPunchIn` GPS — untouched by order.
- Marketing content/workflow changes (the 18-step locked workflow) — DPMO data and copy only; nothing sends without JB.
