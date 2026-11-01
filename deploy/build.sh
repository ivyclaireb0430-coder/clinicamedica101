#!/usr/bin/env bash
# Install dependencies, apply database migrations and build. Used by setup-server.sh and update.sh.
set -euo pipefail
APP_DIR=/opt/clinic
ENV_FILE=/etc/clinic/clinic.env
cd "$APP_DIR"
run() { sudo -H -u clinic --preserve-env=PATH bash -c "set -a; source $ENV_FILE; set +a; $*"; }
run "npm ci --include=dev --no-audit --no-fund"
run "npx prisma migrate deploy"
run "npm run build"
