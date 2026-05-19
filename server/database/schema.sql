PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS node_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO node_types (id, name, label, icon) VALUES
(1, 'odc', 'ODC', 'odc.png'),
(2, 'pon', 'PON', 'pon.png'),
(3, 'box', 'Box / ODP', 'box.png'),
(4, 'pole', 'Tiang', 'pole.png'),
(5, 'customer', 'Customer', 'customer.png'),
(6, 'server', 'Server', 'server.png'),
(7, 'olc', 'OLC', 'olc.png');

CREATE TABLE IF NOT EXISTS nodes (
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

CREATE TABLE IF NOT EXISTS links (
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

CREATE UNIQUE INDEX IF NOT EXISTS links_unique_pair ON links(source_node_id, target_node_id);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teknisi', -- superadmin|admin|supervisor_noc|teknisi
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gangguan / Incident (kerusakan atau internet mati)
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER,
  category TEXT NOT NULL, -- 'kerusakan' | 'internet_mati'
  title TEXT NOT NULL,
  description TEXT,
  reporter_name TEXT,
  reporter_contact TEXT,
  photo_path TEXT,
  noc_admin_name TEXT,
  technician_name TEXT,
  technician_contact TEXT,
  technician_email TEXT,
  work_order_notes TEXT,
  technician_report TEXT,
  status TEXT NOT NULL DEFAULT 'reported', -- reported|assigned|in_progress|completed|closed
  assigned_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

-- Rekam kerja teknisi / bukti penyelesaian pekerjaan
CREATE TABLE IF NOT EXISTS work_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER,
  node_id INTEGER,
  technician_name TEXT,
  report_title TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_path TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (incident_id) REFERENCES incidents(id),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
