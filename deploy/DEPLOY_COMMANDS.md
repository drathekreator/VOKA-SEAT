# VOKA-SEAT — Deployment Commands (GCP Ubuntu, co-tenant ALTIVEX)

Brief: `~/VOKA-SEAT/DEPLOYMENT_BRIEF.md` (v1.0)
Domain: `vokafe.duckdns.org` (customer) + `vokafe-admin.duckdns.org` (admin)
MQTT strategy: **Opsi B** — broker terpisah `voka_seat_mosquitto`, port host `1884`, publik untuk ESP32

---

## 0. Pre-flight di laptop (sebelum push ke GitHub)

Pastikan kamu sudah commit semua perubahan terbaru, lalu push:

```powershell
cd c:\Users\USER\Documents\VOKA-SEAT
git status
git add -A
git commit -m "deploy: dual-domain (vokafe + vokafe-admin) + Opsi B MQTT broker"
git push
```

---

## 1. SSH ke GCP instance

```bash
gcloud compute ssh instance-20260424-035716 --zone=asia-southeast2-a
```

Atau via web console SSH.

---

## 2. Open GCP firewall untuk MQTT publik (port 1884)

Tag-kan firewall ke instance (tag `mqtt-broker` sudah ada untuk ALTIVEX di port 1883). Tambahkan rule baru untuk 1884:

```bash
gcloud compute firewall-rules create voka-seat-mqtt \
    --description="VOKA-SEAT MQTT broker (ESP32 telemetry)" \
    --direction=INGRESS \
    --action=ALLOW \
    --rules=tcp:1884 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=mqtt-broker
```

> **Catatan keamanan:** broker akan publik di internet pada port 1884. Karena `mosquitto.conf` saat ini `allow_anonymous true` (MVP), siapa saja bisa publish/subscribe. Untuk production sungguhan, baca §10 di akhir.

---

## 3. Verifikasi DuckDNS sudah resolve

```bash
dig +short vokafe.duckdns.org
dig +short vokafe-admin.duckdns.org
# Expected: 35.219.1.25 (IP instance) untuk dua-duanya
```

Kalau belum resolve, tunggu 1-2 menit propagasi DNS.

---

## 4. Clone repo + build stack

```bash
cd ~
git clone https://github.com/<your-org>/VOKA-SEAT.git
cd VOKA-SEAT/deploy

# Bikin .env dengan secret fresh
cp .env.example .env
nano .env
```

Isi `.env`:

```dotenv
POSTGRES_PASSWORD=<run: openssl rand -hex 16>
JWT_SECRET=<run: openssl rand -hex 32>
PUBLIC_DOMAIN_CUSTOMER=vokafe.duckdns.org
PUBLIC_DOMAIN_ADMIN=vokafe-admin.duckdns.org
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<password kuat untuk dashboard admin>
```

Generate password dengan:
```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
```

Build & start:

```bash
docker compose --env-file .env up -d --build
```

Pertama kali build ~3-5 menit (npm install + Vite build).

Verify:

```bash
docker compose --env-file .env ps
# Expected: 4 services (mosquitto, postgres, backend, frontend) all "Up" / "healthy"

docker compose --env-file .env logs backend --tail=30
# Expected: "Admin account refreshed", "Server running on http://localhost:3000",
#           "Connected to MQTT Broker: mqtt://voka_seat_mosquitto:1883"
```

---

## 5. Pasang nginx vhosts (dua subdomain)

```bash
# Customer subdomain
sudo cp ~/VOKA-SEAT/deploy/nginx/vokafe.conf /etc/nginx/sites-available/vokafe
sudo ln -s /etc/nginx/sites-available/vokafe /etc/nginx/sites-enabled/vokafe

# Admin subdomain
sudo cp ~/VOKA-SEAT/deploy/nginx/vokafe-admin.conf /etc/nginx/sites-available/vokafe-admin
sudo ln -s /etc/nginx/sites-available/vokafe-admin /etc/nginx/sites-enabled/vokafe-admin

# Validate (jangan reload kalau gagal)
sudo nginx -t
```

> Kalau `nginx -t` keluar `duplicate "map" "..."`: artinya brief mengasumsikan vhost altivex sudah punya `map $http_upgrade $connection_upgrade {...}` di scope http. Cek dulu:
> ```bash
> sudo grep -A2 'map \$http_upgrade' /etc/nginx/sites-available/altivex
> ```
> Kalau tidak ada, tambahkan SEKALI saja di salah satu file (misal `/etc/nginx/conf.d/00-shared.conf`):
> ```nginx
> map $http_upgrade $connection_upgrade {
>     default upgrade;
>     ''      close;
> }
> ```

Reload setelah `nginx -t` clean:

```bash
sudo systemctl reload nginx
```

---

## 6. Issue TLS certificate (Let's Encrypt)

Dua subdomain, dua cert:

```bash
sudo certbot --nginx -d vokafe.duckdns.org
sudo certbot --nginx -d vokafe-admin.duckdns.org
```

Certbot otomatis:
1. Verify ACME http-01 challenge via `/.well-known/acme-challenge/`
2. Issue cert ke `/etc/letsencrypt/live/<domain>/fullchain.pem`
3. Edit vhost untuk attach cert (sudah disiapkan di file kita)
4. Reload nginx

Test renew (dry-run):
```bash
sudo certbot renew --dry-run
```

---

## 7. Smoke test (dari laptop kamu, BUKAN dari instance)

```bash
# 1. Customer endpoint health
curl -i https://vokafe.duckdns.org/api/health
# Expected: HTTP/2 200 + {"status":"ok","service":"VOKA-SEAT Backend"}

# 2. Admin endpoint health (sama backend, beda subdomain)
curl -i https://vokafe-admin.duckdns.org/api/health
# Expected: HTTP/2 200 + sama JSON

# 3. Seats list
curl -s https://vokafe.duckdns.org/api/seats | head -3
# Expected: 24 seats array

# 4. Admin login
curl -s -X POST https://vokafe-admin.duckdns.org/api/auth/admin/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD-dari-env>"}'
# Expected: {"token":"<jwt>","admin":{"username":"admin"}}

# 5. Frontend HTML
curl -sI https://vokafe.duckdns.org | head -5
# Expected: HTTP/2 200, content-type: text/html

# 6. ALTIVEX masih hidup (regression check)
curl -sI https://altivex-pangrango.duckdns.org | head -3
# Expected: HTTP/2 200
```

Kalau semua PASS, buka di browser:
- **Customer:** https://vokafe.duckdns.org → langsung CustomerApp (Menu tab)
- **Admin:** https://vokafe-admin.duckdns.org → AdminLoginScreen → login → dashboard

---

## 8. Smoke test ESP32 → MQTT → web

Dari laptop atau ESP32, publish telemetri ke broker publik:

```bash
# Install mosquitto client di laptop kalau belum
# Linux: sudo apt install mosquitto-clients
# macOS: brew install mosquitto
# Windows: download dari https://mosquitto.org/download/

mosquitto_pub \
  -h vokafe.duckdns.org \
  -p 1884 \
  -t 'vokafe/iot/telemetry' \
  -m '{"id_kursi":5,"status":1}'
```

Buka https://vokafe.duckdns.org di browser → tab **Tables** → kursi 5 harus berubah jadi **magenta (occupied)** dalam <1 detik.

Reset:
```bash
mosquitto_pub -h vokafe.duckdns.org -p 1884 \
  -t 'vokafe/iot/telemetry' -m '{"id_kursi":5,"status":0}'
```

Untuk firmware ESP32, sesuaikan `firmware/voka_seat_node_template.ino`:

```cpp
const char* MQTT_BROKER_HOST = "vokafe.duckdns.org";
const int   MQTT_BROKER_PORT = 1884;
```

---

## 9. Verifikasi sesuai brief checklist

```bash
# 1. VOKA-SEAT containers running
docker ps --format "{{.Names}}|{{.Ports}}" | grep voka_seat_

# 2. ALTIVEX masih hidup
docker ps --format "{{.Names}}|{{.Status}}" | grep altivex_

# 3. Port host check
sudo ss -tlnp | grep -E ':(80|443|1883|1884|3100|8080|8090)'
# Expected:
#   80, 443  → nginx
#   1883     → docker-proxy (altivex_mosquitto)
#   1884     → docker-proxy (voka_seat_mosquitto)
#   3100     → docker-proxy (voka_seat_backend, 127.0.0.1 only)
#   8080     → docker-proxy (altivex_backend)
#   8090     → docker-proxy (voka_seat_frontend, 127.0.0.1 only)

# 4. Network terpisah
docker network ls | grep -E '(altivex|voka_seat)'
# Expected: altivex_default + voka_seat_default

# 5. nginx valid
sudo nginx -t

# 6. Domain resolve
dig +short vokafe.duckdns.org
dig +short vokafe-admin.duckdns.org

# 7. HTTPS hidup (kedua subdomain)
curl -I https://vokafe.duckdns.org
curl -I https://vokafe-admin.duckdns.org

# 8. ALTIVEX HTTPS regression
curl -I https://altivex-pangrango.duckdns.org
```

---

## 10. Hardening MQTT (production checklist)

Saat ini `mosquitto.conf` pakai `allow_anonymous true`. Untuk production:

```bash
# Generate password file
docker exec -it voka_seat_mosquitto sh -c \
  "mosquitto_passwd -c -b /mosquitto/data/passwd voka_esp32 <strong-password>"

# Edit deploy/mosquitto/mosquitto.conf:
nano ~/VOKA-SEAT/deploy/mosquitto/mosquitto.conf
```

Ganti jadi:
```
listener 1883 0.0.0.0
protocol mqtt
allow_anonymous false
password_file /mosquitto/data/passwd

listener 9001 0.0.0.0
protocol websockets
allow_anonymous false
password_file /mosquitto/data/passwd
```

Update backend env di `deploy/.env`:
```dotenv
MQTT_USERNAME=voka_esp32
MQTT_PASSWORD=<strong-password>
```

(Backend belum implement basic-auth MQTT — kalau perlu, ping aku untuk patch.)

Restart:
```bash
docker compose --env-file .env restart mosquitto backend
```

Update firmware ESP32 untuk pakai `mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)`.

---

## 11. Troubleshooting

| Gejala | Cek |
|--------|-----|
| `nginx -t` error "duplicate map" | Map block sudah ada di altivex vhost — buang map block dari `vokafe.conf`/`vokafe-admin.conf` (sudah aman, kita tidak duplikasi) |
| 502 Bad Gateway | `docker compose ps` — backend tidak healthy. Lihat `docker logs voka_seat_backend` |
| Frontend kosong / blank | `VITE_API_URL` salah saat build. Cek browser DevTools Network tab — kalau hit `localhost:4000`, rebuild dengan `docker compose --env-file .env up -d --build frontend` |
| Customer subdomain serve admin | `main.tsx` tidak deteksi hostname. Pastikan domain `vokafe.duckdns.org` benar-benar match `host.startsWith('vokafe.')` |
| ESP32 connect MQTT failed | `nc -zv vokafe.duckdns.org 1884` — kalau timeout, GCP firewall belum allow 1884 |
| Cert renew gagal | `sudo certbot renew --dry-run` — biasanya nginx tidak reload setelah ALTIVEX edit. Jalankan `sudo systemctl reload nginx` manual |

---

## 12. Update / restart

```bash
cd ~/VOKA-SEAT
git pull
cd deploy
docker compose --env-file .env up -d --build

# Restart single service
docker compose --env-file .env restart backend
```

## 13. Backup / restore Postgres

```bash
# Backup
docker exec voka_seat_postgres pg_dump -U voka voka_seat_db > backup_$(date +%F).sql

# Restore
cat backup_2026-05-18.sql | docker exec -i voka_seat_postgres psql -U voka voka_seat_db
```
