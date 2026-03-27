#!/usr/bin/env bash
set -euo pipefail

STAGE="${1:-dev}"
ENV_FILE="${2:-infra/.env.deploy}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  echo ""
  echo "Usage: bash infra/scripts/setup-ssm.sh [stage] [env-file]"
  echo ""
  echo "Create $ENV_FILE with:"
  echo "  DATABASE_URL=postgresql://..."
  echo "  GOOGLE_CLIENT_ID=xxx"
  echo "  GOOGLE_CLIENT_SECRET=xxx"
  echo "  BETTER_AUTH_SECRET=xxx"
  echo "  AI_CLIENT_ID=xxx"
  echo "  AI_CLIENT_SECRET=xxx"
  exit 1
fi

# env var name -> SSM param key mapping
declare -A PARAMS=(
  ["DATABASE_URL"]="database-url"
  ["GOOGLE_CLIENT_ID"]="google-client-id"
  ["GOOGLE_CLIENT_SECRET"]="google-client-secret"
  ["BETTER_AUTH_SECRET"]="better-auth-secret"
  ["AI_CLIENT_ID"]="ai-client-id"
  ["AI_CLIENT_SECRET"]="ai-client-secret"
)

# Load .env file
set -a
source "$ENV_FILE"
set +a

for env_key in "${!PARAMS[@]}"; do
  ssm_key="${PARAMS[$env_key]}"
  value="${!env_key:-}"

  if [ -z "$value" ]; then
    echo "SKIP: $env_key is empty"
    continue
  fi

  param_name="/bookmark-rss/${STAGE}/${ssm_key}"
  echo "PUT: $param_name"
  aws ssm put-parameter \
    --name "$param_name" \
    --value "$value" \
    --type String \
    --overwrite
done

echo ""
echo "Done. SSM parameters set for stage: $STAGE"
