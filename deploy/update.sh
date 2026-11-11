#!/usr/bin/env bash
# Mise à jour / premier démarrage. À lancer en tant qu'utilisateur « lfe » :
#   sudo -u lfe bash /srv/lafineequipe/deploy/update.sh
set -euo pipefail
cd /srv/lafineequipe
[ -f .env.production ] || { echo "Manque .env.production (voir deploy/README.md)"; exit 1; }
git pull --ff-only
npm ci
set -a; . ./.env.production; set +a   # variables lues aussi pendant la compilation
npm run build
if pm2 describe lafineequipe >/dev/null 2>&1; then
  pm2 reload lafineequipe --update-env
else
  pm2 start npm --name lafineequipe -- start -- -p 3000 -H 127.0.0.1
  pm2 save
fi
echo "OK : site redémarré."
