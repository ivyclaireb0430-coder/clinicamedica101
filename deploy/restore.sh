#!/usr/bin/env bash
# Restore a backup made by backup.sh. REPLACES the current database and patient files.
# Usage: sudo deploy/restore.sh /var/backups/clinic/clinic-20261102-0200.tar.enc
set -euo pipefail

file="${1:?Usage: restore.sh <backup.tar.enc>}"
ENV_FILE="${ENV_FILE:-/etc/clinic/clinic.env}"
set -a; source "$ENV_FILE"; set +a
: "${DATABASE_URL:?}" "${BACKUP_PASSPHRASE:?}" "${UPLOAD_DIR:?}"

if [[ "${YES:-}" != "1" ]]; then
  read -r -p "This replaces ALL current data with $file. Type RESTORE to continue: " answer
  [[ "$answer" == "RESTORE" ]] || { echo "Cancelled."; exit 1; }
fi

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" -out "$work/backup.tar"
tar -C "$work" -xf "$work/backup.tar"
cat "$work/manifest.txt"

had_service=0
if command -v systemctl >/dev/null && systemctl is-active --quiet clinic 2>/dev/null; then had_service=1; systemctl stop clinic; fi

pg_restore --clean --if-exists --no-owner --dbname="${DATABASE_URL%%\?*}" "$work/db.dump"
mkdir -p "$UPLOAD_DIR"
find "$UPLOAD_DIR" -mindepth 1 -delete
tar -C "$UPLOAD_DIR" -xf "$work/uploads.tar"
if id clinic >/dev/null 2>&1; then chown -R clinic:clinic "$UPLOAD_DIR"; fi

if [[ $had_service == 1 ]]; then systemctl start clinic; fi
echo "Restore complete."
