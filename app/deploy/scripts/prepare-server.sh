#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-arsdeploy}"
APP_DIR="${APP_DIR:-/opt/agent-roundtable-studio}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi

mkdir -p "${APP_DIR}/app" "${APP_DIR}/data" "${APP_DIR}/logs" "${APP_DIR}/env"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y curl git nginx rsync sudo
  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl git nginx rsync sudo
  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    yum install -y nodejs
  fi
else
  echo "Unsupported Linux package manager. Install Node.js 20+, git, and nginx manually." >&2
  exit 1
fi

systemctl enable nginx
systemctl restart nginx

echo "Server baseline prepared. Add your SSH public key to /home/${DEPLOY_USER}/.ssh/authorized_keys before disabling root password login."
