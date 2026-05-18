# `deploy/nginx/` — Host-side nginx server block

This directory contains the **host-level** nginx reverse-proxy configuration
for VOKA-SEAT. It is separate from the in-container nginx that serves the
built frontend `dist/` artefact (that one runs inside the `frontend` service
from `deploy/docker-compose.yml`).

The host-side nginx already exists on the shared cloud instance and is the
TLS terminator for every subdomain on that box. Adding VOKA-SEAT means
dropping a new server block into `sites-available` (or symlinking from this
repo) and reloading nginx — no other host-level changes are required.

> Stack constraint (AGENTS.md §3 green rule): **Nginx only.** Do not migrate
> this block to Caddy / Traefik / HAProxy.

## Upstream port table

The server block proxies to the host-side ports published by the VOKA-SEAT
docker-compose stack (see `deploy/docker-compose.yml`, task 20.1):

| Public path                   | Upstream                  | Container target                        |
| ----------------------------- | ------------------------- | --------------------------------------- |
| `https://voka-seat.<domain>/` | `127.0.0.1:8090`          | frontend container (nginx serving dist) |
| `/api/`                       | `127.0.0.1:3100`          | backend container (Node.js + Express)   |
| `/socket.io/`                 | `127.0.0.1:3100/socket.io` | backend Socket.IO upgrade endpoint      |

The published ports (`8090`, `3100`) deliberately avoid the host ports already
in use by the co-tenant project (`8080:8080`, `1883`, `9001:9001`,
`5433:5432`).

## CLI-only installation checklist

> **MikroTik / Winbox NOT applicable here.** This is host-side nginx on the
> cloud Linux box. Per AGENTS.md §3 blue rules the project remains a
> CLI-only operation; no Winbox or other GUI is permitted anywhere in the
> stack, but that rule covers MikroTik specifically. The steps below are
> standard `ssh` + `sudo` shell commands.

1. **Install the server block.** Either copy or symlink:

   ```bash
   # Option A — copy
   sudo cp /opt/voka-seat/deploy/nginx/voka-seat.conf \
       /etc/nginx/sites-available/voka-seat.conf
   sudo ln -s /etc/nginx/sites-available/voka-seat.conf \
       /etc/nginx/sites-enabled/voka-seat.conf

   # Option B — symlink directly from the repo (preferred when the repo
   # lives under /opt/voka-seat and you want `git pull` to update nginx)
   sudo ln -s /opt/voka-seat/deploy/nginx/voka-seat.conf \
       /etc/nginx/sites-enabled/voka-seat.conf
   ```

2. **Replace the placeholder domain.** Edit the file in place and change
   every `voka-seat.example.com` to the real subdomain
   (`server_name`, `ssl_certificate`, `ssl_certificate_key`):

   ```bash
   sudo sed -i 's/voka-seat\.example\.com/voka-seat.<domain>/g' \
       /etc/nginx/sites-available/voka-seat.conf
   ```

3. **Issue / renew the Let's Encrypt certificate** (one-shot, non-Winbox):

   ```bash
   sudo certbot --nginx -d voka-seat.<domain>
   ```

4. **Validate nginx syntax** before reloading:

   ```bash
   sudo nginx -t
   ```

5. **Reload nginx** to apply the new server block without dropping
   existing connections:

   ```bash
   sudo systemctl reload nginx
   ```

6. **Verify the daemon is healthy:**

   ```bash
   sudo systemctl status nginx
   ```

## Smoke tests

### HTTPS health check

The backend exposes `GET /api/health`. After reload, this should return
`200 OK`:

```bash
curl -fsSI https://voka-seat.<domain>/api/health
```

### WebSocket sanity check

Confirm the Socket.IO upgrade survives the 60-second-default proxy timeout
(the `/socket.io/` block raises it to 3600s for long-lived sessions):

```bash
wscat -c "wss://voka-seat.<domain>/socket.io/?EIO=4&transport=websocket"
# keep the connection open for >60s and confirm it stays alive
```

## Files in this directory

| File              | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `voka-seat.conf`  | The host-side nginx server block (port 80 + 443 + proxies) |
| `README.md`       | This file                                                  |
