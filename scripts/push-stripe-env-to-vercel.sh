#!/usr/bin/env bash
# Push Stripe vars from local .env to Vercel (Production + Preview). Requires: vercel login, linked project.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  echo "Missing .env in repo root. Copy from .env.example and fill Stripe keys."
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
for name in STRIPE_SECRET_KEY NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD NEXT_PUBLIC_APP_URL; do
  val="${!name:-}"
  if [[ -z "$val" ]]; then
    echo "Skip empty $name"
    continue
  fi
  for env in production preview; do
    printf '%s' "$val" | npx vercel env add "$name" "$env" --force 2>/dev/null || printf '%s' "$val" | npx vercel env add "$name" "$env"
  done
  echo "Set $name (production + preview)"
done
echo "Done. Redeploy production for NEXT_PUBLIC_* vars to take effect."
