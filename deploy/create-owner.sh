#!/usr/bin/env bash
# Create the first Owner login on the server.
# Usage: sudo bash /opt/clinic/deploy/create-owner.sh you@gmail.com "Dr. Your Name"
set -euo pipefail
[[ $# -ge 2 ]] || { echo 'Usage: create-owner.sh <email> "<full name>"'; exit 1; }
cd /opt/clinic
email="$1"; shift
sudo -H -u clinic bash -c 'set -a; source /etc/clinic/clinic.env; set +a; npm run --silent create-owner -- "$@"' _ "$email" "$*"
