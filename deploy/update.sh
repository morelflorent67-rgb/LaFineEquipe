#!/usr/bin/env bash
# Mise à jour du site sur le VPS : récupère le code, recompile l'image, redémarre.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose -f deploy/docker-compose.yml up -d --build
docker image prune -f >/dev/null
echo "OK : site à jour."
