#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "deploy-from-github.sh 已切换为容器化部署路径。"
exec "${SCRIPT_DIR}/deploy-container.sh" "$@"
