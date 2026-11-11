# Déploiement sur le VPS (Docker, à côté de n8n)

- Code cloné dans `~/lafineequipe`, configuration dans `~/lafineequipe/deploy/.env` (non versionnée, `chmod 600`).
- Variables : voir `.env.example`, avec `LFE_DATA_BACKEND=supabase`, `LFE_HOSTED=1`, `SITE_URL=https://fineequipe.com`, `FACEIT_MODE=live`.
- Démarrer / mettre à jour : `bash ~/lafineequipe/deploy/update.sh`
- Caddy (celui de n8n) : bloc `fineequipe.com { reverse_proxy lafineequipe:3000 }` ajouté au Caddyfile, puis `docker exec n8n-caddy-1 caddy reload --config /etc/caddy/Caddyfile`.
- DNS OVH : `A @` → IP du VPS, `CNAME www` → `fineequipe.com.`
- Logs : `docker logs -f deploy-lafineequipe-1`
