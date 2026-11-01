#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for the clinic system.
# Usage (as root):  bash setup-server.sh app.clinicamedica101.org
# Safe to run again: existing secrets, database and data are kept.
set -euo pipefail

DOMAIN="${1:?Usage: setup-server.sh <domain, e.g. app.clinicamedica101.org>}"
REPO_URL="${REPO_URL:-https://github.com/ivyclaireb0430-coder/clinicamedica101.git}"
BRANCH="${BRANCH:-main}"
APP_DIR=/opt/clinic
ENV_FILE=/etc/clinic/clinic.env
UPLOAD_DIR=/var/lib/clinic/uploads
BACKUP_DIR=/var/backups/clinic

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> System packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ufw fail2ban unattended-upgrades ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https postgresql openssl
timedatectl set-timezone Asia/Manila || true

if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  echo "==> Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  echo "==> Caddy (automatic HTTPS)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

if ! swapon --show | grep -q .; then
  echo "==> 2 GB swap (keeps the build from running out of memory)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> App user and folders"
id clinic >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/clinic --shell /usr/sbin/nologin clinic
install -d -o clinic -g clinic -m 700 "$UPLOAD_DIR"
install -d -o root -g root -m 700 "$BACKUP_DIR"
install -d -o root -g clinic -m 750 /etc/clinic

echo "==> Database"
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE clinic LOGIN PASSWORD '$DB_PASS';" -c "CREATE DATABASE clinic OWNER clinic;"
  echo "==> Generating secrets in $ENV_FILE"
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
DATABASE_URL=postgresql://clinic:${DB_PASS}@localhost:5432/clinic
APP_URL=https://${DOMAIN}
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_TRUST_HOST=true
ENCRYPTION_KEY=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -hex 32)
BACKUP_PASSPHRASE=$(openssl rand -base64 33)
UPLOAD_DIR=${UPLOAD_DIR}
# Fill these in later (see docs/DEPLOY.md), then: systemctl restart clinic
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_VERIFY_TOKEN=$(openssl rand -hex 20)
META_GRAPH_VERSION=v25.0
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
FB_PAGE_USERNAME=
# Optional off-server backup copy, e.g. gdrive:clinic-backups (after setting up rclone)
RCLONE_REMOTE=
ENV
  chown root:clinic "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  NEW_SECRETS=1
fi

echo "==> App code"
if [[ ! -d "$APP_DIR/.git" ]]; then
  install -d -o clinic -g clinic "$APP_DIR"
  sudo -u clinic git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
bash "$APP_DIR/deploy/build.sh"

echo "==> Services"
cat > /etc/systemd/system/clinic.service <<UNIT
[Unit]
Description=Clinica Medica 101 clinic system
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=clinic
Group=clinic
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm start -- -p 3000 -H 127.0.0.1
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

# Scheduled jobs: name|schedule|command
while IFS='|' read -r name when cmd; do
  cat > "/etc/systemd/system/clinic-$name.service" <<UNIT
[Unit]
Description=Clinic $name

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=/bin/bash -c '$cmd'
UNIT
  cat > "/etc/systemd/system/clinic-$name.timer" <<UNIT
[Unit]
Description=Clinic $name schedule

[Timer]
OnCalendar=$when
Persistent=true

[Install]
WantedBy=timers.target
UNIT
done <<'JOBS'
reminders|*:0/15|curl -fsS -m 120 -H "Authorization: Bearer $$CRON_SECRET" http://127.0.0.1:3000/api/cron/reminders
google-sync|*:0/10|curl -fsS -m 120 -H "Authorization: Bearer $$CRON_SECRET" http://127.0.0.1:3000/api/cron/google-sync
backup|*-*-* 02:00:00|/opt/clinic/deploy/backup.sh
JOBS

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode gzip
	header Strict-Transport-Security "max-age=31536000; includeSubDomains"
	request_body {
		max_size 30MB
	}
	reverse_proxy 127.0.0.1:3000
}
CADDY

systemctl daemon-reload
systemctl enable --now clinic.service clinic-reminders.timer clinic-google-sync.timer clinic-backup.timer
systemctl restart clinic.service
systemctl reload caddy || systemctl restart caddy

echo "==> Firewall and security updates"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban unattended-upgrades

echo
echo "Done. Next steps (see docs/DEPLOY.md):"
echo " 1. GoDaddy DNS: A record  app -> $(curl -fsS -4 https://ifconfig.me 2>/dev/null || echo '<this server IP>')"
echo " 2. Create your login:  sudo bash $APP_DIR/deploy/create-owner.sh you@gmail.com \"Dr. Your Name\""
echo " 3. Open https://$DOMAIN"
if [[ "${NEW_SECRETS:-0}" == 1 ]]; then
  echo
  echo "IMPORTANT: copy ENCRYPTION_KEY and BACKUP_PASSPHRASE from $ENV_FILE to a password manager or print and lock them away."
  echo "Without them, encrypted notes and backups cannot be read. Command: sudo grep -E 'ENCRYPTION_KEY|BACKUP_PASSPHRASE' $ENV_FILE"
fi
