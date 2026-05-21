# Mapping Jaringan (ODC/PON/BOX/Tiang) + Topology

Implementasi sesuai `Dokumentasi_mapping.md` menggunakan **React (JS)** untuk frontend dan **Node.js Express** untuk backend, dengan pilihan database **SQLite**, **MySQL/MariaDB**, atau **SQL Server**.

## Prasyarat

- Node.js 18+ (disarankan 20+)

## Setup

1) Install dependency:

```bash
npm install
```

2) Buat file env backend:

```bash
copy server\\.env.example server\\.env
```

3) Jalankan dev:

```bash
npm run dev
```

Default `npm run dev` sekarang **mode kesatuan** (UI + API satu port, default `http://localhost:3010`).
Kalau butuh mode lama (client `:5173` terpisah), pakai `npm run dev:split`.
Kalau kamu set `BASE_PATH` (mis. `/cordinat`), aksesnya jadi `http://localhost:3010/cordinat/`.

## Environment Variables

Backend: `server/.env`

- `PORT` (default `3010`)
- `DB_CONNECTION` (`sqlite`, `mysql`, `postgres`, atau `sqlserver`; default `sqlite`)
- `DATABASE_PATH` (default `./database/app.db`)
- `DATABASE_URL` (untuk `postgres`, contoh Supabase)
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` untuk MySQL/SQL Server
- `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` untuk SQL Server
- `UPLOAD_DIR` (default `./uploads`)
- `CORS_ORIGIN` (default `http://localhost:5173`)

Frontend: `client/.env` (opsional)

- `VITE_API_BASE_URL` (opsional; defaultnya client pakai same-origin `/api/*`)
- (Map View memakai OpenStreetMap/Leaflet, tidak butuh API key)

## Scripts

- `npm run dev` -> dev mode kesatuan (UI + API satu port)
- `npm run dev:split` -> mode dev terpisah (backend default di `:3011`, client di `:5173`)
- `npm run start` -> start server (API + uploads; serve client hanya bila production atau `SERVE_CLIENT=1`)
- `npm run start:full` -> build client lalu start server serve `client/dist`
- `npm run build` -> build client
- `npm run preview` -> preview client build

## Publish ke Ubuntu (Production)

Target: **1 service Node.js** yang serve **API + uploads + build React**.

### 1) Build React

Di mesin build (bisa di server Ubuntu juga):

```bash
npm ci
VITE_BASE_PATH=/cordinat/ npm run build --workspace client
```

Hasilnya ada di `client/dist`.

### 2) Jalankan backend (serve API + client/dist)

Set env backend `server/.env` (atau environment di PM2) dan pastikan:

- `NODE_ENV=production`
- `SERVE_CLIENT=1` (biar server serve `client/dist`)
- `BASE_PATH=/cordinat` (kalau mau diakses di `.../cordinat`)
- `PORT=3010` (atau port yang kamu mau)
- `JWT_SECRET` minimal 32 karakter

Jalankan:

```bash
npm ci
npm run migrate --workspace server
node server/server.js
```

### 3) PM2 (disarankan)

```bash
npm i -g pm2
pm2 start server/ecosystem.config.cjs
pm2 save
pm2 startup
```

### 4) Nginx reverse proxy (opsional tapi umum)

Contoh server block (arahin ke port Node, mis. 3010):

```nginx
server {
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Lalu `sudo nginx -t && sudo systemctl reload nginx`.

### Integrasi dengan Laravel di `group.jonusa.net/cordinat`

Tambahkan di vhost `group.jonusa.net` (Laravel) bagian ini **di atas** `location /` Laravel:

```nginx
location = /cordinat { return 301 /cordinat/; }

location ^~ /cordinat/ {
  proxy_pass http://127.0.0.1:3010;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Production (tanpa `run dev`)

Build React lalu jalankan server Express untuk serve API + React build:

```bash
npm ci
npm run start:full
```

Catatan:
- Di mode production, server otomatis serve `client/dist` (SPA) dan `uploads/`.
- Kalau mau paksa serve client di non-production, set `SERVE_CLIENT=1` di `server/.env`.
- `start:full` otomatis build client dengan `VITE_BASE_PATH` mengikuti `BASE_PATH` di `server/.env`.
