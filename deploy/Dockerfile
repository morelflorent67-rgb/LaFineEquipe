# Image de production du site (Next.js). Compilée sur le serveur par docker compose.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Variables nécessaires AU MOMENT de la compilation (métadonnées SEO, clés publiques). Aucun secret serveur ici.
ARG SITE_URL
ARG LFE_DATA_BACKEND
ARG LFE_HOSTED
ARG FACEIT_MODE
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV SITE_URL=$SITE_URL LFE_DATA_BACKEND=$LFE_DATA_BACKEND LFE_HOSTED=$LFE_HOSTED FACEIT_MODE=$FACEIT_MODE \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

COPY . .
RUN npm run build
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
