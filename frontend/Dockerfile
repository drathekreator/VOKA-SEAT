# syntax=docker/dockerfile:1.7
# =====================================================================
# VOKA-SEAT Frontend — Vite build (admin + customer) served by nginx
# Final image listens on container port 80; compose republishes as 8090.
#
# Build-time configuration:
#   --build-arg VITE_API_URL=https://voka-seat-pangrango.duckdns.org
#
# When VITE_API_URL is unset the bundle falls back to http://localhost:4000
# (dev mode) — which won't work in production. The compose file passes
# this arg from PUBLIC_DOMAIN so the SPA fetches the correct host.
# =====================================================================

# ---------- Stage 1: build the Vite bundle --------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time public URL (e.g. https://voka-seat.example.com).
# Both VITE_API_URL and VITE_API_BASE_URL are accepted because
# different modules of the SPA read different keys.
ARG VITE_API_URL=
ARG VITE_API_BASE_URL=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: serve `dist/` with nginx -----------------------
FROM nginx:1.27-alpine AS runtime

# Replace the stock site with a minimal SPA-friendly config so deep
# links (e.g. /customer/cart) don't 404.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-cache hashed assets emitted by Vite.
    location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
EOF

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
