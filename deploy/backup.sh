#!/usr/bin/env bash
# Encrypted backup of the database and patient files. Runs daily from clinic-backup.timer.
# Output: /var/backups/clinic/clinic-YYYYmmdd-HHMM.tar.enc  (AES-256, key = BACKUP_PASSPHRASE)
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/clinic/clinic.env}"
set -a; source "$ENV_FILE"; set +a
: "${DATABASE_URL:?}" "${BACKUP_PASSPHRASE:?}" "${UPLOAD_DIR:?}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/clinic}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

umask 077
mkdir -p "$BACKUP_DIR"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

stamp="$(TZ=Asia/Manila date +%Y%m%d-%H%M)"
# Prisma adds ?schema=public; pg_dump doesn't understand query params.
pg_dump --format=custom --no-owner --dbname="${DATABASE_URL%%\?*}" --file="$work/db.dump"
mkdir -p "$UPLOAD_DIR"
tar -C "$UPLOAD_DIR" -cf "$work/uploads.tar" .
echo "created=$stamp" > "$work/manifest.txt"
tar -C "$work" -cf "$work/backup.tar" db.dump uploads.tar manifest.txt

out="$BACKUP_DIR/clinic-$stamp.tar.enc"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$work/backup.tar" -out "$out"
echo "Backup written: $out ($(du -h "$out" | cut -f1))"

# Optional off-server copy (e.g. Google Drive or DigitalOcean Spaces via rclone). The file is already encrypted.
if [[ -n "${RCLONE_REMOTE:-}" ]] && command -v rclone >/dev/null; then
  rclone copy "$out" "$RCLONE_REMOTE" && echo "Copied to $RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -name 'clinic-*.tar.enc' -mtime +"$KEEP_DAYS" -delete
