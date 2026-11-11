# Déploiement sur VPS (Ubuntu)

1. Connecte-toi en SSH au VPS, puis : `git clone https://github.com/morelflorent67-rgb/LaFineEquipe.git /tmp/lfe && sudo bash /tmp/lfe/deploy/setup-server.sh`
2. Crée `/srv/lafineequipe/.env.production` (droits `chmod 600`, propriétaire `lfe`) avec les mêmes variables que `.env.example` :
   `LFE_DATA_BACKEND=supabase`, `LFE_HOSTED=1`, `NODE_ENV=production`, `SITE_URL=https://fineequipe.com`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `LFE_ADMIN_EMAIL`,
   `FACEIT_API_KEY`, `FACEIT_MODE=live`, `CRON_SECRET` (identique à celui du Vault Supabase).
   Ces valeurs se recopient depuis Netlify (Site configuration › Environment variables) ou ton `.env.local`. Ne les colle jamais dans un chat.
3. `sudo -u lfe bash /srv/lafineequipe/deploy/update.sh` (compile et démarre).
4. Au démarrage au boot : `sudo env PATH=$PATH pm2 startup systemd -u lfe --hp /home/lfe` puis exécuter la commande affichée.
5. DNS OVH (zone de fineequipe.com) : `A @` → IP du VPS, `CNAME www` → `fineequipe.com.`, supprimer l'ancien A Netlify (75.2.60.5).
6. Supabase : le secret `lfe_site_url` du Vault pointe déjà vers https://fineequipe.com, donc rien à changer pour le cron.
Mise à jour ensuite : relancer `update.sh`.
