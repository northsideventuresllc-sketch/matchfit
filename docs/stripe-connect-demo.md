# Stripe Connect sample (V2)

Isolated demo at **`/stripe-connect-demo`**. Uses the existing `stripe` npm package (`^22`) and `STRIPE_SECRET_KEY`.

## Setup

1. Copy env vars from `.env.example` (Connect section).
2. Apply migration: `npx prisma db push` (creates `stripe_connect_demo_sellers`).
3. In Stripe Dashboard:
   - Create a **recurring Price** for your platform plan → `STRIPE_CONNECT_PLATFORM_PRICE_ID`.
   - **Thin** webhook destination (Connected accounts, payload **Thin**):
     - Events: `v2.core.account[requirements].updated`, `v2.core.account[configuration.merchant].capability_status_updated`, `v2.core.account[configuration.customer].capability_status_updated`
     - URL: `https://<host>/api/webhooks/stripe-connect/thin`
   - **Snapshot** webhook for subscriptions → `https://<host>/api/webhooks/stripe-connect/subscriptions`

## Local webhooks (Stripe CLI)

```bash
stripe listen \
  --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' \
  --forward-thin-to http://localhost:3000/api/webhooks/stripe-connect/thin

# Separate terminal for subscription events:
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe-connect/subscriptions
```

## Flow

| Step | UI / API |
|------|----------|
| Create account | `POST /api/stripe-connect-demo/sellers` → V2 `accounts.create` |
| Onboarding | Dashboard → Account Links (`v2.core.accountLinks`) |
| Status | Always from `v2.core.accounts.retrieve` (not cached) |
| Products | Dashboard → `products.create` with `stripeAccount` |
| Storefront | `/stripe-connect-demo/store/[accountId]` — use a public slug in production |
| Pay | Direct charge Checkout + `application_fee_amount` |
| Platform sub | Checkout `customer_account` + billing portal |

## Code map

- `src/lib/stripe-connect/` — client, config errors, account status, thin/subscription handlers
- `src/app/api/stripe-connect-demo/` — REST API
- `src/app/api/webhooks/stripe-connect/` — thin + subscription webhooks
- `src/app/stripe-connect-demo/` — UI
