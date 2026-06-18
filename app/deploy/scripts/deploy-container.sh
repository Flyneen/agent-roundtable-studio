#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Flyneen/agent-roundtable-studio.git}"
BRANCH="${BRANCH:-main}"
DEPLOY_USER="${DEPLOY_USER:-arsdeploy}"
APP_DIR="${APP_DIR:-/opt/agent-roundtable-studio}"
GATEWAY_CONTAINER="${GATEWAY_CONTAINER:-gateway-nginx-8181}"
GATEWAY_CONF="${GATEWAY_CONF:-/usr/docker/gateway-8181/conf/nginx.conf}"
GATEWAY_SNIPPET_MARKER="${GATEWAY_SNIPPET_MARKER:-agent-roundtable-studio}"
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

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

mkdir -p "${APP_DIR}/data" "${APP_DIR}/env" "${APP_DIR}/releases"

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "${DEPLOY_USER}"
fi

chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

if [[ ! -d "${APP_DIR}/repo/.git" ]]; then
  sudo -u "${DEPLOY_USER}" git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}/repo"
else
  sudo -u "${DEPLOY_USER}" git -C "${APP_DIR}/repo" fetch origin "${BRANCH}"
  sudo -u "${DEPLOY_USER}" git -C "${APP_DIR}/repo" checkout "${BRANCH}"
  sudo -u "${DEPLOY_USER}" git -C "${APP_DIR}/repo" pull --ff-only origin "${BRANCH}"
fi

if [[ ! -f "${APP_DIR}/env/backend.env" ]]; then
  cp "${APP_DIR}/repo/app/deploy/backend.env.example" "${APP_DIR}/env/backend.env"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/env/backend.env"
  chmod 600 "${APP_DIR}/env/backend.env"
fi

pushd "${APP_DIR}/repo/app" >/dev/null
docker build --target build -t agent-roundtable-studio:build-check .
docker run --rm \
  -e BACKEND_HOST=0.0.0.0 \
  -e BACKEND_PORT=8877 \
  -e DATA_DIR=./backend/data-test \
  -e AI_RUNTIME=simulated \
  agent-roundtable-studio:build-check npm test
popd >/dev/null

docker network inspect "${DOCKER_NETWORK}" >/dev/null

if docker ps --format '{{.Names}}' | grep -Fxq "${GATEWAY_CONTAINER}"; then
  if ! docker inspect "${GATEWAY_CONTAINER}" --format '{{json .NetworkSettings.Networks}}' | grep -q "\"${DOCKER_NETWORK}\""; then
    docker network connect "${DOCKER_NETWORK}" "${GATEWAY_CONTAINER}"
  fi
fi

pushd "${APP_DIR}/repo/app/deploy" >/dev/null
compose -f docker-compose.yml up -d --build
popd >/dev/null

docker exec agent-roundtable-studio node --input-type=module -e "const res = await fetch('http://127.0.0.1:8787/health'); if (!res.ok) process.exit(1);"

if [[ -f "${GATEWAY_CONF}" ]]; then
  backup="${GATEWAY_CONF}.bak.$(date +%Y%m%d%H%M%S)"
  cp "${GATEWAY_CONF}" "${backup}"
  echo "Gateway config backed up to ${backup}"
  if grep -q "/agent-roundtable-studio" "${GATEWAY_CONF}"; then
    sed -i \
      -e 's#http://172\.17\.0\.1:18080#http://agent-roundtable-studio:8787#g' \
      -e 's#http://127\.0\.0\.1:18080#http://agent-roundtable-studio:8787#g' \
      "${GATEWAY_CONF}"
  else
    echo "Gateway config does not contain /agent-roundtable-studio locations." >&2
    echo "Insert app/deploy/gateway-8181-agent-roundtable-snippet.conf into the gateway HTTP server block, then rerun." >&2
    exit 1
  fi
  docker exec "${GATEWAY_CONTAINER}" nginx -t
  docker exec "${GATEWAY_CONTAINER}" nginx -s reload
fi

echo "Agent Roundtable Studio container deployed."
