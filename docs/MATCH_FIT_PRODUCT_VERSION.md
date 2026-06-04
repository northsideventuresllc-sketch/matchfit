# Match Fit product version

## Display template

All in-app copy uses the shared module `src/lib/match-fit-product-version.ts` (never hardcode version strings in pages).

| Channel | Footer / dashboard label | Promo / announcement label |
|--------|---------------------------|----------------------------|
| Beta (current) | `Version BETA #.#.#` | `Version #.#.#-BETA` |
| General availability (owner-approved) | `Version #.#.#` | `Version #.#.#` |

`#.#.#` is **major.minor.patch** semver stored in `package.json` (e.g. `1.2.3-beta` while in beta).

## When to bump (every live deployment)

When work ships to production (merged to `main` and deployed), **always** bump the version in the same PR — you do not need the owner to ask.

1. Classify the change (see table below).
2. Run `npm run version:bump -- <level> --reason "short description"`.
3. Confirm UI still imports `MATCH_FIT_PRODUCT_VERSION_*` (no duplicate literals).
4. In your task completion message, state explicitly that the product version was updated and which level you used.

If you are unsure which level applies, **stop and ask the owner** before merging.

## Bump levels

| Level | Command | Use when | Examples |
|-------|---------|----------|----------|
| **Major** (first `#`) | `npm run version:bump -- major` | Transformative changes that materially redefine the product or add large new surfaces | Multiple new in-person marketplaces, a new core business model, replacing the whole matching engine |
| **Minor** (second `#`) | `npm run version:bump -- minor` | Meaningful features or redesigns that add value without redefining the whole app | Admin portal launch, client dashboard redesign, new trainer payout flow, substantial new portal section |
| **Patch** (third `#`) | `npm run version:bump -- patch` | Bug fixes, small UX polish, copy/formatting, narrow guardrails | Client signup validation fix, typo in TOS banner, button label tweak |

Default to **patch** when the change is clearly a fix or tiny polish. Default to **minor** when users would notice a new capability. Reserve **major** for rare, platform-scale shifts.

## Owner approval only

Do **not** change these without explicit owner instruction:

- Adding or removing the **BETA** channel (`package.json` `-beta` suffix and label prefix).
- Changing the version **structure** (e.g. moving away from semver, extra label segments).

## Technical source of truth

- **Single source:** `package.json` → `"version"` (e.g. `1.1.2-beta`).
- **Labels:** derived in `match-fit-product-version.ts` from that field.
- **History:** `VERSION_HISTORY.md` (appended by the bump script).
- **CI:** `npm run version:verify` fails PRs that change product code without bumping `package.json`.

## Surfaces that show the version

Imports of `MATCH_FIT_PRODUCT_VERSION_LABEL` or `MATCH_FIT_PRODUCT_VERSION_ANNOUNCE` — keep using those constants only:

- Home, promos, waitlist pages
- Client, trainer, and admin dashboard shells
- Admin portal UI and admin dashboard client
- Home beta promo banner (announce format)
