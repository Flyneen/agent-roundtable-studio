#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/agent-roundtable-studio}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/env/backend.env}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/repo/app/deploy/docker-compose.yml}"
DOCKER_NETWORK="${DOCKER_NETWORK:-1panel-network}"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "Docker Compose is required." >&2
    exit 1
  fi
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run this script as root." >&2
    exit 1
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

read_key() {
  local key="${OPENAI_API_KEY:-}"
  if [[ -z "${key}" ]]; then
    read -r -s -p "Enter new OpenAI-compatible API key: " key
    echo
  fi
  if [[ -z "${key}" ]]; then
    echo "OPENAI_API_KEY is required." >&2
    exit 1
  fi
  printf '%s' "${key}"
}

require_root
mkdir -p "$(dirname "${ENV_FILE}")"
touch "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"

api_key="$(read_key)"
set_env_value "AI_RUNTIME" "openai"
set_env_value "OPENAI_BASE_URL" "${OPENAI_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}"
set_env_value "OPENAI_API_MODE" "${OPENAI_API_MODE:-chat_completions}"
set_env_value "OPENAI_MODEL" "${OPENAI_MODEL:-qwen-plus}"
set_env_value "OPENAI_TIMEOUT_MS" "${OPENAI_TIMEOUT_MS:-45000}"
set_env_value "OPENAI_MAX_RETRIES" "${OPENAI_MAX_RETRIES:-1}"
set_env_value "OPENAI_API_KEY" "${api_key}"
chmod 600 "${ENV_FILE}"

cd "$(dirname "${COMPOSE_FILE}")"
export DOCKER_NETWORK
compose -f "${COMPOSE_FILE}" up -d --force-recreate ai-orchestrator-python agent-roundtable-studio

health="$(docker exec agent-roundtable-studio wget -qO- http://127.0.0.1:8787/health)"
printf '%s\n' "${health}" | grep -q '"openaiConfigured":true'
printf '%s\n' "${health}" | grep -q '"runtime":"openai"'

echo "OpenAI-compatible API key configured and containers restarted."
