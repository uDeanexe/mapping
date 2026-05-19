# Dokumentasi Project: Sistem Mapping Tiang, Box, ODC, PON & Topology Jaringan

## 1. Ringkasan Project

Project ini adalah sistem web sederhana untuk mendokumentasikan infrastruktur jaringan fisik lapangan seperti **tiang**, **box/ODP**, **ODC**, **jalur PON**, dan hubungan antar titik jaringan.

Konsep utama sistem ini mirip seperti **Cisco Packet Tracer**, tetapi bukan untuk simulasi perangkat jaringan. Sistem ini dipakai untuk membuat **peta dokumentasi fisik** dan **topology visual** jaringan berdasarkan data lapangan.

Sistem berfokus pada:

- Dokumentasi titik tiang.a
- Dokumentasi box/ODP.
- Dokumentasi ODC.
- Dokumentasi jalur PON.
- Upload foto tiang atau box.
- Penyimpanan koordinat GPS.
- Tampilan map menggunakan Google Maps.
- Tampilan topology seperti diagram jaringan.
- Relasi antar node, misalnya ODC ke PON, PON ke box, box ke tiang.

Sistem **tidak** digunakan untuk monitoring jaringan aktif.

---

## 2. Scope Project

### 2.1 Yang Dikerjakan

- Membuat aplikasi web sederhana.
- Membuat halaman dashboard map.
- Membuat input data node jaringan.
- Membuat upload foto node.
- Membuat penyimpanan koordinat latitude dan longitude.
- Membuat koneksi antar node seperti topology.
- Membuat tampilan diagram topology seperti Cisco Packet Tracer sederhana.
- Membuat penyimpanan data ke database SQL.
- Membuat API backend sederhana.
- Membuat integrasi Google Maps.
- Membuat dokumentasi project lengkap.

### 2.2 Yang Tidak Dikerjakan

- Tidak membuat monitoring realtime.
- Tidak membaca data dari OLT.
- Tidak membaca data dari ONT/ONU.
- Tidak membaca SNMP.
- Tidak terhubung ke Mikrotik.
- Tidak menghitung redaman otomatis.
- Tidak memakai status manual seperti normal, loss, atau redaman.
- Tidak membuat provisioning pelanggan.
- Tidak membuat auto-discovery jaringan.

---

## 3. Konsep Sistem

Sistem dibagi menjadi dua tampilan utama:

1. **Map View**
2. **Topology View**

### 3.1 Map View

Map View digunakan untuk melihat posisi fisik titik jaringan di lapangan berdasarkan koordinat GPS.

Contoh object pada map:

- Tiang.
- Box/ODP.
- ODC.
- Titik sambungan.
- Titik pelanggan jika nanti dibutuhkan.

Setiap titik pada map dapat memiliki:

- Nama/kode node.
- Jenis node.
- Foto.
- Latitude.
- Longitude.
- Alamat/keterangan lokasi.
- Catatan teknisi.

### 3.2 Topology View

Topology View digunakan untuk melihat hubungan antar titik jaringan seperti diagram.

Contoh:

```text
ODC-A
  └── PON-01
       └── BOX-001
            └── BOX-002
                 └── TIANG-001
```

Topology View tidak wajib mengikuti posisi GPS. Posisi node pada topology disimpan sebagai koordinat layar:

- `pos_x`
- `pos_y`

Jadi node bisa di-drag dan disusun rapi seperti Cisco Packet Tracer.

---

## 4. Jenis Object / Node

### 4.1 ODC

ODC adalah titik distribusi utama.

Data minimal:

- Kode ODC.
- Nama ODC.
- Koordinat.
- Foto.
- Catatan.

Contoh:

```text
ODC-CBT-001
```

### 4.2 PON

PON adalah jalur dari ODC.

Data minimal:

- Nama PON.
- ODC induk.
- Keterangan jalur.

Contoh:

```text
PON-01
PON-02
PON-03
```

### 4.3 Box / ODP

Box/ODP adalah titik distribusi di lapangan.

Data minimal:

- Kode box.
- Jalur PON.
- Koordinat.
- Foto.
- Catatan.

Contoh:

```text
BOX-MWR-001
BOX-MWR-002
```

### 4.4 Tiang

Tiang adalah titik fisik untuk dokumentasi jalur kabel.

Data minimal:

- Kode tiang.
- Koordinat.
- Foto tiang.
- Catatan lokasi.

Contoh:

```text
TIANG-001
TIANG-002
```

### 4.5 Customer / Rumah Pelanggan

Object ini opsional. Bisa ditambahkan nanti jika sistem perlu menyimpan lokasi pelanggan.

---

## 5. Relasi Jalur / Link

Link adalah hubungan antar node.

Contoh link:

```text
ODC-A -> PON-01
PON-01 -> BOX-001
BOX-001 -> BOX-002
BOX-002 -> TIANG-001
```

Link tidak memiliki status jaringan. Link hanya menyimpan informasi dokumentasi jalur.

Data link:

- Node asal.
- Node tujuan.
- Jenis kabel.
- Jumlah core.
- Nomor core.
- Keterangan jalur.

---

## 6. Teknologi Project

### 6.1 Frontend

- HTML5.
- CSS3.
- JavaScript murni / Vanilla JS.
- Google Maps JavaScript API.
- Library topology seperti jsPlumb atau Drawflow.

### 6.2 Backend

- Node.js.
- Express.js.
- Multer untuk upload foto.

### 6.3 Database

Untuk versi sederhana:

- SQLite.

Untuk versi produksi lebih besar:

- MySQL atau PostgreSQL.

### 6.4 Map Provider

- Google Maps Platform.

---

## 7. Arsitektur Sistem

```text
Browser
  |
  | HTML + CSS + Vanilla JS
  |
  | REST API
  v
Node.js Express Server
  |
  | SQL Query
  v
SQLite Database
  |
  | File Path
  v
Folder Upload Foto
```

---

## 8. Struktur Folder Project

```text
mapping-jaringan/
│
├── server.js
├── package.json
├── .env
├── README.md
│
├── database/
│   ├── app.db
│   └── schema.sql
│
├── uploads/
│   ├── nodes/
│   └── temp/
│
└── public/
    ├── index.html
    ├── topology.html
    │
    ├── css/
    │   ├── main.css
    │   ├── map.css
    │   └── topology.css
    │
    ├── js/
    │   ├── config.js
    │   ├── api.js
    │   ├── map.js
    │   ├── topology.js
    │   ├── nodes.js
    │   └── links.js
    │
    └── assets/
        ├── icons/
        └── images/
```

---

## 9. Database Design

### 9.1 Tabel `node_types`

Menyimpan jenis node.

```sql
CREATE TABLE node_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Data awal:

```sql
INSERT INTO node_types (name, label, icon) VALUES
('odc', 'ODC', 'odc.png'),
('pon', 'PON', 'pon.png'),
('box', 'Box / ODP', 'box.png'),
('pole', 'Tiang', 'pole.png'),
('customer', 'Customer', 'customer.png');
```

### 9.2 Tabel `nodes`

Menyimpan semua titik jaringan.

```sql
CREATE TABLE nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_type_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  photo_path TEXT,
  notes TEXT,
  topology_x INTEGER DEFAULT 100,
  topology_y INTEGER DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (node_type_id) REFERENCES node_types(id)
);
```

### 9.3 Tabel `links`

Menyimpan hubungan antar node.

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_node_id INTEGER NOT NULL,
  target_node_id INTEGER NOT NULL,
  cable_type TEXT,
  core_count INTEGER,
  core_number TEXT,
  pon_name TEXT,
  odc_name TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_node_id) REFERENCES nodes(id),
  FOREIGN KEY (target_node_id) REFERENCES nodes(id)
);
```

### 9.4 Tabel `photos`

Opsional jika satu node bisa punya banyak foto.

```sql
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
```

### 9.5 Tabel `activity_logs`

Opsional untuk menyimpan histori perubahan data.

```sql
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. API Design

Base URL:

```text
/api
```

### 10.1 Node API

#### Get Semua Node

```http
GET /api/nodes
```

Response:

```json
[
  {
    "id": 1,
    "code": "TIANG-001",
    "name": "Tiang Depan Gang Mawar",
    "type": "pole",
    "latitude": -6.2615,
    "longitude": 107.1528,
    "address": "Cibitung, Bekasi",
    "photo_path": "/uploads/nodes/tiang-001.jpg",
    "notes": "Tiang dekat warung"
  }
]
```

#### Get Detail Node

```http
GET /api/nodes/:id
```

#### Create Node

```http
POST /api/nodes
Content-Type: multipart/form-data
```

Body:

```text
node_type_id
code
name
latitude
longitude
address
notes
photo
```

#### Update Node

```http
PUT /api/nodes/:id
Content-Type: multipart/form-data
```

#### Delete Node

```http
DELETE /api/nodes/:id
```

---

### 10.2 Link API

#### Get Semua Link

```http
GET /api/links
```

#### Create Link

```http
POST /api/links
Content-Type: application/json
```

Body:

```json
{
  "source_node_id": 1,
  "target_node_id": 2,
  "cable_type": "fiber optic",
  "core_count": 12,
  "core_number": "core 1-4",
  "pon_name": "PON-01",
  "odc_name": "ODC-CBT-001",
  "notes": "Jalur utama dari ODC ke box pertama"
}
```

#### Delete Link

```http
DELETE /api/links/:id
```

---

### 10.3 Topology Position API

Untuk menyimpan posisi drag node pada topology view.

```http
PATCH /api/nodes/:id/position
Content-Type: application/json
```

Body:

```json
{
  "topology_x": 350,
  "topology_y": 180
}
```

---

## 11. Google Maps Integration

### 11.1 Kebutuhan Google Maps

Untuk menggunakan Google Maps pada web, project membutuhkan:

- Google Cloud project.
- API Key.
- Maps JavaScript API enabled.
- Map ID jika memakai Advanced Marker.
- Restriction API key untuk keamanan.

### 11.2 File `.env`

```env
PORT=3000
DATABASE_PATH=./database/app.db
GOOGLE_MAPS_API_KEY=ISI_API_KEY_KAMU
```

Catatan: API key sebaiknya tidak ditulis langsung di repository publik.

### 11.3 Load Google Maps di HTML

```html
<script
  async
  defer
  src="https://maps.googleapis.com/maps/api/js?key=ISI_API_KEY_KAMU&callback=initMap&libraries=marker">
</script>
```

### 11.4 Inisialisasi Google Map

```js
let map;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {
      lat: -6.2615,
      lng: 107.1528
    },
    zoom: 15,
    mapId: 'YOUR_MAP_ID'
  });

  loadNodesToMap();
}
```

### 11.5 Menampilkan Marker Node

```js
async function loadNodesToMap() {
  const nodes = await apiGet('/api/nodes');

  nodes.forEach((node) => {
    if (!node.latitude || !node.longitude) return;

    const markerContent = document.createElement('div');
    markerContent.className = 'custom-marker';
    markerContent.innerHTML = `
      <div class="marker-icon marker-${node.type}">
        ${node.type.toUpperCase()}
      </div>
    `;

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: {
        lat: Number(node.latitude),
        lng: Number(node.longitude)
      },
      content: markerContent,
      title: node.code
    });

    marker.addListener('click', () => {
      openNodeInfoWindow(node, marker);
    });
  });
}
```

### 11.6 Popup Detail Marker

```js
let infoWindow;

function openNodeInfoWindow(node, marker) {
  if (!infoWindow) {
    infoWindow = new google.maps.InfoWindow();
  }

  const photoHtml = node.photo_path
    ? `<img src="${node.photo_path}" class="popup-photo" />`
    : '';

  infoWindow.setContent(`
    <div class="popup-card">
      <h3>${node.code}</h3>
      <p><strong>Nama:</strong> ${node.name || '-'}</p>
      <p><strong>Jenis:</strong> ${node.type}</p>
      <p><strong>Koordinat:</strong> ${node.latitude}, ${node.longitude}</p>
      <p><strong>Alamat:</strong> ${node.address || '-'}</p>
      <p><strong>Catatan:</strong> ${node.notes || '-'}</p>
      ${photoHtml}
    </div>
  `);

  infoWindow.open({
    anchor: marker,
    map
  });
}
```

### 11.7 Mengambil Koordinat dari GPS Browser

```js
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert('Browser tidak mendukung geolocation');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      document.getElementById('latitude').value = lat;
      document.getElementById('longitude').value = lng;

      map.setCenter({ lat, lng });
    },
    (error) => {
      alert('Gagal mengambil lokasi: ' + error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}
```

### 11.8 Menggambar Jalur Antar Node di Google Maps

```js
async function loadLinksToMap() {
  const links = await apiGet('/api/links');

  links.forEach((link) => {
    if (!link.source_latitude || !link.source_longitude) return;
    if (!link.target_latitude || !link.target_longitude) return;

    const path = [
      {
        lat: Number(link.source_latitude),
        lng: Number(link.source_longitude)
      },
      {
        lat: Number(link.target_latitude),
        lng: Number(link.target_longitude)
      }
    ];

    new google.maps.Polyline({
      path,
      geodesic: true,
      strokeOpacity: 1,
      strokeWeight: 3,
      map
    });
  });
}
```

---

## 12. Topology View Implementation

Topology View adalah tampilan diagram jaringan. View ini tidak bergantung pada koordinat GPS.

### 12.1 Prinsip Topology

Setiap node memiliki posisi:

```text
topology_x
topology_y
```

Setiap link menghubungkan:

```text
source_node_id -> target_node_id
```

### 12.2 Tampilan HTML Topology

```html
<div class="topology-page">
  <aside class="topology-sidebar">
    <button data-type="odc">Tambah ODC</button>
    <button data-type="pon">Tambah PON</button>
    <button data-type="box">Tambah Box</button>
    <button data-type="pole">Tambah Tiang</button>
  </aside>

  <main id="topologyCanvas" class="topology-canvas"></main>
</div>
```

### 12.3 Node Topology

```js
function createTopologyNode(node) {
  const el = document.createElement('div');
  el.className = `topology-node topology-${node.type}`;
  el.dataset.nodeId = node.id;

  el.style.left = `${node.topology_x}px`;
  el.style.top = `${node.topology_y}px`;

  el.innerHTML = `
    <div class="node-title">${node.code}</div>
    <div class="node-type">${node.type}</div>
  `;

  makeNodeDraggable(el, node.id);

  document.getElementById('topologyCanvas').appendChild(el);
}
```

### 12.4 Drag Node

```js
function makeNodeDraggable(element, nodeId) {
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;

  element.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    element.style.left = `${e.clientX - offsetX}px`;
    element.style.top = `${e.clientY - offsetY}px`;
  });

  document.addEventListener('mouseup', async () => {
    if (!isDragging) return;
    isDragging = false;

    await apiPatch(`/api/nodes/${nodeId}/position`, {
      topology_x: parseInt(element.style.left, 10),
      topology_y: parseInt(element.style.top, 10)
    });

    redrawTopologyLinks();
  });
}
```

### 12.5 Menggambar Garis Topology dengan SVG

```html
<svg id="topologyLines" class="topology-lines"></svg>
<div id="topologyNodes" class="topology-nodes"></div>
```

```js
function drawTopologyLink(sourceEl, targetEl) {
  const svg = document.getElementById('topologyLines');

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const canvasRect = document.getElementById('topologyCanvas').getBoundingClientRect();

  const x1 = sourceRect.left + sourceRect.width / 2 - canvasRect.left;
  const y1 = sourceRect.top + sourceRect.height / 2 - canvasRect.top;
  const x2 = targetRect.left + targetRect.width / 2 - canvasRect.left;
  const y2 = targetRect.top + targetRect.height / 2 - canvasRect.top;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke-width', '3');
  line.setAttribute('class', 'topology-link-line');

  svg.appendChild(line);
}
```

---

## 13. UI Layout

### 13.1 Halaman Dashboard

Komponen:

- Sidebar menu.
- Header.
- Map area.
- Tombol tambah node.
- Tombol tambah link.
- Search node.
- Filter jenis node.

### 13.2 Halaman Map

Fitur:

- Menampilkan Google Maps.
- Menampilkan marker node.
- Menampilkan polyline antar node.
- Klik marker untuk detail.
- Tombol ambil lokasi GPS.
- Tombol tambah titik dari lokasi sekarang.

### 13.3 Halaman Topology

Fitur:

- Canvas drag and drop.
- Node visual.
- Garis penghubung antar node.
- Detail node saat diklik.
- Simpan posisi node otomatis.

### 13.4 Halaman Data Node

Fitur:

- Tabel node.
- Tambah node.
- Edit node.
- Hapus node.
- Upload foto.
- Lihat koordinat.

### 13.5 Halaman Data Link

Fitur:

- Tabel link.
- Tambah koneksi antar node.
- Pilih node asal.
- Pilih node tujuan.
- Input keterangan kabel/core.

---

## 14. Frontend File Plan

### 14.1 `public/js/api.js`

```js
async function apiGet(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Request gagal');
  return response.json();
}

async function apiPost(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Request gagal');
  return response.json();
}

async function apiPatch(url, data) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Request gagal');
  return response.json();
}

async function apiDelete(url) {
  const response = await fetch(url, {
    method: 'DELETE'
  });

  if (!response.ok) throw new Error('Request gagal');
  return response.json();
}
```

### 14.2 `public/js/nodes.js`

Berisi logic:

- Load node.
- Tambah node.
- Edit node.
- Hapus node.
- Upload foto.
- Ambil koordinat GPS.

### 14.3 `public/js/links.js`

Berisi logic:

- Load link.
- Tambah link.
- Hapus link.
- Pilih node asal dan tujuan.

### 14.4 `public/js/map.js`

Berisi logic:

- Init Google Maps.
- Render marker.
- Render polyline.
- Popup detail.
- Center map.

### 14.5 `public/js/topology.js`

Berisi logic:

- Render node diagram.
- Drag node.
- Draw line.
- Simpan posisi.
- Klik node.

---

## 15. Backend Implementation Plan

### 15.1 Install Dependency

```bash
npm init -y
npm install express sqlite3 multer dotenv cors
npm install nodemon --save-dev
```

### 15.2 `package.json`

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### 15.3 `server.js`

```js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_PATH || './database/app.db';

const db = new sqlite3.Database(DB_PATH);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/nodes');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage });

app.get('/api/nodes', (req, res) => {
  const sql = `
    SELECT
      nodes.*,
      node_types.name AS type,
      node_types.label AS type_label
    FROM nodes
    JOIN node_types ON node_types.id = nodes.node_type_id
    ORDER BY nodes.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/nodes', upload.single('photo'), (req, res) => {
  const {
    node_type_id,
    code,
    name,
    latitude,
    longitude,
    address,
    notes,
    topology_x,
    topology_y
  } = req.body;

  const photoPath = req.file ? `/uploads/nodes/${req.file.filename}` : null;

  const sql = `
    INSERT INTO nodes
    (node_type_id, code, name, latitude, longitude, address, photo_path, notes, topology_x, topology_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      node_type_id,
      code,
      name,
      latitude,
      longitude,
      address,
      photoPath,
      notes,
      topology_x || 100,
      topology_y || 100
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Node berhasil dibuat' });
    }
  );
});

app.patch('/api/nodes/:id/position', (req, res) => {
  const { topology_x, topology_y } = req.body;

  db.run(
    `UPDATE nodes SET topology_x = ?, topology_y = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [topology_x, topology_y, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Posisi topology berhasil disimpan' });
    }
  );
});

app.delete('/api/nodes/:id', (req, res) => {
  db.run(`DELETE FROM nodes WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Node berhasil dihapus' });
  });
});

app.get('/api/links', (req, res) => {
  const sql = `
    SELECT
      links.*,
      source.code AS source_code,
      source.latitude AS source_latitude,
      source.longitude AS source_longitude,
      target.code AS target_code,
      target.latitude AS target_latitude,
      target.longitude AS target_longitude
    FROM links
    JOIN nodes source ON source.id = links.source_node_id
    JOIN nodes target ON target.id = links.target_node_id
    ORDER BY links.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/links', (req, res) => {
  const {
    source_node_id,
    target_node_id,
    cable_type,
    core_count,
    core_number,
    pon_name,
    odc_name,
    notes
  } = req.body;

  const sql = `
    INSERT INTO links
    (source_node_id, target_node_id, cable_type, core_count, core_number, pon_name, odc_name, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [source_node_id, target_node_id, cable_type, core_count, core_number, pon_name, odc_name, notes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Link berhasil dibuat' });
    }
  );
});

app.delete('/api/links/:id', (req, res) => {
  db.run(`DELETE FROM links WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Link berhasil dihapus' });
  });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
```

---

## 16. Styling Dasar

### 16.1 `public/css/main.css`

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f8;
  color: #1f2937;
}

.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: #111827;
  color: white;
  padding: 20px;
}

.sidebar a {
  display: block;
  color: white;
  text-decoration: none;
  padding: 10px 0;
}

.main-content {
  flex: 1;
  padding: 20px;
}

.button {
  border: 0;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
}

.button-primary {
  background: #2563eb;
  color: white;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}
```

### 16.2 `public/css/map.css`

```css
#map {
  width: 100%;
  height: calc(100vh - 40px);
  border-radius: 12px;
  overflow: hidden;
}

.custom-marker {
  display: flex;
  align-items: center;
  justify-content: center;
}

.marker-icon {
  padding: 6px 8px;
  border-radius: 8px;
  background: white;
  border: 2px solid #111827;
  font-size: 11px;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.marker-odc {
  border-color: #7c3aed;
}

.marker-pon {
  border-color: #2563eb;
}

.marker-box {
  border-color: #059669;
}

.marker-pole {
  border-color: #d97706;
}

.popup-card {
  max-width: 260px;
}

.popup-photo {
  width: 100%;
  border-radius: 8px;
  margin-top: 8px;
}
```

### 16.3 `public/css/topology.css`

```css
.topology-page {
  display: flex;
  height: 100vh;
}

.topology-sidebar {
  width: 220px;
  background: #111827;
  color: white;
  padding: 16px;
}

.topology-canvas {
  position: relative;
  flex: 1;
  background: #f8fafc;
  overflow: hidden;
}

.topology-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.topology-node {
  position: absolute;
  width: 130px;
  min-height: 70px;
  background: white;
  border: 2px solid #111827;
  border-radius: 12px;
  padding: 10px;
  cursor: move;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  user-select: none;
}

.node-title {
  font-weight: bold;
  font-size: 14px;
}

.node-type {
  font-size: 12px;
  margin-top: 6px;
  color: #6b7280;
}

.topology-link-line {
  stroke: #1f2937;
}
```

---

## 17. Form Input Node

### 17.1 Field Form

- Jenis node.
- Kode node.
- Nama node.
- Latitude.
- Longitude.
- Alamat.
- Upload foto.
- Catatan.

### 17.2 HTML Form

```html
<form id="nodeForm" enctype="multipart/form-data">
  <div class="form-group">
    <label>Jenis Node</label>
    <select name="node_type_id" class="form-control" required>
      <option value="1">ODC</option>
      <option value="2">PON</option>
      <option value="3">Box / ODP</option>
      <option value="4">Tiang</option>
      <option value="5">Customer</option>
    </select>
  </div>

  <div class="form-group">
    <label>Kode Node</label>
    <input name="code" class="form-control" required />
  </div>

  <div class="form-group">
    <label>Nama</label>
    <input name="name" class="form-control" />
  </div>

  <div class="form-group">
    <label>Latitude</label>
    <input id="latitude" name="latitude" class="form-control" />
  </div>

  <div class="form-group">
    <label>Longitude</label>
    <input id="longitude" name="longitude" class="form-control" />
  </div>

  <button type="button" onclick="getCurrentLocation()">
    Ambil Lokasi GPS
  </button>

  <div class="form-group">
    <label>Alamat</label>
    <textarea name="address" class="form-control"></textarea>
  </div>

  <div class="form-group">
    <label>Foto</label>
    <input type="file" name="photo" accept="image/*" class="form-control" />
  </div>

  <div class="form-group">
    <label>Catatan</label>
    <textarea name="notes" class="form-control"></textarea>
  </div>

  <button type="submit" class="button button-primary">Simpan</button>
</form>
```

### 17.3 Submit Form Node

```js
document.getElementById('nodeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  const response = await fetch('/api/nodes', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!response.ok) {
    alert(result.error || 'Gagal menyimpan node');
    return;
  }

  alert('Node berhasil disimpan');
  form.reset();
});
```

---

## 18. Form Input Link

### 18.1 Field Form

- Node asal.
- Node tujuan.
- Jenis kabel.
- Jumlah core.
- Nomor core.
- Nama PON.
- Nama ODC.
- Catatan.

### 18.2 HTML Form

```html
<form id="linkForm">
  <div class="form-group">
    <label>Node Asal</label>
    <select id="sourceNode" name="source_node_id" class="form-control"></select>
  </div>

  <div class="form-group">
    <label>Node Tujuan</label>
    <select id="targetNode" name="target_node_id" class="form-control"></select>
  </div>

  <div class="form-group">
    <label>Jenis Kabel</label>
    <input name="cable_type" class="form-control" placeholder="Fiber optic" />
  </div>

  <div class="form-group">
    <label>Jumlah Core</label>
    <input name="core_count" type="number" class="form-control" />
  </div>

  <div class="form-group">
    <label>Nomor Core</label>
    <input name="core_number" class="form-control" placeholder="Core 1-4" />
  </div>

  <div class="form-group">
    <label>Jalur PON</label>
    <input name="pon_name" class="form-control" placeholder="PON-01" />
  </div>

  <div class="form-group">
    <label>ODC</label>
    <input name="odc_name" class="form-control" placeholder="ODC-CBT-001" />
  </div>

  <div class="form-group">
    <label>Catatan</label>
    <textarea name="notes" class="form-control"></textarea>
  </div>

  <button type="submit" class="button button-primary">Simpan Link</button>
</form>
```

---

## 19. Alur Implementasi 100%

### Tahap 1 - Setup Project

- [ ] Buat folder project.
- [ ] Jalankan `npm init -y`.
- [ ] Install dependency Express, SQLite, Multer, Dotenv, CORS.
- [ ] Buat struktur folder.
- [ ] Buat file `.env`.
- [ ] Buat `server.js`.
- [ ] Jalankan server lokal.

### Tahap 2 - Database

- [ ] Buat folder `database`.
- [ ] Buat `schema.sql`.
- [ ] Buat tabel `node_types`.
- [ ] Buat tabel `nodes`.
- [ ] Buat tabel `links`.
- [ ] Buat tabel `photos` jika dibutuhkan.
- [ ] Isi data awal node type.
- [ ] Test koneksi SQLite.

### Tahap 3 - Backend API

- [ ] Buat API get node.
- [ ] Buat API create node.
- [ ] Buat API update node.
- [ ] Buat API delete node.
- [ ] Buat API upload foto.
- [ ] Buat API get link.
- [ ] Buat API create link.
- [ ] Buat API delete link.
- [ ] Buat API update posisi topology.

### Tahap 4 - Frontend Layout

- [ ] Buat `index.html`.
- [ ] Buat layout sidebar.
- [ ] Buat layout dashboard.
- [ ] Buat halaman map.
- [ ] Buat halaman topology.
- [ ] Buat halaman data node.
- [ ] Buat halaman data link.

### Tahap 5 - Google Maps

- [ ] Buat Google Cloud project.
- [ ] Aktifkan Maps JavaScript API.
- [ ] Buat API Key.
- [ ] Batasi API Key berdasarkan domain.
- [ ] Batasi API Key hanya untuk Maps JavaScript API.
- [ ] Buat Map ID jika memakai Advanced Marker.
- [ ] Load Google Maps di HTML.
- [ ] Render map.
- [ ] Render marker node.
- [ ] Render polyline link.
- [ ] Buat popup detail marker.

### Tahap 6 - Geolocation

- [ ] Buat tombol ambil lokasi GPS.
- [ ] Pakai `navigator.geolocation.getCurrentPosition()`.
- [ ] Isi latitude dan longitude otomatis ke form.
- [ ] Center map ke lokasi teknisi.
- [ ] Tangani error permission lokasi.

### Tahap 7 - Upload Foto

- [ ] Buat input file foto.
- [ ] Setup Multer.
- [ ] Simpan foto ke `uploads/nodes`.
- [ ] Simpan path foto ke database.
- [ ] Tampilkan foto di popup marker.
- [ ] Tampilkan foto di detail node.

### Tahap 8 - Topology View

- [ ] Render semua node ke canvas.
- [ ] Buat node bisa di-drag.
- [ ] Simpan posisi node ke database.
- [ ] Render link sebagai garis SVG.
- [ ] Redraw garis setelah node dipindah.
- [ ] Klik node untuk membuka detail.

### Tahap 9 - CRUD Link

- [ ] Load list node ke select source.
- [ ] Load list node ke select target.
- [ ] Simpan hubungan antar node.
- [ ] Tampilkan link di map sebagai polyline.
- [ ] Tampilkan link di topology sebagai garis.

### Tahap 10 - Polishing

- [ ] Buat tampilan responsive untuk HP.
- [ ] Tambahkan search node.
- [ ] Tambahkan filter jenis node.
- [ ] Tambahkan validasi form.
- [ ] Tambahkan loading state.
- [ ] Tambahkan pesan error yang jelas.
- [ ] Tambahkan konfirmasi sebelum hapus.

### Tahap 11 - Deployment

- [ ] Siapkan VPS atau hosting Node.js.
- [ ] Upload source code.
- [ ] Setup `.env` production.
- [ ] Setup database production.
- [ ] Setup folder upload.
- [ ] Setup reverse proxy jika pakai Nginx.
- [ ] Setup domain.
- [ ] Update API key restriction ke domain production.

---

## 20. Flow Penggunaan Lapangan

```text
Teknisi buka web dari HP
        ↓
Pilih tambah node
        ↓
Pilih jenis node: Tiang / Box / ODC / PON
        ↓
Ambil foto titik
        ↓
Ambil koordinat GPS
        ↓
Isi catatan lokasi
        ↓
Simpan data
        ↓
Titik muncul di Google Maps
        ↓
Hubungkan titik dengan node lain
        ↓
Topology jaringan terbentuk
```

---

## 21. Contoh Skenario Data

### 21.1 Input ODC

```text
Jenis      : ODC
Kode       : ODC-CBT-001
Nama       : ODC Cibitung 001
Koordinat  : -6.261500, 107.152800
Catatan    : ODC utama area Cibitung
```

### 21.2 Input PON

```text
Jenis      : PON
Kode       : PON-ODC-CBT-001-01
Nama       : PON 01
Catatan    : Jalur arah Gang Mawar
```

### 21.3 Input Box

```text
Jenis      : Box / ODP
Kode       : BOX-MWR-001
Nama       : Box Gang Mawar 001
Koordinat  : -6.262000, 107.153000
Catatan    : Box depan warung
```

### 21.4 Input Tiang

```text
Jenis      : Tiang
Kode       : TIANG-MWR-001
Nama       : Tiang Mawar 001
Koordinat  : -6.262200, 107.153200
Catatan    : Tiang beton dekat pertigaan
```

### 21.5 Input Link

```text
Source     : ODC-CBT-001
Target     : PON-ODC-CBT-001-01
Jenis      : Fiber optic
Core       : 12
Catatan    : Jalur utama dari ODC
```

```text
Source     : PON-ODC-CBT-001-01
Target     : BOX-MWR-001
Jenis      : Fiber optic
Core       : 4
Catatan    : Jalur ke Gang Mawar
```

```text
Source     : BOX-MWR-001
Target     : TIANG-MWR-001
Jenis      : Drop cable / distribution cable
Catatan    : Jalur turun ke tiang pertama
```

---

## 22. Security Notes

- Jangan commit `.env` ke repository.
- Jangan publish API Key tanpa restriction.
- Batasi Google Maps API Key hanya untuk domain aplikasi.
- Batasi API Key hanya untuk API yang dipakai.
- Validasi file upload agar hanya menerima gambar.
- Batasi ukuran upload foto.
- Gunakan HTTPS saat production agar geolocation berjalan aman.
- Tambahkan login admin jika data mulai penting.

---

## 23. Rekomendasi Pengembangan Lanjutan

### 23.1 Fitur Login

Role sederhana:

- Admin.
- Teknisi.
- Viewer.

### 23.2 Export Report

Export data ke:

- Excel.
- CSV.
- PDF.

### 23.3 Import Data

Import data dari:

- CSV.
- Excel.

### 23.4 Backup Database

- Backup SQLite berkala.
- Export foto dan database.

### 23.5 Mode Offline

Untuk teknisi lapangan:

- Simpan data sementara di browser.
- Sync saat internet tersedia.

---

## 24. Checklist Final 100%

### Core System

- [ ] Server berjalan.
- [ ] Database berjalan.
- [ ] CRUD node berjalan.
- [ ] CRUD link berjalan.
- [ ] Upload foto berjalan.
- [ ] Google Maps tampil.
- [ ] Marker tampil.
- [ ] Polyline tampil.
- [ ] Popup detail tampil.
- [ ] Geolocation berjalan.
- [ ] Topology view berjalan.
- [ ] Drag node berjalan.
- [ ] Posisi topology tersimpan.
- [ ] Link topology tergambar.

### Data Quality

- [ ] Kode node unik.
- [ ] Koordinat valid.
- [ ] Foto tersimpan.
- [ ] Link tidak duplikat.
- [ ] Node asal dan tujuan tidak sama.

### UI/UX

- [ ] Tampilan rapi di laptop.
- [ ] Tampilan rapi di HP.
- [ ] Form mudah dipakai teknisi.
- [ ] Tombol ambil GPS jelas.
- [ ] Detail node mudah dibaca.

### Production

- [ ] API key Google Maps aman.
- [ ] Domain sudah dipasang.
- [ ] HTTPS aktif.
- [ ] Upload folder writable.
- [ ] Database backup tersedia.

---

## 25. Kesimpulan

Project ini adalah sistem dokumentasi jaringan fisik berbasis web dengan dua mode utama:

1. **Map View** untuk melihat titik lapangan berdasarkan koordinat GPS.
2. **Topology View** untuk melihat hubungan antar node seperti Cisco Packet Tracer sederhana.

Sistem ini tidak membaca kondisi jaringan secara realtime. Semua data berasal dari input manual teknisi, terutama foto, koordinat, catatan, dan hubungan antar titik.

Target akhirnya adalah membantu teknisi dan admin memahami posisi tiang, box, ODC, jalur PON, dan arah koneksi fisik jaringan secara visual, rapi, dan mudah diakses lewat browser.
