require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { ensureDir, openDb, promisifyDb } = require('./lib/db');
const { ensureDatabaseExists, runMigrations } = require('./lib/migrations');
const {
  nodeCreateSchema,
  nodePositionSchema,
  linkCreateSchema,
  incidentCreateSchema,
  incidentCompleteSchema,
  incidentEmailSchema,
  incidentTelegramSchema,
  workReportCreateSchema,
  loginSchema,
  userCreateSchema,
  userUpdateSchema
} = require('./lib/validation');
const { buildSuratJalanPdf, buildSuratJalanPdfBuffer } = require('./lib/pdf');
const { createTransport } = require('./lib/email');

const app = express();
app.disable('x-powered-by');

const PORT = Number(process.env.PORT || 3006);
const DB_PATH = process.env.DATABASE_PATH || './database/app.db';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  if (JWT_SECRET === 'dev-secret-change-me' || JWT_SECRET.length < 32) {
    // eslint-disable-next-line no-console
    console.error('JWT_SECRET harus di-set dan minimal 32 karakter di mode production.');
    process.exit(1);
  }
}

ensureDir(path.resolve(UPLOAD_DIR, 'nodes'));
ensureDir(path.resolve(UPLOAD_DIR, 'incidents'));
ensureDir(path.resolve(UPLOAD_DIR, 'reports'));
ensureDir(path.resolve(UPLOAD_DIR, 'temp'));

let rawDb = null;
let db = null;

async function bootstrap() {
  await ensureDatabaseExists();

  rawDb = openDb(path.resolve(__dirname, DB_PATH));
  db = promisifyDb(rawDb);
  const schemaPath = path.resolve(__dirname, 'database', 'schema.sql');
  await runMigrations(db, schemaPath);
  return;
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login, coba lagi sebentar.' }
});
app.use('/uploads', express.static(path.resolve(__dirname, UPLOAD_DIR)));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(__dirname, UPLOAD_DIR, 'nodes')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype || '');
    cb(ok ? null : new Error('File harus berupa gambar'), ok);
  }
});

const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(__dirname, UPLOAD_DIR, 'reports')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const uploadReport = multer({
  storage: reportStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype || '');
    cb(ok ? null : new Error('File bukti harus berupa gambar'), ok);
  }
});

const incidentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(__dirname, UPLOAD_DIR, 'incidents')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const uploadIncident = multer({
  storage: incidentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype || '');
    cb(ok ? null : new Error('File gambar gangguan harus berupa gambar'), ok);
  }
});

function apiError(res, status, message, extra) {
  res.status(status).json({ error: message, ...(extra ? { details: extra } : {}) });
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    is_active: Number(row.is_active) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function signUser(row) {
  return jwt.sign({ sub: row.id, role: row.role, email: row.email }, JWT_SECRET, { expiresIn: '12h' });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return apiError(res, 401, 'Login diperlukan');

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.get(
      'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [payload.sub]
    );
    if (!user || Number(user.is_active) !== 1) return apiError(res, 401, 'Akun tidak aktif');
    req.user = user;
    next();
  } catch (e) {
    apiError(res, 401, 'Sesi login tidak valid');
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return apiError(res, 401, 'Login diperlukan');
    if (!roles.includes(req.user.role)) return apiError(res, 403, 'Role tidak punya akses');
    next();
  };
}

function incidentStatusFromData(data) {
  if (data.status) return data.status;
  if (data.technician_name || data.technician_contact || data.technician_email) return 'assigned';
  return 'reported';
}

function buildIncidentMessage(incident, node) {
  const category = incident.category === 'internet_mati' ? 'Internet Mati' : 'Kerusakan';
  const lines = [
    `Laporan ${category}`,
    `Judul: ${incident.title || '-'}`,
    `Status: ${incident.status || '-'}`,
    `Node: ${node?.code || incident.node_code || '-'}`,
    `Lokasi: ${node?.address || '-'}`,
    Number.isFinite(node?.latitude) && Number.isFinite(node?.longitude)
      ? `Maps: https://www.google.com/maps?q=${encodeURIComponent(`${node.latitude},${node.longitude}`)}`
      : null,
    incident.description ? `Keluhan: ${incident.description}` : null,
    incident.work_order_notes ? `Instruksi NOC: ${incident.work_order_notes}` : null,
    incident.technician_name ? `Teknisi: ${incident.technician_name}` : null,
    incident.technician_contact ? `Kontak Teknisi: ${incident.technician_contact}` : null,
    incident.technician_report ? `Laporan Teknisi: ${incident.technician_report}` : null
  ];

  return lines.filter(Boolean).join('\n');
}

async function getIncidentWithNode(id) {
  const incident = await db.get(
    `
      SELECT
        incidents.*,
        nodes.code AS node_code,
        nodes.name AS node_name,
        nodes.photo_path AS node_photo_path,
        nodes.latitude AS node_latitude,
        nodes.longitude AS node_longitude,
        nodes.address AS node_address,
        node_types.name AS node_type,
        node_types.label AS node_type_label
      FROM incidents
      LEFT JOIN nodes ON nodes.id = incidents.node_id
      LEFT JOIN node_types ON node_types.id = nodes.node_type_id
      WHERE incidents.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!incident) return { incident: null, node: null };

  const node = incident.node_id
    ? {
        id: incident.node_id,
        code: incident.node_code,
        name: incident.node_name,
        latitude: incident.node_latitude,
        longitude: incident.node_longitude,
        address: incident.node_address,
        photo_path: incident.node_photo_path,
        type: incident.node_type,
        type_label: incident.node_type_label
      }
    : null;

  return { incident, node };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const user = await db.get('SELECT * FROM users WHERE email = ? LIMIT 1', [parsed.data.email]);
    if (!user || Number(user.is_active) !== 1) return apiError(res, 401, 'Email atau password salah');

    const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!ok) return apiError(res, 401, 'Email atau password salah');

    res.json({ token: signUser(user), user: publicUser(user) });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [nodes, links, incidents, reports, users] = await Promise.all([
      db.get('SELECT COUNT(*) AS total FROM nodes'),
      db.get('SELECT COUNT(*) AS total FROM links'),
      db.get('SELECT COUNT(*) AS total FROM incidents'),
      db.get('SELECT COUNT(*) AS total FROM work_reports'),
      db.get('SELECT COUNT(*) AS total FROM users')
    ]);
    const incidentByStatus = await db.all('SELECT status, COUNT(*) AS total FROM incidents GROUP BY status');
    const latestIncidents = await db.all(
      `
      SELECT incidents.id, incidents.title, incidents.category, incidents.status, incidents.created_at, nodes.code AS node_code
      FROM incidents
      LEFT JOIN nodes ON nodes.id = incidents.node_id
      ORDER BY incidents.id DESC
      LIMIT 6
      `
    );

    res.json({
      totals: {
        nodes: nodes.total,
        links: links.total,
        incidents: incidents.total,
        work_reports: reports.total,
        users: users.total
      },
      incident_by_status: incidentByStatus,
      latest_incidents: latestIncidents
    });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/users', requireAuth, requireRoles('superadmin', 'admin'), async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY id DESC'
    );
    res.json(rows.map(publicUser));
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.post('/api/users', requireAuth, requireRoles('superadmin', 'admin'), async (req, res) => {
  try {
    const parsed = userCreateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());
    const data = parsed.data;
    if (req.user.role !== 'superadmin' && data.role === 'superadmin') {
      return apiError(res, 403, 'Hanya superadmin bisa membuat superadmin');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [data.name, data.email, passwordHash, data.role, data.is_active ?? 1]
    );
    const user = await db.get('SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?', [
      result.lastID
    ]);
    res.json({ message: 'User dibuat', user: publicUser(user) });
  } catch (e) {
    const msg = /UNIQUE constraint failed: users\.email/i.test(e.message) ? 'Email sudah dipakai' : e.message;
    apiError(res, 500, msg);
  }
});

app.put('/api/users/:id', requireAuth, requireRoles('superadmin', 'admin'), async (req, res) => {
  try {
    const parsed = userUpdateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());
    const data = parsed.data;
    const existing = await db.get('SELECT id, role FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) return apiError(res, 404, 'User tidak ditemukan');
    if (req.user.role !== 'superadmin' && (existing.role === 'superadmin' || data.role === 'superadmin')) {
      return apiError(res, 403, 'Hanya superadmin bisa mengubah superadmin');
    }

    if (data.password) {
      const passwordHash = await bcrypt.hash(data.password, 10);
      await db.run(
        'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [data.name, data.email, passwordHash, data.role, data.is_active ?? 1, req.params.id]
      );
    } else {
      await db.run(
        'UPDATE users SET name = ?, email = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [data.name, data.email, data.role, data.is_active ?? 1, req.params.id]
      );
    }

    res.json({ message: 'User diupdate' });
  } catch (e) {
    const msg = /UNIQUE constraint failed: users\.email/i.test(e.message) ? 'Email sudah dipakai' : e.message;
    apiError(res, 500, msg);
  }
});

app.delete('/api/users/:id', requireAuth, requireRoles('superadmin'), async (req, res) => {
  try {
    if (Number(req.params.id) === Number(req.user.id)) return apiError(res, 422, 'Tidak bisa hapus akun sendiri');
    const result = await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return apiError(res, 404, 'User tidak ditemukan');
    res.json({ message: 'User dihapus' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/node-types', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, name, label, icon FROM node_types ORDER BY id ASC');
    res.json(rows);
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/nodes', async (req, res) => {
  try {
    const sql = `
      SELECT
        nodes.*,
        node_types.name AS type,
        node_types.label AS type_label
      FROM nodes
      JOIN node_types ON node_types.id = nodes.node_type_id
      ORDER BY nodes.id DESC
    `;
    const rows = await db.all(sql);
    res.json(rows);
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/nodes/:id', async (req, res) => {
  try {
    const sql = `
      SELECT
        nodes.*,
        node_types.name AS type,
        node_types.label AS type_label
      FROM nodes
      JOIN node_types ON node_types.id = nodes.node_type_id
      WHERE nodes.id = ?
      LIMIT 1
    `;
    const row = await db.get(sql, [req.params.id]);
    if (!row) return apiError(res, 404, 'Node tidak ditemukan');
    res.json(row);
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/nodes/:id/surat-jalan.pdf', async (req, res) => {
  try {
    const sql = `
      SELECT
        nodes.*,
        node_types.name AS type,
        node_types.label AS type_label
      FROM nodes
      JOIN node_types ON node_types.id = nodes.node_type_id
      WHERE nodes.id = ?
      LIMIT 1
    `;
    const node = await db.get(sql, [req.params.id]);
    if (!node) return apiError(res, 404, 'Node tidak ditemukan');

    const extras = {
      tujuan: req.query.tujuan,
      keperluan: req.query.keperluan,
      kerusakan: req.query.kerusakan,
      teknisi: req.query.teknisi,
      kendaraan: req.query.kendaraan
    };

    const doc = buildSuratJalanPdf({
      node,
      createdAt: new Date(),
      extras,
      uploadDirAbs: path.resolve(__dirname, UPLOAD_DIR)
    });
    const filename = `surat-jalan-${String(node.code || node.id).toLowerCase()}.pdf`;
    const download = String(req.query.download || '') === '1';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/\"/g, '')}"`
    );

    doc.pipe(res);
    doc.end();
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/incidents/:id/surat-jalan.pdf', async (req, res) => {
  try {
    const { incident, node } = await getIncidentWithNode(req.params.id);
    if (!incident) return apiError(res, 404, 'Gangguan tidak ditemukan');

    const pdfNode =
      node ||
      {
        id: incident.id,
        code: `INC-${incident.id}`,
        name: incident.title,
        type: 'incident',
        type_label: 'Gangguan',
        latitude: null,
        longitude: null,
        address: null,
        photo_path: incident.photo_path,
        notes: incident.description
      };

    const extras = {
      tujuan: req.query.tujuan || incident.title,
      keperluan: req.query.keperluan || incident.work_order_notes || 'Penanganan gangguan lapangan',
      kerusakan: req.query.kerusakan || incident.description,
      teknisi: req.query.teknisi || incident.technician_name,
      kendaraan: req.query.kendaraan,
      noc_admin: incident.noc_admin_name,
      photo_path: incident.photo_path || pdfNode.photo_path
    };

    const doc = buildSuratJalanPdf({
      node: pdfNode,
      createdAt: new Date(),
      extras,
      uploadDirAbs: path.resolve(__dirname, UPLOAD_DIR)
    });
    const filename = `surat-jalan-gangguan-${String(incident.id).padStart(6, '0')}.pdf`;
    const download = String(req.query.download || '') === '1';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/\"/g, '')}"`
    );

    doc.pipe(res);
    doc.end();
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.post('/api/nodes', upload.single('photo'), async (req, res) => {
  try {
    const parsed = nodeCreateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const data = parsed.data;
    const photoPath = req.file ? `/uploads/nodes/${req.file.filename}` : null;

    const result = await db.run(
      `
        INSERT INTO nodes
        (node_type_id, code, name, latitude, longitude, address, photo_path, notes, topology_x, topology_y)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.node_type_id,
        data.code,
        data.name || null,
        Number.isFinite(data.latitude) ? data.latitude : null,
        Number.isFinite(data.longitude) ? data.longitude : null,
        data.address || null,
        photoPath,
        data.notes || null,
        data.topology_x ?? 100,
        data.topology_y ?? 100
      ]
    );

    res.json({ id: result.lastID, message: 'Node berhasil dibuat' });
  } catch (e) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    const msg = /UNIQUE constraint failed: nodes\.code/i.test(e.message)
      ? 'Kode node sudah dipakai'
      : e.message;
    apiError(res, 500, msg);
  }
});

app.put('/api/nodes/:id', upload.single('photo'), async (req, res) => {
  try {
    const parsed = nodeCreateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const existing = await db.get(
      'SELECT id, photo_path, topology_x, topology_y FROM nodes WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (!existing) return apiError(res, 404, 'Node tidak ditemukan');

    const data = parsed.data;
    const newPhotoPath = req.file ? `/uploads/nodes/${req.file.filename}` : existing.photo_path;

    await db.run(
      `
        UPDATE nodes SET
          node_type_id = ?,
          code = ?,
          name = ?,
          latitude = ?,
          longitude = ?,
          address = ?,
          photo_path = ?,
          notes = ?,
          topology_x = ?,
          topology_y = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        data.node_type_id,
        data.code,
        data.name || null,
        Number.isFinite(data.latitude) ? data.latitude : null,
        Number.isFinite(data.longitude) ? data.longitude : null,
        data.address || null,
        newPhotoPath,
        data.notes || null,
        data.topology_x ?? existing.topology_x ?? 100,
        data.topology_y ?? existing.topology_y ?? 100,
        req.params.id
      ]
    );

    if (req.file && existing.photo_path && existing.photo_path.startsWith('/uploads/nodes/')) {
      const oldFile = path.resolve(__dirname, existing.photo_path.replace('/uploads/', `${UPLOAD_DIR}/`));
      try {
        fs.unlinkSync(oldFile);
      } catch (_) {}
    }

    res.json({ message: 'Node berhasil diupdate' });
  } catch (e) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    const msg = /UNIQUE constraint failed: nodes\.code/i.test(e.message)
      ? 'Kode node sudah dipakai'
      : e.message;
    apiError(res, 500, msg);
  }
});

app.patch('/api/nodes/:id/position', async (req, res) => {
  try {
    const parsed = nodePositionSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const { topology_x, topology_y } = parsed.data;
    const result = await db.run(
      'UPDATE nodes SET topology_x = ?, topology_y = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [topology_x, topology_y, req.params.id]
    );
    if (result.changes === 0) return apiError(res, 404, 'Node tidak ditemukan');
    res.json({ message: 'Posisi topology berhasil disimpan' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.delete('/api/nodes/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT id, photo_path FROM nodes WHERE id = ? LIMIT 1', [
      req.params.id
    ]);
    if (!existing) return apiError(res, 404, 'Node tidak ditemukan');

    await db.run('DELETE FROM links WHERE source_node_id = ? OR target_node_id = ?', [
      req.params.id,
      req.params.id
    ]);
    await db.run('DELETE FROM nodes WHERE id = ?', [req.params.id]);

    if (existing.photo_path && existing.photo_path.startsWith('/uploads/nodes/')) {
      const oldFile = path.resolve(__dirname, existing.photo_path.replace('/uploads/', `${UPLOAD_DIR}/`));
      try {
        fs.unlinkSync(oldFile);
      } catch (_) {}
    }

    res.json({ message: 'Node berhasil dihapus' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/links', async (req, res) => {
  try {
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
      JOIN nodes AS source ON source.id = links.source_node_id
      JOIN nodes AS target ON target.id = links.target_node_id
      ORDER BY links.id DESC
    `;
    const rows = await db.all(sql);
    res.json(rows);
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/incidents', async (req, res) => {
  try {
    const rows = await db.all(
      `
      SELECT
        incidents.*,
        nodes.code AS node_code,
        node_types.name AS node_type,
        node_types.label AS node_type_label
      FROM incidents
      LEFT JOIN nodes ON nodes.id = incidents.node_id
      LEFT JOIN node_types ON node_types.id = nodes.node_type_id
      ORDER BY incidents.id DESC
      `
    );
    res.json(rows);
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.post('/api/incidents', uploadIncident.single('photo'), async (req, res) => {
  try {
    const parsed = incidentCreateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());
    const data = parsed.data;
    const photoPath = req.file ? `/uploads/incidents/${req.file.filename}` : null;

    if (data.node_id) {
      const exists = await db.get('SELECT id FROM nodes WHERE id = ? LIMIT 1', [data.node_id]);
      if (!exists) return apiError(res, 422, 'Node tidak valid');
    }

    const result = await db.run(
      `
        INSERT INTO incidents
        (
          node_id, category, title, description, reporter_name, reporter_contact, photo_path,
          noc_admin_name, technician_name, technician_contact, technician_email,
          work_order_notes, technician_report, status, assigned_at, completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.node_id || null,
        data.category,
        data.title,
        data.description || null,
        data.reporter_name || null,
        data.reporter_contact || null,
        photoPath,
        data.noc_admin_name || null,
        data.technician_name || null,
        data.technician_contact || null,
        data.technician_email || null,
        data.work_order_notes || null,
        data.technician_report || null,
        incidentStatusFromData(data),
        data.technician_name || data.technician_contact || data.technician_email ? new Date().toISOString() : null,
        data.technician_report ? new Date().toISOString() : null
      ]
    );
    res.json({ id: result.lastID, message: 'Gangguan dibuat' });
  } catch (e) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    apiError(res, 500, e.message);
  }
});

app.put('/api/incidents/:id', uploadIncident.single('photo'), async (req, res) => {
  try {
    const parsed = incidentCreateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());
    const data = parsed.data;

    const existing = await db.get('SELECT id, photo_path FROM incidents WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) return apiError(res, 404, 'Gangguan tidak ditemukan');
    const photoPath = req.file ? `/uploads/incidents/${req.file.filename}` : existing.photo_path;

    if (data.node_id) {
      const exists = await db.get('SELECT id FROM nodes WHERE id = ? LIMIT 1', [data.node_id]);
      if (!exists) return apiError(res, 422, 'Node tidak valid');
    }

    await db.run(
      `
        UPDATE incidents SET
          node_id = ?,
          category = ?,
          title = ?,
          description = ?,
          reporter_name = ?,
          reporter_contact = ?,
          photo_path = ?,
          noc_admin_name = ?,
          technician_name = ?,
          technician_contact = ?,
          technician_email = ?,
          work_order_notes = ?,
          technician_report = ?,
          status = ?,
          assigned_at = CASE
            WHEN assigned_at IS NULL AND (? IS NOT NULL OR ? IS NOT NULL OR ? IS NOT NULL) THEN CURRENT_TIMESTAMP
            ELSE assigned_at
          END,
          completed_at = CASE
            WHEN ? IS NOT NULL AND ? != '' AND completed_at IS NULL THEN CURRENT_TIMESTAMP
            ELSE completed_at
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        data.node_id || null,
        data.category,
        data.title,
        data.description || null,
        data.reporter_name || null,
        data.reporter_contact || null,
        photoPath || null,
        data.noc_admin_name || null,
        data.technician_name || null,
        data.technician_contact || null,
        data.technician_email || null,
        data.work_order_notes || null,
        data.technician_report || null,
        incidentStatusFromData(data),
        data.technician_name || null,
        data.technician_contact || null,
        data.technician_email || null,
        data.technician_report || null,
        data.technician_report || null,
        req.params.id
      ]
    );

    if (req.file && existing.photo_path && existing.photo_path.startsWith('/uploads/incidents/')) {
      const oldFile = path.resolve(__dirname, existing.photo_path.replace('/uploads/', `${UPLOAD_DIR}/`));
      try {
        fs.unlinkSync(oldFile);
      } catch (_) {}
    }
    res.json({ message: 'Gangguan diupdate' });
  } catch (e) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    apiError(res, 500, e.message);
  }
});

app.delete('/api/incidents/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT id, photo_path FROM incidents WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) return apiError(res, 404, 'Gangguan tidak ditemukan');

    const result = await db.run('DELETE FROM incidents WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return apiError(res, 404, 'Gangguan tidak ditemukan');

    if (existing.photo_path && existing.photo_path.startsWith('/uploads/incidents/')) {
      const oldFile = path.resolve(__dirname, existing.photo_path.replace('/uploads/', `${UPLOAD_DIR}/`));
      try {
        fs.unlinkSync(oldFile);
      } catch (_) {}
    }

    res.json({ message: 'Gangguan dihapus' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.patch('/api/incidents/:id/complete', async (req, res) => {
  try {
    const parsed = incidentCompleteSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const result = await db.run(
      `
        UPDATE incidents SET
          technician_report = ?,
          status = ?,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [parsed.data.technician_report, parsed.data.status || 'completed', req.params.id]
    );
    if (result.changes === 0) return apiError(res, 404, 'Gangguan tidak ditemukan');
    res.json({ message: 'Laporan teknisi disimpan' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.get('/api/incidents/:id/share-message', async (req, res) => {
  try {
    const { incident, node } = await getIncidentWithNode(req.params.id);
    if (!incident) return apiError(res, 404, 'Gangguan tidak ditemukan');
    res.json({
      message: buildIncidentMessage(incident, node),
      whatsapp_url: `https://wa.me/?text=${encodeURIComponent(buildIncidentMessage(incident, node))}`,
      telegram_url: `https://t.me/share/url?text=${encodeURIComponent(buildIncidentMessage(incident, node))}`
    });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.post('/api/incidents/:id/send-telegram', async (req, res) => {
  try {
    const parsed = incidentTelegramSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return apiError(res, 400, 'TELEGRAM_BOT_TOKEN belum dikonfigurasi di server/.env');

    const { incident, node } = await getIncidentWithNode(req.params.id);
    if (!incident) return apiError(res, 404, 'Gangguan tidak ditemukan');

    const text = parsed.data.message || buildIncidentMessage(incident, node);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: parsed.data.chat_id, text })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) return apiError(res, 500, body.description || 'Gagal kirim Telegram');

    res.json({ message: 'Telegram terkirim' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.post('/api/incidents/:id/send-email', async (req, res) => {
  try {
    const parsed = incidentEmailSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const inc = await db.get('SELECT * FROM incidents WHERE id = ? LIMIT 1', [req.params.id]);
    if (!inc) return apiError(res, 404, 'Gangguan tidak ditemukan');

    let node = null;
    if (inc.node_id) {
      node = await db.get(
        `
          SELECT
            nodes.*,
            node_types.name AS type,
            node_types.label AS type_label
          FROM nodes
          JOIN node_types ON node_types.id = nodes.node_type_id
          WHERE nodes.id = ?
          LIMIT 1
        `,
        [inc.node_id]
      );
    }
    if (!node) {
      // fallback dummy node for PDF
      node = {
        id: inc.node_id || 0,
        code: inc.node_code || `INC-${inc.id}`,
        name: inc.title,
        type: 'incident',
        type_label: 'Gangguan',
        latitude: null,
        longitude: null,
        address: null,
        notes: inc.description
      };
    }

    const { transport, from } = createTransport(process.env);
    const payload = parsed.data;
    const subject =
      payload.subject ||
      `[Surat Jalan] ${inc.category === 'internet_mati' ? 'Internet Mati' : 'Kerusakan'} - ${node.code || inc.id}`;

    const extras = {
      tujuan: payload.tujuan || inc.title,
      keperluan: payload.keperluan || inc.work_order_notes || 'Penanganan gangguan lapangan',
      kerusakan: inc.description,
      teknisi: payload.teknisi || inc.technician_name,
      kendaraan: payload.kendaraan,
      noc_admin: inc.noc_admin_name,
      photo_path: inc.photo_path || node.photo_path
    };

    const pdfBuffer = await buildSuratJalanPdfBuffer({
      node,
      createdAt: new Date(),
      extras,
      uploadDirAbs: path.resolve(__dirname, UPLOAD_DIR)
    });

    const text =
      payload.message || `${buildIncidentMessage(inc, node)}\n\nSurat Jalan PDF terlampir.`;

    await transport.sendMail({
      from,
      to: payload.to,
      subject,
      text,
      attachments: [
        {
          filename: `surat-jalan-incident-${inc.id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    res.json({ message: 'Email terkirim' });
  } catch (e) {
    if (e.code === 'SMTP_NOT_CONFIGURED') return apiError(res, 400, e.message);
    apiError(res, 500, e.message);
  }
});

app.get('/api/work-reports', async (req, res) => {
  try {
    const rows = await db.all(
      `
      SELECT
        work_reports.*,
        incidents.title AS incident_title,
        incidents.category AS incident_category,
        nodes.code AS node_code,
        node_types.name AS node_type,
        node_types.label AS node_type_label
      FROM work_reports
      LEFT JOIN incidents ON incidents.id = work_reports.incident_id
      LEFT JOIN nodes ON nodes.id = work_reports.node_id
      LEFT JOIN node_types ON node_types.id = nodes.node_type_id
      ORDER BY work_reports.id DESC
      `
    );
    res.json(rows);
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.post('/api/work-reports', uploadReport.single('photo'), async (req, res) => {
  try {
    const parsed = workReportCreateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const data = parsed.data;
    let incident = null;
    if (data.incident_id) {
      incident = await db.get('SELECT id, node_id FROM incidents WHERE id = ? LIMIT 1', [data.incident_id]);
      if (!incident) return apiError(res, 422, 'Gangguan tidak valid');
    }

    const nodeId = data.node_id || incident?.node_id || null;
    if (nodeId) {
      const node = await db.get('SELECT id FROM nodes WHERE id = ? LIMIT 1', [nodeId]);
      if (!node) return apiError(res, 422, 'Node tidak valid');
    }

    const photoPath = req.file ? `/uploads/reports/${req.file.filename}` : null;
    const result = await db.run(
      `
        INSERT INTO work_reports
        (incident_id, node_id, technician_name, report_title, description, photo_path, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.incident_id || null,
        nodeId,
        data.technician_name || null,
        data.report_title,
        data.description,
        photoPath,
        data.status || 'completed'
      ]
    );

    if (data.incident_id) {
      await db.run(
        `
          UPDATE incidents SET
            technician_report = ?,
            status = ?,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [data.description, data.status || 'completed', data.incident_id]
      );
    }

    res.json({ id: result.lastID, message: 'Rekam kerja disimpan' });
  } catch (e) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    apiError(res, 500, e.message);
  }
});

app.delete('/api/work-reports/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT id, photo_path FROM work_reports WHERE id = ? LIMIT 1', [
      req.params.id
    ]);
    if (!existing) return apiError(res, 404, 'Rekam kerja tidak ditemukan');

    await db.run('DELETE FROM work_reports WHERE id = ?', [req.params.id]);

    if (existing.photo_path && existing.photo_path.startsWith('/uploads/reports/')) {
      const oldFile = path.resolve(__dirname, existing.photo_path.replace('/uploads/', `${UPLOAD_DIR}/`));
      try {
        fs.unlinkSync(oldFile);
      } catch (_) {}
    }

    res.json({ message: 'Rekam kerja dihapus' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

app.post('/api/links', async (req, res) => {
  try {
    const parsed = linkCreateSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 422, 'Validasi gagal', parsed.error.flatten());

    const data = parsed.data;
    if (data.source_node_id === data.target_node_id) {
      return apiError(res, 422, 'Node asal dan tujuan tidak boleh sama');
    }

    const source = await db.get('SELECT id FROM nodes WHERE id = ? LIMIT 1', [data.source_node_id]);
    const target = await db.get('SELECT id FROM nodes WHERE id = ? LIMIT 1', [data.target_node_id]);
    if (!source || !target) return apiError(res, 422, 'Source/Target node tidak valid');

    const result = await db.run(
      `
        INSERT INTO links
        (source_node_id, target_node_id, cable_type, core_count, core_number, pon_name, odc_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.source_node_id,
        data.target_node_id,
        data.cable_type || null,
        Number.isFinite(data.core_count) ? data.core_count : null,
        data.core_number || null,
        data.pon_name || null,
        data.odc_name || null,
        data.notes || null
      ]
    );

    res.json({ id: result.lastID, message: 'Link berhasil dibuat' });
  } catch (e) {
    const msg = /UNIQUE constraint failed: links\.source_node_id, links\.target_node_id/i.test(e.message)
      ? 'Link yang sama sudah ada'
      : e.message;
    apiError(res, 500, msg);
  }
});

app.delete('/api/links/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM links WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return apiError(res, 404, 'Link tidak ditemukan');
    res.json({ message: 'Link berhasil dihapus' });
  } catch (e) {
    apiError(res, 500, e.message);
  }
});

bootstrap()
  .then(() => {
    const server = app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`API running on http://localhost:${PORT}`);
    });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        // eslint-disable-next-line no-console
        console.error(
          `Port ${PORT} sudah dipakai. Tutup proses Node lama atau ganti PORT di server/.env, lalu jalankan npm run dev lagi.`
        );
        process.exit(1);
      }
      throw error;
    });
    server.on('close', async () => {
      try {
        await rawDb.destroy?.();
      } catch (_) {}
    });
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Bootstrap failed:', e);
    process.exit(1);
  });
