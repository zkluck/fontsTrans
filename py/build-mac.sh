#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DESKTOP_ROOT="${REPO_ROOT}/desktop"
DIST_DIR="${SCRIPT_DIR}/dist/darwin"
WORK_DIR="${SCRIPT_DIR}/.pyinstaller_build"
SPEC_DIR="${SCRIPT_DIR}/.pyinstaller_spec"
SRC_FILE="${SCRIPT_DIR}/src/ttf2woff2.py"
DESKTOP_TARGET="${DESKTOP_ROOT}/py/darwin"

mkdir -p "${DIST_DIR}" "${WORK_DIR}" "${SPEC_DIR}"

uv run pyinstaller \
  --noconfirm \
  --onefile \
  --name ttf2woff2 \
  --distpath "${DIST_DIR}" \
  --workpath "${WORK_DIR}" \
  --specpath "${SPEC_DIR}" \
  "${SRC_FILE}"

mkdir -p "${DESKTOP_TARGET}"
cp "${DIST_DIR}/ttf2woff2" "${DESKTOP_TARGET}/ttf2woff2"

echo "Done"
