#!/usr/bin/env bash
set -euo pipefail

TLS_DIR="${TLS_DIR:-/opt/agent-roundtable-studio/tls}"
TLS_CERT="${TLS_CERT:-${TLS_DIR}/selfsigned.crt}"
TLS_KEY="${TLS_KEY:-${TLS_DIR}/selfsigned.key}"
CERT_CN="${CERT_CN:-113.44.223.11}"

mkdir -p "${TLS_DIR}"
chmod 700 "${TLS_DIR}"

if [[ -f "${TLS_CERT}" && -f "${TLS_KEY}" ]]; then
  exit 0
fi

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "${TLS_KEY}" \
  -out "${TLS_CERT}" \
  -subj "/CN=${CERT_CN}" \
  -addext "subjectAltName = IP:${CERT_CN}"

chmod 600 "${TLS_KEY}"
chmod 644 "${TLS_CERT}"
