# VOKA-SEAT — Deployment Guide

Panduan lengkap deploy VOKA-SEAT di Google Cloud Platform Ubuntu instance yang juga menjalankan project lain (ALTIVEX).

---

## 1. Co-Tenancy Snapshot

Berdasarkan `docker ps` di host, project tetangga sudah memakai port:

| Container | Host Port |
|-----------|-----------|
| altivex_backend | `8080:8080` |
| altivex_postgres | `5432` (internal) |
| altivex_mosquitto | `1883`, `9001` |

VOKA-SEAT **tidak boleh** menyentuh port-port di atas. Mapping port-safe:

| VOKA-SEAT Service | Host Port | Container Port |
|-------------------|-----------|----------------|
| Mosquitto MQTT | _tidak di-publish_ | `1883` (internal) |
| Mosquitto WebSocket | `9002` | `9001` |
| Postgres | `5434` | `5432` |
| Backend (Express + Socket.IO) | `3100` | `3000` |
| Frontend (nginx + Vite dist) | `8090` | `80` |

Semua service VOKA-SEAT berjalan di network bridge private `voka_seat_net`, jadi tidak ada interaksi langsung dengan ALTIVEX.

---

## 2. Prerequisites di Instance

Sudah tersedia di instance kamu (lihat output `docker ps` + `nginx`):
- Docker + Docker Compose
- nginx (host-level reverse proxy)
- certbot (Let's Encrypt)

Yang perlu disiapkan untuk VOKA-SEAT:

### a. Subdomain DuckDNS

Buat subdomain baru di [DuckDNS](https://www.duckdns.org/), misal:

```
voka-seat-pangrango.duckdns.org → IP eksternal GCP instance
```

### b. Buka Firewall GCP

VOKA-SEAT hanya butuh port `443` dan `80` (yang sudah dipakai ALTIVEX). Tidak ada firewall rule baru — nginx host-level routing yang membedakan project.

---

## 3. Clone Repository ke Instance

```bash
cd ~
git clone https://github.com/<your-org>/VOKA-SEAT.git
cd VOKA-SEAT
```

---

## 4. Konfigurasi Environment

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Isi semua nilai. Contoh:

```dotenv
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
PUBLIC_DOMAIN=voka-seat-pangrango.duckdns.org
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ganti-dengan-password-kuat
```

> **Penting:** `PUBLIC_DOMAIN` harus persis sama dengan subdomain DuckDNS yang akan kamu register di nginx. Build frontend akan menanam URL ini ke bundle JavaScript.

---

## 5. Build & Start Stack

```bash
cd ~/VOKA-SEAT/deploy
docker compose --env-file .env up -d --build
```

Build pertama kali ~3 menit (npm install + Vite build). Setelah selesai:

```bash
docker compose --env-file .env ps
```

Output yang diharapkan:

```
NAME                    STATUS              PORTS
voka_seat_mosquitto     Up (healthy)        0.0.0.0:9002->9001/tcp
voka_seat_postgres      Up (healthy)        0.0.0.0:5434->5432/tcp
voka_seat_backend       Up (healthy)        0.0.0.0:3100->3000/tcp
voka_seat_frontend      Up                  0.0.0.0:8090->80/tcp
```

Backend entrypoint otomatis:
- Sync schema (`prisma db push`)
- Seed 24 seats + 8 menu items + 7 inventory rows (sekali, jika tabel kosong)
- Seed AdminUser dari `ADMIN_USERNAME` / `ADMIN_PASSWORD`

---

## 6. Pasang nginx Server Block

```bash
sudo cp ~/VOKA-SEAT/deploy/nginx/voka-seat.conf /etc/nginx/sites-available/voka-seat

# Edit subdomain kalau berbeda dari default
sudo nano /etc/nginx/sites-available/voka-seat

# Aktifkan
sudo ln -s /etc/nginx/sites-available/voka-seat /etc/nginx/sites-enabled/voka-seat

# Validate (jangan reload kalau gagal)
sudo nginx -t
```

Server block di `/etc/nginx/sites-available/voka-seat` berdampingan dengan ALTIVEX. nginx otomatis routing berdasarkan `Host:` header.

---

## 7. Issue TLS Certificate

```bash
sudo certbot --nginx -d voka-seat-pangrango.duckdns.org
```

Certbot akan meng-edit server block dan mengaktifkan TLS. Setelah berhasil:

```bash
sudo systemctl reload nginx
```

---

## 8. Smoke Test

Dari laptop kamu (BUKAN instance):

```bash
# 1. Health check (harus 200 + JSON)
curl -i https://voka-seat-pangrango.duckdns.org/api/health
# Expected: { "status": "ok", "service": "VOKA-SEAT Backend" }

# 2. Seats list (harus 24 entries)
curl -s https://voka-seat-pangrango.duckdns.org/api/seats | jq 'length'
# Expected: 24

# 3. Admin login
curl -s -X POST https://voka-seat-pangrango.duckdns.org/api/auth/admin/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"ganti-dengan-password-kuat"}'
# Expected: { "token":"<jwt>", "admin":{"username":"admin"} }

# 4. Frontend
curl -sI https://voka-seat-pangrango.duckdns.org | head -5
# Expected: HTTP/2 200 + content-type: text/html
```

Buka di browser:
- **Customer App:** https://voka-seat-pangrango.duckdns.org/customer
- **Admin Dashboard:** https://voka-seat-pangrango.duckdns.org/

---

## 9. ESP32 Wiring

ESP32 nodes berkomunikasi ke broker MQTT. Karena broker tidak di-publish ke host, kamu punya dua pilihan:

### Opsi A — Internal-only (jika ESP32 akses backend via REST/WS)

Tidak perlu apa-apa. ESP32 bisa publish via WebSocket di port `9002`:
```
ws://voka-seat-pangrango.duckdns.org:9002/mqtt
```

### Opsi B — Publish broker ke host (rekomendasi untuk ESP32 native MQTT)

Edit `deploy/docker-compose.yml`:

```yaml
mosquitto:
  ports:
    - "1884:1883"   # tambahkan baris ini (1883 dipakai altivex_mosquitto)
    - "9002:9001"
```

Kemudian di nginx, tambahkan TCP proxy stream block atau gunakan port `1884` langsung (TCP MQTT bukan HTTP, jadi tidak melalui nginx server blocks).

Lalu di firmware ESP32:

```cpp
const char* MQTT_BROKER_HOST = "voka-seat-pangrango.duckdns.org";
const int   MQTT_BROKER_PORT = 1884;
```

Jangan lupa buka GCP firewall untuk port `1884` (TCP).

---

## 10. Operasi Sehari-hari

### Logs

```bash
# Backend
docker logs -f voka_seat_backend

# Mosquitto
docker logs -f voka_seat_mosquitto

# Postgres slow queries
docker logs voka_seat_postgres | grep slow

# nginx
sudo tail -f /var/log/nginx/voka-seat.access.log
sudo tail -f /var/log/nginx/voka-seat.error.log
```

### Update Code

```bash
cd ~/VOKA-SEAT
git pull
cd deploy
docker compose --env-file .env up -d --build
```

### Restart Single Service

```bash
docker compose --env-file .env restart backend
```

### Reset Database (HATI-HATI)

```bash
docker compose --env-file .env down
docker volume rm voka_seat_pg_data
docker compose --env-file .env up -d --build
```

### Backup Postgres

```bash
docker exec voka_seat_postgres pg_dump -U voka voka_seat_db > backup_$(date +%F).sql
```

---

## 11. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `EADDRINUSE` saat compose up | Cek `docker ps` — pastikan tidak ada container voka_seat_* yang masih berjalan |
| Frontend kosong (white screen) | Cek `VITE_API_URL` di build args sudah benar (browser dev tools → Network tab harus hit subdomain DuckDNS, bukan localhost) |
| 502 Bad Gateway | Cek `docker compose ps` — kalau backend tidak healthy, lihat logs |
| Admin login 401 | Cek env `ADMIN_USERNAME` dan `ADMIN_PASSWORD` di `deploy/.env`; backend re-seed setiap restart |
| Customer order 404 setelah deploy | Database belum migrasi — `docker exec voka_seat_backend npx prisma db push` |
| Certbot gagal | Pastikan port 80 terbuka di GCP firewall + DuckDNS sudah resolve ke IP instance |

---

## 12. Stop Stack

```bash
cd ~/VOKA-SEAT/deploy
docker compose --env-file .env down
```

Volume tetap ada (`voka_seat_pg_data`, `voka_seat_mosquitto_*`). Tambah `-v` untuk hapus semuanya termasuk data.
