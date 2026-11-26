#!/usr/bin/env bash
# Forgot the login password? Sets a new temporary password (2FA unchanged).
# Usage: sudo bash /opt/clinic/deploy/reset-password.sh you@gmail.com
#        (no email = list the users)
set -euo pipefail
cd /opt/clinic
sudo -H -u clinic bash -c 'set -a; source /etc/clinic/clinic.env; set +a; npm run --silent reset-password -- "$@"' _ "$@"
