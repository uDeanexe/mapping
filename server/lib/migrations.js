const bcrypt = require('bcryptjs');
const { connectionFromEnv, openDb, promisifyDb, initSchema } = require('./db');

async function ensureMigrationsTable(db) {
  if (db.dialect === 'sqlserver') {
    await db.exec(`
      IF OBJECT_ID(N'schema_migrations', N'U') IS NULL
      CREATE TABLE schema_migrations (
        id NVARCHAR(120) NOT NULL PRIMARY KEY,
        applied_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `);
    return;
  }

  const idType = db.dialect === 'mysql' ? 'VARCHAR(120)' : 'TEXT';
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id ${idType} PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function listAppliedMigrations(db) {
  try {
    const rows = await db.all('SELECT id FROM schema_migrations');
    return new Set(rows.map((r) => String(r.id)));
  } catch (_) {
    return new Set();
  }
}

async function markMigrationApplied(db, id) {
  await db.run('INSERT INTO schema_migrations (id) VALUES (?)', [id]);
}

function migrationList(schemaPathAbs) {
  return [
    {
      id: '001_init_schema',
      async up(db) {
        await initSchema(db, schemaPathAbs);
      }
    },
    {
      id: '002_incidents_add_columns',
      async up(db) {
        const addColumnType = (type) => (db.alterColumnType ? db.alterColumnType(type) : type);
        const columns = await db.columns('incidents');
        const columnNames = new Set(columns.map((c) => c.name));
        const incidentColumns = [
          ['noc_admin_name', 'TEXT'],
          ['technician_name', 'TEXT'],
          ['technician_contact', 'TEXT'],
          ['technician_email', 'TEXT'],
          ['work_order_notes', 'TEXT'],
          ['technician_report', 'TEXT'],
          ['photo_path', 'TEXT'],
          ['assigned_at', 'DATETIME'],
          ['completed_at', 'DATETIME']
        ];

        for (const [name, type] of incidentColumns) {
          if (!columnNames.has(name)) {
            await db.run(`ALTER TABLE incidents ADD COLUMN ${name} ${addColumnType(type)}`);
          }
        }
      }
    },
    {
      id: '003_users_add_columns',
      async up(db) {
        const addColumnType = (type) => (db.alterColumnType ? db.alterColumnType(type) : type);
        const userColumns = await db.columns('users');
        const userColumnNames = new Set(userColumns.map((c) => c.name));
        for (const [name, type] of [
          ['is_active', 'INTEGER NOT NULL DEFAULT 1'],
          ['updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']
        ]) {
          if (!userColumnNames.has(name)) {
            await db.run(`ALTER TABLE users ADD COLUMN ${name} ${addColumnType(type)}`);
          }
        }
      }
    },
    {
      id: '004_incidents_normalize_status',
      async up(db) {
        await db.run("UPDATE incidents SET status = 'reported' WHERE status = 'open'");
        await db.run("UPDATE incidents SET status = 'closed' WHERE status IS NULL OR status = ''");
      }
    },
    {
      id: '005_seed_node_types_and_superadmin',
      async up(db) {
        const defaultNodeTypes = [
          [1, 'odc', 'ODC', 'odc.png'],
          [2, 'pon', 'PON', 'pon.png'],
          [3, 'box', 'Box / ODP', 'box.png'],
          [4, 'pole', 'Tiang', 'pole.png'],
          [5, 'customer', 'Customer', 'customer.png'],
          [6, 'server', 'Server', 'server.png'],
          [7, 'olc', 'OLC', 'olc.png']
        ];

        for (const [id, name, label, icon] of defaultNodeTypes) {
          const exists = await db.get('SELECT id FROM node_types WHERE id = ? OR name = ? LIMIT 1', [id, name]);
          if (!exists) {
            await db.run('INSERT INTO node_types (id, name, label, icon) VALUES (?, ?, ?, ?)', [id, name, label, icon]);
          }
        }

        const defaultEmail = process.env.DEFAULT_SUPERADMIN_EMAIL || 'jonusadeveloper@gmail.com';
        const defaultPassword = process.env.DEFAULT_SUPERADMIN_PASSWORD || 'superadmin123';
        const existingSuperadmin = await db.get('SELECT id FROM users WHERE role = ? LIMIT 1', ['superadmin']);
        if (!existingSuperadmin) {
          const passwordHash = await bcrypt.hash(defaultPassword, 10);
          await db.run(
            'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
            ['Super Admin', defaultEmail, passwordHash, 'superadmin', 1]
          );
        }
      }
    },
    {
      id: '006_optional_seed_demo',
      async up(db) {
        if (String(process.env.AUTO_SEED_DEMO || '0') !== '1') return;
        const nodeCountRow = await db.get('SELECT COUNT(*) AS total FROM nodes');
        const nodeCount = Number(nodeCountRow?.total || 0);
        if (nodeCount > 0) return;

        await db.run(
          `
          INSERT INTO nodes (node_type_id, code, name, latitude, longitude, address, notes)
          VALUES
            (1, 'ODC-DEMO-01', 'ODC Demo', -6.2615, 107.1528, 'Demo', 'Auto seed demo'),
            (2, 'PON-DEMO-01', 'PON Demo', -6.2621, 107.1540, 'Demo', 'Auto seed demo'),
            (3, 'ODP-DEMO-01', 'ODP Demo', -6.2630, 107.1552, 'Demo', 'Auto seed demo')
          `
        );

        const nodes = await db.all('SELECT id, code FROM nodes WHERE code IN (?, ?, ?) ORDER BY id ASC', [
          'ODC-DEMO-01',
          'PON-DEMO-01',
          'ODP-DEMO-01'
        ]);
        const byCode = new Map(nodes.map((n) => [n.code, n.id]));
        if (byCode.get('ODC-DEMO-01') && byCode.get('PON-DEMO-01')) {
          await db.run(
            `
            INSERT INTO links (source_node_id, target_node_id, cable_type, core_count, notes)
            VALUES (?, ?, ?, ?, ?)
            `,
            [byCode.get('ODC-DEMO-01'), byCode.get('PON-DEMO-01'), 'FO', 12, 'Auto seed demo']
          );
        }
      }
    }
  ];
}

async function ensureDatabaseExists() {
  const env = connectionFromEnv(process.env);
  const connection = (env.connection || 'sqlite').toLowerCase();
  const dialect = ['mysql', 'mysql2'].includes(connection)
    ? 'mysql'
    : ['mssql', 'sqlserver', 'sqlsrv'].includes(connection)
      ? 'sqlserver'
      : 'sqlite';
  if (dialect === 'sqlite') return;
  if (String(process.env.ALLOW_DB_CREATE || '0') !== '1') return;

  const dbName = env.database;
  if (!dbName) return;

  const adminEnv =
    dialect === 'mysql'
      ? {
          DB_CONNECTION: 'mysql',
          DB_HOST: env.host,
          DB_PORT: String(env.port),
          DB_DATABASE: 'mysql',
          DB_USER: env.user,
          DB_PASSWORD: env.password
        }
      : {
          DB_CONNECTION: 'sqlserver',
          DB_HOST: env.host,
          DB_PORT: String(env.port),
          DB_DATABASE: 'master',
          DB_USER: env.user,
          DB_PASSWORD: env.password,
          DB_ENCRYPT: env.encrypt ? '1' : '0',
          DB_TRUST_SERVER_CERTIFICATE: env.trustServerCertificate ? '1' : '0'
        };

  const rawAdmin = openDb(adminEnv);
  const adminDb = promisifyDb(rawAdmin);

  try {
    if (dialect === 'mysql') {
      await adminDb.exec(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    } else {
      const safeDbName = dbName.replace(/]/g, ']]').replace(/'/g, "''");
      await adminDb.exec(`
        IF DB_ID(N'${safeDbName}') IS NULL
        CREATE DATABASE [${safeDbName}]
      `);
    }
  } finally {
    try {
      await rawAdmin.destroy?.();
    } catch (_) {}
  }
}

async function runMigrations(db, schemaPathAbs) {
  await ensureMigrationsTable(db);
  const applied = await listAppliedMigrations(db);
  const migrations = migrationList(schemaPathAbs);
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    await m.up(db);
    await markMigrationApplied(db, m.id);
  }
}

module.exports = { ensureDatabaseExists, runMigrations };

