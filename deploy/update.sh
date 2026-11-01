#!/usr/bin/env bash
# Update to the latest version on GitHub. Takes a backup first.
# Usage: sudo bash /opt/clinic/deploy/update.sh
set -euo pipefail
APP_DIR=/opt/clinic
BRANCH="${BRANCH:-main}"
[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }

echo "==> Backup before update"
"$APP_DIR/deploy/backup.sh"
echo "==> Pull $BRANCH"
sudo -u clinic git -C "$APP_DIR" fetch origin "$BRANCH"
sudo -u clinic git -C "$APP_DIR" checkout -q "$BRANCH"
sudo -u clinic git -C "$APP_DIR" reset --hard "origin/$BRANCH"
bash "$APP_DIR/deploy/build.sh"
systemctl restart clinic
sleep 5
curl -fsS http://127.0.0.1:3000/api/health && echo " <- healthy"
