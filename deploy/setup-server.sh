#!/usr/bin/env bash
# Installation unique du site sur un VPS Ubuntu (22.04 / 24.04). À lancer en root :
#   sudo bash setup-server.sh
# Installe Node 22, PM2 et Caddy (HTTPS automatique), clone le dépôt dans /srv/lafineequipe.
set -euo pipefail
DOMAIN="fineequipe.com"
APP_DIR="/srv/lafineequipe"
APP_USER="lfe"
REPO="https://github.com/morelflorent67-rgb/LaFineEquipe.git"

apt-get update
apt-get install -y curl git ufw debian-keyring debian-archive-keyring apt-transport-https gpg

# Node 22
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

# Caddy
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi

# Utilisateur dédié (le site ne tourne pas en root)
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
[ -d "$APP_DIR/.git" ] || git clone "$REPO" "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# Pare-feu : SSH + web uniquement
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# Caddy : reverse proxy vers Next.js (127.0.0.1:3000), certificat Let's Encrypt automatique
cat > /etc/caddy/Caddyfile <<CADDY
www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl reload caddy || systemctl restart caddy

echo
echo "Étape suivante : crée $APP_DIR/.env.production (voir deploy/README.md) puis lance : sudo -u $APP_USER bash $APP_DIR/deploy/update.sh"
