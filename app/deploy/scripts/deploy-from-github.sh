#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Flyneen/agent-roundtable-studio.git}"
BRANCH="${BRANCH:-main}"
DEPLOY_USER="${DEPLOY_USER:-arsdeploy}"
APP_DIR="${APP_DIR:-/opt/agent-roundtable-studio}"
SERVICE_NAME="${SERVICE_NAME:-agent-roundtable-studio}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

mkdir -p "${APP_DIR}/app" "${APP_DIR}/data" "${APP_DIR}/logs" "${APP_DIR}/env"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

if [[ ! -d "${APP_DIR}/repo/.git" ]]; then
  sudo -u "${DEPLOY_USER}" git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}/repo"
else
  sudo -u "${DEPLOY_USER}" git -C "${APP_DIR}/repo" fetch origin "${BRANCH}"
  sudo -u "${DEPLOY_USER}" git -C "${APP_DIR}/repo" checkout "${BRANCH}"
  sudo -u "${DEPLOY_USER}" git -C "${APP_DIR}/repo" pull --ff-only origin "${BRANCH}"
fi

rsync -a --delete \
  --exclude ".git" \
  --exclude "app/backend/data" \
  --exclude "app/backend/data-test" \
  --exclude "app/frontend/dist" \
  "${APP_DIR}/repo/app/" "${APP_DIR}/app/"

if [[ ! -f "${APP_DIR}/env/backend.env" ]]; then
  cp "${APP_DIR}/app/deploy/backend.env.example" "${APP_DIR}/env/backend.env"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/env/backend.env"
  chmod 600 "${APP_DIR}/env/backend.env"
fi

pushd "${APP_DIR}/app" >/dev/null
npm test
npm run build
popd >/dev/null

cp "${APP_DIR}/app/deploy/agent-roundtable-studio.service" "/etc/systemd/system/${SERVICE_NAME}.service"
cp "${APP_DIR}/app/deploy/nginx-agent-roundtable-studio.conf" "/etc/nginx/conf.d/agent-roundtable-studio.conf"

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
nginx -t
systemctl reload nginx

curl -fsS http://127.0.0.1:8787/health >/dev/null
curl -fsS http://127.0.0.1/health >/dev/null

echo "Agent Roundtable Studio deployed."
