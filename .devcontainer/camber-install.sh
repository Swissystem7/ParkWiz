#!/usr/bin/env bash
# Optional: Camber CLI in devcontainer (call from post-create.sh if INSTALL_CAMBER=1)
set -euo pipefail
[ "${INSTALL_CAMBER:-0}" = "1" ] || exit 0

# Download the installer to a temp file and sanity-check it before running
# (instead of piping curl straight into bash). Upstream does not publish a
# checksum for install-v2.sh, so we verify shape and print its sha256.
CAMBER_INSTALL_URL="https://cli.cambercloud.com/install-v2.sh"
tmp="$(mktemp "${TMPDIR:-/tmp}/camber-install.XXXXXX.sh")"
trap 'rm -f "$tmp"' EXIT

curl -fsSL -o "$tmp" "$CAMBER_INSTALL_URL"

if [ ! -s "$tmp" ]; then
  echo "error: camber installer download is empty" >&2
  exit 1
fi
if [ "$(head -c 2 "$tmp")" != "#!" ]; then
  echo "error: camber installer does not start with a shebang" >&2
  exit 1
fi
echo "camber installer sha256: $(sha256sum "$tmp" | cut -d' ' -f1)"

bash "$tmp"
echo 'export PATH="$HOME/.camber/bin:$PATH"' >> ~/.bashrc
# Auth: Aviran adds Codespaces secret CAMBER_API_KEY (from app.cambercloud.com profile). Verify: camber me
