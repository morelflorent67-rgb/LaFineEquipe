#!/usr/bin/env bash
# Mise à jour du site sur le VPS : récupère le code, recompile l'image, redémarre.
# Nettoie ensuite les anciennes images et plafonne le cache de compilation (pas de croissance au fil des mises à jour).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose -f deploy/docker-compose.yml up -d --build
docker image prune -f >/dev/null
docker builder prune -f --keep-storage 2GB >/dev/null
echo "OK : site à jour."
