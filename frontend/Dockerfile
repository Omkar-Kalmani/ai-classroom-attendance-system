# ─────────────────────────────────────────────────────────────
#  Frontend Dockerfile — React + Vite → Nginx
#  Two-stage build:
#    Stage 1: Build React app with Node.js
#    Stage 2: Serve built files with Nginx (lightweight)
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build React app for production
RUN npm run build

# ── Stage 2: Serve with Nginx ──────────────────────────────
FROM nginx:alpine

# Copy built files to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for React Router (SPA routing)
RUN echo 'server { \
  listen 80; \
  location / { \
    root /usr/share/nginx/html; \
    index index.html; \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
