#!/usr/bin/env bash
set -eo pipefail

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

# Load .env file
set -a
source "$ENV_FILE"
set +a

put_param() {
  local env_key="$1"
  local ssm_key="$2"
  local value="${!env_key:-}"

  if [ -z "$value" ]; then
    echo "SKIP: $env_key is empty"
    return
  fi

  local param_name="/bookmark-rss/${STAGE}/${ssm_key}"
  echo "PUT: $param_name"
  aws ssm put-parameter \
    --name "$param_name" \
    --value "$value" \
    --type String \
    --overwrite
}

put_param DATABASE_URL          database-url
put_param GOOGLE_CLIENT_ID      google-client-id
put_param GOOGLE_CLIENT_SECRET  google-client-secret
put_param BETTER_AUTH_SECRET    better-auth-secret
put_param AI_CLIENT_ID          ai-client-id
put_param AI_CLIENT_SECRET      ai-client-secret

echo ""
echo "Done. SSM parameters set for stage: $STAGE"
