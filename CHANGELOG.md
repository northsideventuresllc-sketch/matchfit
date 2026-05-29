## Weekly Summary (2026-05-22 to 2026-05-29)

Reviewed sources: commits and merged PRs on `main` over the last 7 days (76 commits, 59 merged PRs).

### 🚀 New Features Introduced
- Added Stripe PaymentIntent onboarding for trainer background checks, including supporting payment-flow coverage updates (`#83`).
- Introduced site analytics and expanded portal-level product visibility (version labels/badges and beta messaging across client/trainer/admin surfaces) (`#30`, `#31`, `#93`, `#120`).
- Expanded admin-facing product capabilities, including overview/reporting improvements and revenue/accounting visibility updates (captured across the late-May admin portal commits and test-backed PRs).
- Added 30-day account-deletion grace workflow with cancel-on-login behavior (`#53`).
- Delivered beta launch UX/content improvements: promos, waitlist/carousel polish, trust/social/legal content refreshes, and featured section cleanup (`#48`, `#71`, `#80`, `#126`).
- Installed Vercel Web Analytics integration (`#136`).

### 🛠️ Bug Fixes & Patches
- Hardened login reliability and Turnstile integration (ready-state handling, secret/config hardening, prop API cleanup, lint/type safety cleanup), resolving production login blockers (`#120`, `#121`, `#105`, `#116`).
- Fixed platform metrics accuracy by excluding QA/synthetic/dev/test accounts from launch and subscriber counts (`#28`, `#52`, `#93` plus follow-up count-fix commits).
- Repaired Stripe Connect webhook/account validation paths and cleaned up stale/invalid route test expectations (`#41`, `#59`, `#62`).
- Fixed deployment/build hygiene issues (malformed manifest keys, duplicate config/dependency keys, stale imports, client/server boundary regressions) to restore stable CI and production builds (`#43`, `#46`, `#65`, `#72`, `#98`, `#122`, `#125`).
- Addressed legal/compliance correctness updates across Privacy Policy and Terms alignment/effective-date consistency (`#29`, `#49`, `#50`, `#51`).

### 📦 Database Schema or Dependency Changes
- Upgraded Prisma ORM to v7 and moved runtime DB access to Direct TCP via pg adapter (`#27`).
- Performed package manifest/lockfile dependency hygiene:
  - removed duplicate `pg` root dependency lockfile entry (`#74`),
  - removed duplicate `next` keys in npm manifests (`#46`, `#72`),
  - synced package version metadata during beta progression (`1.0.1-beta.0` to `1.1.1-beta`).
- Added dependency-level analytics integration via Vercel Web Analytics (`#136`).
