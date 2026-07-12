#!/bin/bash
set -euo pipefail

# Deploy the Trapstand Cloudflare Worker.
#
# Required environment variables (can also be sourced from .env.local in the project root):
#   CLUB_WRITE_TOKEN
#   CLUB_READ_TOKEN
#   LIVE_TOKEN
#   S3_ACCESS_KEY_ID
#   S3_SECRET_ACCESS_KEY
#
# Optional:
#   ENV_FILE  - path to an env file to source (default: ../.env.local)

ENV_FILE="${ENV_FILE:-../.env.local}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

: "${CLUB_WRITE_TOKEN:?CLUB_WRITE_TOKEN is required}"
: "${CLUB_READ_TOKEN:?CLUB_READ_TOKEN is required}"
: "${LIVE_TOKEN:?LIVE_TOKEN is required}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"

echo "Publishing secrets to Cloudflare ..."
printf '%s' "$CLUB_WRITE_TOKEN" | wrangler secret put CLUB_WRITE_TOKEN
printf '%s' "$CLUB_READ_TOKEN" | wrangler secret put CLUB_READ_TOKEN
printf '%s' "$LIVE_TOKEN" | wrangler secret put LIVE_TOKEN
printf '%s' "$S3_ACCESS_KEY_ID" | wrangler secret put S3_ACCESS_KEY_ID
printf '%s' "$S3_SECRET_ACCESS_KEY" | wrangler secret put S3_SECRET_ACCESS_KEY

echo "Deploying worker ..."
wrangler deploy

echo "Done."
