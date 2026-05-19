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

## Environment Variables

Backend: `server/.env`

- `PORT` (default `3001`)
- `DB_CONNECTION` (`sqlite`, `mysql`, atau `sqlserver`; default `sqlite`)
- `DATABASE_PATH` (default `./database/app.db`)
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` untuk MySQL/SQL Server
- `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` untuk SQL Server
- `UPLOAD_DIR` (default `./uploads`)
- `CORS_ORIGIN` (default `http://localhost:5173`)

Frontend: `client/.env` (opsional)

- `VITE_API_BASE_URL` (default `http://localhost:3001`)
- (Map View memakai OpenStreetMap/Leaflet, tidak butuh API key)

## Scripts

- `npm run dev` -> start server + client
- `npm run start` -> start server (serve API + static uploads)
- `npm run build` -> build client
- `npm run preview` -> preview client build
